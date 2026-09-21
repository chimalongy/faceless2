import { task, logger } from "@trigger.dev/sdk";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { getFfmpegPath, getAudioDuration } from "@/lib/ffmpeg-helper";
import { uploadToR2, deleteFromR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";
import { generateTitleCardPng } from "@/lib/title-card-generator";

const execAsync = promisify(exec);

/**
 * Task: MergeSceneFrames
 * Downloads all scene video clips, concats them sequentially by scene_number,
 * uploads the final master video to Cloudflare R2, and updates Neon DB.
 */
export const mergeSceneFramesTask = task({
  id: "merge-scene-frames",
  maxDuration: 7200, // 2 hour max
  machine: "large-1x",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      sceneVideos = [],
      resolution = "1080p", // "1080p" (1920x1080) or "720p" (1280x720)
    } = payload;

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required for merge-scene-frames task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required for merge-scene-frames task.");
    }

    logger.log("Starting MergeSceneFrames task...", {
      channelSlug,
      topicSlug,
      providedVideosCount: Array.isArray(sceneVideos) ? sceneVideos.length : 0,
    });

    const sql = getDbSql();
    let channelId = null;
    let topicId = null;

    if (sql) {
      await initDbSchema();
      const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
      const tRows = await sql`SELECT id, COALESCE(video_type, 'longform') AS "videoType" FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
      channelId = cRows?.[0]?.id || null;
      topicId = tRows?.[0]?.id || null;
      if (tRows?.[0]?.videoType) {
        payload.videoType = tRows[0].videoType;
      }
    }

    // 1. Gather scene video list: from payload OR fallback to topic_assets in database
    let scenesToMerge = [];

    if (Array.isArray(sceneVideos) && sceneVideos.length > 0) {
      scenesToMerge = sceneVideos
        .map((s) => ({
          scene_number: Number(s.scene_number ?? s.sceneIndex ?? s.index ?? 1),
          video_url: s.video_url || s.url || s.videoUrl || "",
        }))
        .filter((s) => Boolean(s.video_url));
    } else if (sql && topicId && channelId) {
      // Retrieve existing video assets from DB
      const assetRows = await sql`
        SELECT scene_index, file_url
        FROM topic_assets
        WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'video'
        ORDER BY scene_index ASC;
      `;
      if (assetRows && assetRows.length > 0) {
        scenesToMerge = assetRows.map((row) => ({
          scene_number: Number(row.scene_index || 1),
          video_url: row.file_url,
        }));
      }
    }

    if (scenesToMerge.length === 0) {
      throw new Error(
        `No scene videos found to merge for topic "${topicSlug}". Render scene frames first before merging.`
      );
    }

    // Sort scenes in strict ascending order
    const sortedScenes = [...scenesToMerge].sort(
      (a, b) => a.scene_number - b.scene_number
    );

    logger.log(`Found ${sortedScenes.length} scenes to merge in sequence:`, {
      order: sortedScenes.map((s) => s.scene_number),
    });

    // 2. Set up isolated working directory
    const jobId = `merge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tmpDir = path.join(os.tmpdir(), "trigger-merge-frames", jobId);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // 3. Download all scene videos concurrently in parallel
      logger.log(`Downloading ${sortedScenes.length} scene videos in parallel...`);

      const downloadPromises = sortedScenes.map(async (scene) => {
        const localFileName = `scene-${String(scene.scene_number).padStart(3, "0")}.mp4`;
        const localPath = path.join(tmpDir, localFileName);

        logger.log(`Downloading scene ${scene.scene_number} from ${scene.video_url}...`);

        const res = await fetch(scene.video_url);
        if (!res.ok) {
          throw new Error(
            `Failed to download scene ${scene.scene_number} video: ${res.statusText} (${scene.video_url})`
          );
        }

        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

        return {
          scene_number: scene.scene_number,
          localPath,
        };
      });

      const downloadedClips = await Promise.all(downloadPromises);

      // Ensure the clips are arranged strictly in sorted order
      const localClipPaths = downloadedClips
        .sort((a, b) => a.scene_number - b.scene_number)
        .map((c) => c.localPath);

      // 4. Generate FFmpeg concat list file
      const concatListPath = path.join(tmpDir, "concat_list.txt");
      const concatContent = localClipPaths
        .map((f) => `file '${f.replace(/\\/g, "/")}'`)
        .join("\n");
      fs.writeFileSync(concatListPath, concatContent);

      const ffmpeg = getFfmpegPath();
      const mergedOutputPath = path.join(tmpDir, "merged_master.mp4");

      // 5. Run FFmpeg concatenation with encoding standardization
      const isShortTopic =
        Boolean(payload.isShort) ||
        payload.videoType === "short" ||
        ["1080x1920", "shorts", "vertical", "9:16", "720x1280"].includes(String(resolution).toLowerCase());

      let targetWidth = 1920;
      let targetHeight = 1080;

      if (isShortTopic) {
        if (resolution === "720x1280" || resolution === "720p") {
          targetWidth = 720;
          targetHeight = 1280;
        } else {
          targetWidth = 1080;
          targetHeight = 1920;
        }
      } else {
        if (resolution === "720p" || resolution === "1280x720") {
          targetWidth = 1280;
          targetHeight = 720;
        } else {
          targetWidth = 1920;
          targetHeight = 1080;
        }
      }

      const scaleFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`;

      let titleCardPath = null;
      const showTitleOverlay = isShortTopic && Boolean(payload.showShortsTitleOverlay);
      const titleToDisplay = String(payload.shortsOverlayText || "").trim();
      if (showTitleOverlay && (!titleToDisplay || titleToDisplay.length > 120)) {
        throw new Error("Enter overlay text (1–120 characters) before merging.");
      }

      if (showTitleOverlay && titleToDisplay) {
        try {
          const cardPath = path.join(tmpDir, "title_card.png");
          titleCardPath = await generateTitleCardPng(titleToDisplay, cardPath, { width: targetWidth });
          if (!titleCardPath || !fs.existsSync(titleCardPath)) {
            throw new Error("Title card generator did not produce a PNG.");
          }
        } catch (err) {
          throw new Error(`Title badge was requested but could not be generated: ${err.message}`);
        }
      }

      const topY = targetHeight >= 1920 ? 200 : Math.round(targetHeight * 0.10);
      const inputArgs = [`-f concat`, `-safe 0`, `-i "${concatListPath}"`];
      let filterArgs = [];

      if (titleCardPath && fs.existsSync(titleCardPath)) {
        inputArgs.push(`-i "${titleCardPath}"`);
        filterArgs = [
          `-filter_complex "[0:v]${scaleFilter}[base];[base][1:v]overlay=(W-w)/2:${topY}:format=auto[v]"`,
          `-map "[v]"`,
          `-map 0:a:0?`,
        ];
      } else {
        filterArgs = [
          `-map 0:v:0`,
          `-map 0:a:0?`,
          `-vf "${scaleFilter}"`,
        ];
      }

      const mergeCmd = [
        `"${ffmpeg}" -y`,
        ...inputArgs,
        ...filterArgs,
        `-c:v libx264`,
        `-preset veryfast`,
        `-crf 19`,
        `-pix_fmt yuv420p`,
        `-profile:v high`,
        `-level 4.2`,
        `-movflags +faststart`,
        `-c:a aac`,
        `-b:a 192k`,
        `-ar 44100`,
        `"${mergedOutputPath}"`,
      ].join(" ");

      logger.log(`Executing FFmpeg master merge (${targetWidth}x${targetHeight} ${isShortTopic ? "Vertical Shorts 9:16" : "16:9"})...`, { cmd: mergeCmd });

      await execAsync(mergeCmd, { maxBuffer: 1024 * 1024 * 50 });

      if (!fs.existsSync(mergedOutputPath)) {
        throw new Error("FFmpeg merge failed to produce an output video file.");
      }

      // 6. Measure output duration
      let durationSeconds = 0;
      try {
        durationSeconds = await getAudioDuration(mergedOutputPath);
      } catch (durErr) {
        logger.warn("Could not measure final merged video duration:", durErr.message);
      }

      const mergedBuffer = fs.readFileSync(mergedOutputPath);
      logger.log("Merged video generated successfully. Size:", {
        sizeMB: (mergedBuffer.length / (1024 * 1024)).toFixed(2),
        duration: durationSeconds,
      });

      // 7. Clean up previous master video in Cloudflare R2 and DB if exists
      try {
        const freshSql = getDbSql();
        if (freshSql && channelId && topicId) {
          const oldMasters = await freshSql`
            SELECT file_key FROM topic_assets
            WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'completedvideo';
          `;
          if (oldMasters && oldMasters.length > 0) {
            for (const row of oldMasters) {
              if (row.file_key) {
                await deleteFromR2(row.file_key).catch(() => { });
              }
            }
            await freshSql`
              DELETE FROM topic_assets
              WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'completedvideo';
            `;
          }
        }
      } catch (cleanErr) {
        logger.warn("Could not clean up old master video assets:", cleanErr.message);
      }

      // 8. Upload to Cloudflare R2
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const r2Key = `channels/${channelSlug}/topics/${topicSlug}/master/${topicSlug}-master-${timestamp}-${randomSuffix}.mp4`;

      logger.log(`Uploading master video (${(mergedBuffer.length / (1024 * 1024)).toFixed(2)} MB) to Cloudflare R2...`);

      const uploadResult = await uploadToR2({
        key: r2Key,
        buffer: mergedBuffer,
        mimeType: "video/mp4",
        metadata: {
          channelSlug,
          topicSlug,
          type: "master_video",
          sceneCount: String(sortedScenes.length),
          duration: String(durationSeconds),
        },
      });

      logger.log("Master video uploaded to Cloudflare R2 successfully:", {
        publicUrl: uploadResult.publicUrl,
        key: uploadResult.key,
      });

      // 9. Update Database: insert record into topic_assets & update master_video_url in topics
      try {
        const freshSql = getDbSql();
        if (freshSql && channelId && topicId) {
          await freshSql`
            INSERT INTO topic_assets (
              topic_id,
              channel_id,
              asset_type,
              file_url,
              file_key,
              file_name,
              mime_type,
              size_bytes
            ) VALUES (
              ${topicId},
              ${channelId},
              'completedvideo',
              ${uploadResult.publicUrl},
              ${uploadResult.key},
              ${isShortTopic ? `${topicSlug}-master-shorts.mp4` : `${topicSlug}-master-1080p.mp4`},
              'video/mp4',
              ${mergedBuffer.length}
            );
          `;

          await freshSql`
            UPDATE topics
            SET master_video_url = ${uploadResult.publicUrl}, updated_at = NOW()
            WHERE id = ${topicId};
          `;

          logger.log("Updated topics master_video_url in Neon PostgreSQL.");
        }
      } catch (dbErr) {
        logger.warn("Could not update database with master video asset:", { error: dbErr.message });
      }

      return {
        success: true,
        channelSlug,
        topicSlug,
        videoUrl: uploadResult.publicUrl,
        publicUrl: uploadResult.publicUrl,
        key: uploadResult.key,
        duration: durationSeconds,
        sceneCount: sortedScenes.length,
        sizeBytes: mergedBuffer.length,
      };
    } catch (err) {
      logger.error("MergeSceneFrames task failed:", { error: err.message });
      throw err;
    } finally {
      // Clean up temp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (rmErr) {
        logger.warn("Could not clean up temporary merge directory:", rmErr.message);
      }
    }
  },
});

export default mergeSceneFramesTask;

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

    let channelBgMusic = null;
    let channelVideoSettings = null;
    if (sql) {
      await initDbSchema();
      const cRows = await sql`SELECT id, background_music AS "backgroundMusic", video_settings AS "videoSettings" FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
      const tRows = await sql`SELECT id, COALESCE(video_type, 'longform') AS "videoType" FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
      channelId = cRows?.[0]?.id || null;
      topicId = tRows?.[0]?.id || null;
      channelBgMusic = cRows?.[0]?.backgroundMusic || null;
      channelVideoSettings = cRows?.[0]?.videoSettings || null;
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

      // Download channel background music if enabled
      const bgMusicConfig = payload.backgroundMusic || channelBgMusic;
      let bgMusicPath = null;
      let bgMusicVolume = 0.15;
      if (bgMusicConfig?.enabled && bgMusicConfig?.fileUrl) {
        try {
          bgMusicVolume = Number.isFinite(Number(bgMusicConfig.volume))
            ? Math.max(0, Math.min(1, Number(bgMusicConfig.volume)))
            : 0.15;
          const bgFileName = "channel_bg_music.audio";
          bgMusicPath = path.join(tmpDir, bgFileName);
          logger.log(`Downloading background music from ${bgMusicConfig.fileUrl} (Volume: ${Math.round(bgMusicVolume * 100)}%)...`);
          const bgRes = await fetch(bgMusicConfig.fileUrl);
          if (bgRes.ok) {
            fs.writeFileSync(bgMusicPath, Buffer.from(await bgRes.arrayBuffer()));
            logger.log(`Background music successfully downloaded to ${bgMusicPath}`);
          } else {
            logger.warn(`Failed to download background music: HTTP ${bgRes.status}. Continuing without music.`);
            bgMusicPath = null;
          }
        } catch (bgErr) {
          logger.warn("Could not download background music:", bgErr?.message || bgErr);
          bgMusicPath = null;
        }
      }

      // Download channel video overlay if enabled
      const vSettings = payload.videoSettings || channelVideoSettings;
      let videoOverlayPath = null;
      let videoOverlayOpacity = 1.0;

      const useVideoOverlay = Boolean(vSettings?.use_overlay ?? vSettings?.useOverlay ?? false);
      if (useVideoOverlay) {
        const overlayUrl = isShortTopic
          ? (vSettings?.shorts_overlay_url || vSettings?.shortsOverlayUrl)
          : (vSettings?.longs_overlay_url || vSettings?.longsOverlayUrl);

        const rawOpacity = isShortTopic
          ? (vSettings?.shorts_opacity ?? vSettings?.shortsOpacity)
          : (vSettings?.longs_opacity ?? vSettings?.longsOpacity);

        videoOverlayOpacity = rawOpacity !== undefined && rawOpacity !== null
          ? Math.max(0.0, Math.min(1.0, Number(rawOpacity)))
          : 1.0;

        if (overlayUrl && videoOverlayOpacity > 0) {
          try {
            logger.log(`Downloading channel video overlay (${isShortTopic ? "Shorts" : "Longs"}, Opacity: ${Math.round(videoOverlayOpacity * 100)}%) from ${overlayUrl}...`);
            const ovRes = await fetch(overlayUrl);
            if (ovRes.ok) {
              const ovFileName = "channel_video_overlay.mp4";
              videoOverlayPath = path.join(tmpDir, ovFileName);
              fs.writeFileSync(videoOverlayPath, Buffer.from(await ovRes.arrayBuffer()));
              logger.log(`Video overlay downloaded successfully to ${videoOverlayPath}`);
            } else {
              throw new Error(`Video overlay download failed with HTTP ${ovRes.status}`);
            }
          } catch (ovErr) {
            throw new Error(`Video overlay was requested but could not be downloaded: ${ovErr?.message || ovErr}`);
          }
        }
      }

      const inputArgs = [`-f concat`, `-safe 0`, `-i "${concatListPath}"`];
      let filterArgs = [];
      let extraFlags = [];

      let hasTitleCard = Boolean(titleCardPath && fs.existsSync(titleCardPath));
      let hasVideoOverlay = Boolean(videoOverlayPath && fs.existsSync(videoOverlayPath));
      let hasBgMusic = Boolean(bgMusicPath && fs.existsSync(bgMusicPath));

      let nextInputIdx = 1;
      let videoOverlayInputIdx = null;
      let titleCardInputIdx = null;
      let bgMusicInputIdx = null;

      if (hasVideoOverlay) {
        // -stream_loop -1 loops the overlay video continuously across all scenes
        inputArgs.push(`-stream_loop -1`, `-i "${videoOverlayPath}"`);
        videoOverlayInputIdx = nextInputIdx++;
      }

      if (hasTitleCard) {
        inputArgs.push(`-i "${titleCardPath}"`);
        titleCardInputIdx = nextInputIdx++;
      }

      if (hasBgMusic) {
        // -stream_loop -1 loops background music infinitely through the duration of the video
        inputArgs.push(`-stream_loop -1`, `-i "${bgMusicPath}"`);
        bgMusicInputIdx = nextInputIdx++;
      }

      if (hasBgMusic || hasVideoOverlay) {
        extraFlags.push(`-shortest`);
      }

      // Build video filter graph chaining base scaling -> overlay blending (with opacity) -> title card
      let vParts = [];
      let currentVLabel = "base_v";

      vParts.push(`[0:v]${scaleFilter}[${currentVLabel}]`);

      if (hasVideoOverlay) {
        const opacityVal = videoOverlayOpacity.toFixed(2);
        const ovPrepLabel = "ov_prep";
        const nextVLabel = "ov_blended";
        // Most film/grain overlays are opaque H.264 with a black background.
        // Screen blend makes black neutral and preserves the bright scratches/grain.
        vParts.push(
          `[${videoOverlayInputIdx}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},fps=${fps},setpts=PTS-STARTPTS,format=yuv420p[${ovPrepLabel}]`
        );
        vParts.push(`[${currentVLabel}][${ovPrepLabel}]blend=all_mode=screen:all_opacity=${opacityVal}:shortest=1[${nextVLabel}]`);
        currentVLabel = nextVLabel;
      }

      if (hasTitleCard) {
        const nextVLabel = "titled_v";
        vParts.push(`[${currentVLabel}][${titleCardInputIdx}:v]overlay=(W-w)/2:${topY}:format=auto[${nextVLabel}]`);
        currentVLabel = nextVLabel;
      }

      let videoFilterStr = vParts.join(";");
      videoFilterStr = videoFilterStr.replace(new RegExp(`\\[${currentVLabel}\\]$`), "[v]");

      if (hasBgMusic) {
        const bgVol = bgMusicVolume.toFixed(2);
        const audioFilterStr = `[${bgMusicInputIdx}:a]volume=${bgVol}[bg_vol];[0:a][bg_vol]amix=inputs=2:duration=first:dropout_transition=2[a]`;
        filterArgs = [
          `-filter_complex "${videoFilterStr};${audioFilterStr}"`,
          `-map "[v]"`,
          `-map "[a]"`,
        ];
      } else {
        filterArgs = [
          `-filter_complex "${videoFilterStr}"`,
          `-map "[v]"`,
          `-map 0:a:0?`,
        ];
      }

      const mergeCmd = [
        `"${ffmpeg}" -y`,
        ...inputArgs,
        ...filterArgs,
        ...extraFlags,
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

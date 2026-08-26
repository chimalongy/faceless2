import { task, logger } from "@trigger.dev/sdk";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

import {
  getFfmpegPath,
  getAudioDuration,
  buildKenBurnsFilter,
  buildTransitionFilter,
} from "@/lib/ffmpeg-helper";
import { uploadToR2, deleteFromR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

const execAsync = promisify(exec);

async function downloadFileToDisk(url, destination) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
}

/**
 * Core helper to render, upload, and save a single scene frame video clip.
 */
async function renderSingleScene({
  channelSlug,
  topicSlug,
  sceneIndex = 1,
  imageUrl,
  audioUrl = null,
  fps = 60,
  width = 1280,
  height = 720,
  kenBurns = {
    direction: "zoom-in",
    intensity: 0.1,
  },
  transition = "fade",
}) {
  if (!imageUrl) {
    throw new Error(`No image URL supplied for scene ${sceneIndex}.`);
  }

  const jobId = `scene_${sceneIndex}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const jobDir = path.join(os.tmpdir(), "trigger-render-frames", jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const imagePath = path.join(jobDir, `${jobId}.png`);
  const audioPath = path.join(jobDir, `${jobId}.wav`);
  const videoPath = path.join(jobDir, `${jobId}_video.mp4`);
  const finalPath = path.join(jobDir, `${jobId}_final.mp4`);

  try {
    /**
     * 1. DOWNLOAD IMAGE
     */
    logger.log(`Downloading image for scene ${sceneIndex}...`);
    await downloadFileToDisk(imageUrl, imagePath);

    /**
     * 2. AUDIO & DURATION CALCULATION
     */
    let duration = 5;
    let hasAudio = false;

    if (audioUrl) {
      try {
        logger.log(`Downloading audio for scene ${sceneIndex}...`);
        await downloadFileToDisk(audioUrl, audioPath);
        duration = await getAudioDuration(audioPath);
        hasAudio = true;
        logger.log(`Audio duration for scene ${sceneIndex}: ${duration}s`);
      } catch (err) {
        logger.warn(
          `Audio processing warning for scene ${sceneIndex}: ${err?.message || err
          }`
        );
      }
    }

    /**
     * 3. EXACT FRAME COUNT (60 FPS CFR)
     */
    duration = Math.max(1.0, Number(duration));
    const totalFrames = Math.max(2, Math.round(duration * fps));
    const exactDuration = totalFrames / fps;

    logger.log(`Scene ${sceneIndex} timing`, {
      sceneIndex,
      duration,
      fps,
      totalFrames,
      exactDuration,
    });

    /**
     * 4. BUILD FILTERS (KEN BURNS & TRANSITION)
     */
    const kenBurnsFilter = buildKenBurnsFilter(
      kenBurns,
      fps,
      totalFrames,
      width,
      height
    );

    const transitionFilter = buildTransitionFilter(
      transition,
      exactDuration
    );

    const filter = [kenBurnsFilter, transitionFilter]
      .filter(Boolean)
      .join(",");

    const ffmpeg = getFfmpegPath();

    /**
     * 5. VIDEO RENDER
     */
    const renderCommand = [
      `"${ffmpeg}"`,
      "-y",
      "-loop 1",
      `-i "${imagePath}"`,
      `-vf "${filter}"`,
      `-frames:v ${totalFrames}`,
      "-fps_mode cfr",
      "-c:v libx264",
      "-preset medium",
      "-crf 17",
      "-pix_fmt yuv420p",
      `-r ${fps}`,
      "-vsync cfr",
      "-an",
      `"${videoPath}"`,
    ].join(" ");

    logger.log(`Rendering scene ${sceneIndex} video at ${fps} FPS...`);
    await execAsync(renderCommand, {
      maxBuffer: 1024 * 1024 * 100,
    });

    if (!fs.existsSync(videoPath)) {
      throw new Error(`FFmpeg did not produce video for scene ${sceneIndex}.`);
    }

    /**
     * 6. MUX AUDIO IF AVAILABLE
     */
    if (hasAudio && fs.existsSync(audioPath)) {
      const muxCommand = [
        `"${ffmpeg}"`,
        "-y",
        `-i "${videoPath}"`,
        `-i "${audioPath}"`,
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v copy",
        "-c:a aac",
        "-b:a 192k",
        "-shortest",
        "-movflags +faststart",
        `"${finalPath}"`,
      ].join(" ");

      logger.log(`Muxing audio for scene ${sceneIndex}...`);
      await execAsync(muxCommand, {
        maxBuffer: 1024 * 1024 * 100,
      });
    } else {
      fs.copyFileSync(videoPath, finalPath);
    }

    if (!fs.existsSync(finalPath)) {
      throw new Error(`Final scene video was not generated for scene ${sceneIndex}.`);
    }

    const videoBuffer = fs.readFileSync(finalPath);
    logger.log(
      `Scene ${sceneIndex} rendered locally. Size: ${(
        videoBuffer.length /
        (1024 * 1024)
      ).toFixed(2)} MB`
    );

    /**
     * 7. CLEAN UP PREVIOUS SCENE VIDEO (R2 & DB)
     */
    try {
      const sql = getDbSql();
      if (sql && channelSlug && topicSlug && sceneIndex !== null) {
        await initDbSchema();
        const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
        const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
        const channelId = cRows?.[0]?.id || null;
        const topicId = tRows?.[0]?.id || null;

        if (channelId && topicId) {
          const oldRows = await sql`
            SELECT file_key FROM topic_assets
            WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'video' AND scene_index = ${sceneIndex};
          `;
          if (oldRows && oldRows.length > 0) {
            for (const row of oldRows) {
              if (row.file_key) {
                await deleteFromR2(row.file_key).catch(() => { });
              }
            }
            await sql`
              DELETE FROM topic_assets
              WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'video' AND scene_index = ${sceneIndex};
            `;
          }
        }
      }
    } catch (cleanErr) {
      logger.warn(
        `Could not clean up old video for scene ${sceneIndex}: ${cleanErr.message}`
      );
    }

    /**
     * 8. UPLOAD TO CLOUDFLARE R2
     */
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const r2Key = `channels/${channelSlug}/topics/${topicSlug}/videos/scene-${sceneIndex}-${timestamp}-${randomSuffix}.mp4`;

    logger.log(`Uploading scene ${sceneIndex} video to Cloudflare R2...`);

    const uploadResult = await uploadToR2({
      key: r2Key,
      buffer: videoBuffer,
      mimeType: "video/mp4",
      metadata: {
        channelSlug: channelSlug || "",
        topicSlug: topicSlug || "",
        sceneIndex: String(sceneIndex),
        duration: String(exactDuration),
        fps: String(fps),
      },
    });

    logger.log(`Scene ${sceneIndex} video uploaded to Cloudflare R2:`, {
      publicUrl: uploadResult.publicUrl,
      key: uploadResult.key,
    });

    /**
     * 9. RECORD ASSET IN NEON POSTGRESQL DB
     */
    try {
      const sql = getDbSql();
      if (sql && channelSlug && topicSlug) {
        await initDbSchema();
        const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
        const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
        const channelId = cRows?.[0]?.id || null;
        const topicId = tRows?.[0]?.id || null;

        if (channelId && topicId) {
          await sql`
            INSERT INTO topic_assets (
              topic_id,
              channel_id,
              asset_type,
              scene_index,
              file_url,
              file_key,
              file_name,
              mime_type,
              size_bytes
            ) VALUES (
              ${topicId},
              ${channelId},
              'video',
              ${sceneIndex},
              ${uploadResult.publicUrl},
              ${uploadResult.key},
              ${`${topicSlug}-scene-${sceneIndex}.mp4`},
              'video/mp4',
              ${videoBuffer.length}
            );
          `;
          logger.log(`Saved scene ${sceneIndex} video record to topic_assets in DB.`);
        }
      }
    } catch (dbErr) {
      logger.warn(
        `Could not save DB record for scene ${sceneIndex} video: ${dbErr.message}`
      );
    }

    return {
      success: true,
      sceneIndex,
      videoUrl: uploadResult.publicUrl,
      publicUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      duration: Number(exactDuration.toFixed(3)),
      fps,
      totalFrames,
      fileSize: videoBuffer.length,
    };
  } finally {
    /**
     * 10. CLEAN UP TEMP WORKSPACE
     */
    try {
      fs.rmSync(jobDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Task: Render Single Scene Frame Video
 */
export const renderSceneFrameTask = task({
  id: "render-scene-frame",
  machine: "medium-2x",
  maxDuration: 7200, // 2 hour max
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      sceneIndex = 1,
      imageUrl,
      audioUrl,
      fps = 60,
      width = 1280,
      height = 720,
      kenBurns = {
        direction: "zoom-in",
        intensity: 0.1,
      },
      transition = "fade",
    } = payload;

    logger.log(`Starting render-scene-frame task for Scene ${sceneIndex}...`, {
      channelSlug,
      topicSlug,
      sceneIndex,
      fps,
    });

    return await renderSingleScene({
      channelSlug,
      topicSlug,
      sceneIndex,
      imageUrl,
      audioUrl,
      fps,
      width,
      height,
      kenBurns,
      transition,
    });
  },
});

/**
 * Task: Render All Scene Frame Videos (Batch)
 */
export const renderAllSceneFramesTask = task({
  id: "render-all-scene-frames",
  maxDuration: 3600,
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      scenes = [],
      sceneImages = {},
      sceneAudios = {},
      fps = 60,
      width = 1280,
      height = 720,
    } = payload;

    if (!channelSlug || !topicSlug) {
      throw new Error(
        "channelSlug and topicSlug are required for render-all-scene-frames task."
      );
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error("No scenes provided to render-all-scene-frames task.");
    }

    logger.log(
      `Starting batch scene video render for ${scenes.length} scene(s)...`,
      {
        channelSlug,
        topicSlug,
        totalScenes: scenes.length,
      }
    );

    // Render all scenes concurrently in parallel
    const results = await Promise.all(
      scenes.map(async (scene) => {
        const sceneIndex =
          scene.scene_number || scene.scene_index || scene.index || 1;

        const imgData =
          sceneImages[sceneIndex] ||
          sceneImages[String(sceneIndex)] ||
          sceneImages[Number(sceneIndex)];
        const audioData =
          sceneAudios[sceneIndex] ||
          sceneAudios[String(sceneIndex)] ||
          sceneAudios[Number(sceneIndex)];

        const imageUrl = imgData?.url || scene.imageUrl || scene.visual_url || "";
        const audioUrl = audioData?.url || scene.audioUrl || null;

        if (!imageUrl) {
          logger.warn(
            `[Parallel] Skipping scene ${sceneIndex} video render because no image URL was found.`
          );
          return {
            sceneIndex,
            success: false,
            error: `No image URL found for Scene ${sceneIndex}.`,
          };
        }

        try {
          logger.log(`[Parallel] Dispatching video render for Scene ${sceneIndex}...`);
          const res = await renderSingleScene({
            channelSlug,
            topicSlug,
            sceneIndex,
            imageUrl,
            audioUrl,
            fps,
            width,
            height,
            kenBurns: scene?.ken_burns || {
              direction: "zoom-in",
              intensity: 0.1,
            },
            transition: scene?.transition || "fade",
          });

          logger.log(`[Parallel] Scene ${sceneIndex} video completed successfully!`);
          return res;
        } catch (err) {
          logger.error(
            `[Parallel] Failed to render video for Scene ${sceneIndex}: ${err.message}`
          );
          return {
            sceneIndex,
            success: false,
            error: err.message,
          };
        }
      })
    );

    const completedCount = results.filter((r) => r.success).length;
    logger.log(
      `Batch scene video render completed: ${completedCount}/${scenes.length} successful.`
    );

    return {
      success: completedCount > 0,
      channelSlug,
      topicSlug,
      totalScenes: scenes.length,
      completedVideos: completedCount,
      videos: results,
    };
  },
});

export default renderSceneFrameTask;
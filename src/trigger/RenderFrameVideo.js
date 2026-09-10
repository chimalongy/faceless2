import { allocateImageFrames } from "@/lib/scene-timing";
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
import { planSceneTiming } from "@/lib/scene-planner";


const RENDER_LOG_VERSION = "multi-image-debug-2026-09-10";

// Preserve the payload structure while hiding credentials and signed URL queries.
function redactRenderLog(value, key = "") {
  if (/credentials|database.?url|secret|token|password|authorization|api.?key|access.?key/i.test(key)) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map((item) => redactRenderLog(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactRenderLog(item, name)]));
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      url.username = "";
      url.password = "";
      if (url.search) url.search = "?REDACTED";
      url.hash = "";
      return url.toString();
    } catch { return "[INVALID URL]"; }
  }
  return value;
}

function logRenderPayload(label, payload) {
  logger.log(`[${RENDER_LOG_VERSION}] ${label}\n${JSON.stringify(redactRenderLog(payload), null, 2)}`);
}

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
  imageUrls = [],
  imagePrompts = [],
  audioText = "",
  timingPlan = null,
  audioUrl = null,
  fps = 60,
  width = 1376,
  height = 768,
  kenBurns = {
    direction: "zoom-in",
    intensity: 0.1,
  },
  transition = "fade",
  forceEqualSplit = false,
  equalTiming = false,
}) {
  let resolvedImageUrls = [];
  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    resolvedImageUrls = imageUrls.map((u) => (typeof u === "string" ? u : u?.url)).filter(Boolean);
  }
  if (resolvedImageUrls.length === 0 && imageUrl) {
    resolvedImageUrls = [imageUrl];
  }

  // Fallback: If only 1 image provided, check DB to see if multiple images were stored for this scene
  if (resolvedImageUrls.length <= 1 && channelSlug && topicSlug && sceneIndex) {
    try {
      const sql = getDbSql();
      if (sql) {
        await initDbSchema();
        const dbRows = await sql`
          SELECT ta.file_url FROM topic_assets ta
          JOIN topics t ON ta.topic_id = t.id
          JOIN channels c ON ta.channel_id = c.id
          WHERE c.slug = ${channelSlug}
            AND t.slug = ${topicSlug}
            AND ta.asset_type = 'image'
            AND ta.scene_index = ${sceneIndex}
          ORDER BY ta.file_name ASC, ta.id ASC;
        `;
        if (dbRows && dbRows.length > 1) {
          resolvedImageUrls = dbRows.map((r) => r.file_url).filter(Boolean);
          logger.log(`Found ${resolvedImageUrls.length} images in DB for scene ${sceneIndex}.`);
        }
      }
    } catch (dbErr) {
      logger.warn(`Could not check DB for additional images for scene ${sceneIndex}:`, dbErr.message);
    }
  }

  if (resolvedImageUrls.length === 0) {
    throw new Error(`No image URL supplied for scene ${sceneIndex}. Image is required.`);
  }

  if (!audioUrl) {
    throw new Error(`No audio URL supplied for scene ${sceneIndex}. Audio narration is required.`);
  }

  logRenderPayload("Resolved local scene assets", {
    channelSlug, topicSlug, sceneIndex,
    imageCount: resolvedImageUrls.length,
    uniqueImageCount: new Set(resolvedImageUrls).size,
    imageUrls: resolvedImageUrls, audioUrl, timingPlan, fps, width, height,
  });

  const jobId = `scene_${sceneIndex}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const jobDir = path.join(os.tmpdir(), "trigger-render-frames", jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const audioPath = path.join(jobDir, `${jobId}.wav`);
  const videoPath = path.join(jobDir, `${jobId}_video.mp4`);
  const finalPath = path.join(jobDir, `${jobId}_final.mp4`);

  try {
    /**
     * 1. AUDIO & DURATION CALCULATION
     */
    logger.log(`Downloading audio for scene ${sceneIndex}...`);
    await downloadFileToDisk(audioUrl, audioPath);
    let duration = await getAudioDuration(audioPath, { strict: true });
    const hasAudio = true;

    /**
     * 2. EXACT FRAME COUNT (60 FPS CFR)
     */
    duration = Number(duration);
    const totalFrames = Math.max(2, Math.round(duration * fps));
    const exactDuration = totalFrames / fps;
    const ffmpeg = getFfmpegPath();
    const N = resolvedImageUrls.length;

    logger.log(`Scene ${sceneIndex} timing`, {
      sceneIndex,
      duration,
      fps,
      totalFrames,
      exactDuration,
      imageCount: N,
    });

    /**
     * 3. VIDEO RENDER (Single vs Multi-Image)
     */
    if (N <= 1) {
      // Single-image rendering
      const imagePath = path.join(jobDir, `${jobId}.png`);
      logger.log(`Downloading image for scene ${sceneIndex}...`);
      await downloadFileToDisk(resolvedImageUrls[0], imagePath);

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

      logger.log(`Rendering scene ${sceneIndex} video (1 image) at ${fps} FPS...`);
      await execAsync(renderCommand, {
        maxBuffer: 1024 * 1024 * 100,
      });
    } else {
      // Multi-image rendering: obtain planned timings via Whisper + ScenePlanner LLM
      let timings = timingPlan;
      if (!timings || !Array.isArray(timings) || timings.length !== N) {
        try {
          const imagesInput = resolvedImageUrls.map((url, idx) => ({
            image_number: idx + 1,
            prompt: Array.isArray(imagePrompts) && imagePrompts[idx]
              ? (typeof imagePrompts[idx] === "string" ? imagePrompts[idx] : imagePrompts[idx]?.prompt || `Scene image ${idx + 1}`)
              : `Scene image ${idx + 1}`,
            url,
          }));

          logger.log(`Planning scene timing with Whisper & ScenePlanner LLM for Scene ${sceneIndex} (${N} images)...`);
          timings = await planSceneTiming({
            sceneNumber: sceneIndex,
            audioText,
            audioUrl,
            audioDuration: duration,
            images: imagesInput,
            channelSlug,
            topicSlug,
            forceEqualSplit: Boolean(forceEqualSplit || equalTiming),
          });
        } catch (planErr) {
          logger.warn(`Scene timing planning failed for scene ${sceneIndex}, using equal proportional fallback:`, planErr.message);
        }
      }

      // Calculate frame count per segment ensuring strict totalFrames match
      const segFramesList = allocateImageFrames(timings, N, totalFrames, fps);
      logger.log(`Scene ${sceneIndex} image allocation`, { imageCount: N, totalFrames, segmentFrames: segFramesList });
      logRenderPayload("Local FFmpeg segment plan", {
        sceneIndex, audioDuration: duration, totalFrames, fps,
        timings,
        segments: resolvedImageUrls.map((url, i) => ({
          image_number: i + 1, url, frames: segFramesList[i],
          duration: segFramesList[i] / fps,
        })),
      });

      const segmentFiles = [];

      const directionsPool = [
        "zoom-in",
        "pan-right",
        "zoom-out",
        "pan-left",
        "pan-up",
        "pan-down",
      ];
      const baseDir = (typeof kenBurns === "string" ? kenBurns : kenBurns?.direction) || "zoom-in";
      const baseIdx = Math.max(0, directionsPool.indexOf(baseDir));

      for (let k = 0; k < N; k++) {
        const segFrames = segFramesList[k];
        const segDuration = segFrames / fps;
        const segImgPath = path.join(jobDir, `image_${k}.png`);
        const segVideoPath = path.join(jobDir, `segment_${k}.mp4`);

        logger.log(
          `Downloading and rendering image ${k + 1}/${N} for Scene ${sceneIndex} (${segFrames} frames, ${segDuration.toFixed(2)}s)...`
        );
        await downloadFileToDisk(resolvedImageUrls[k], segImgPath);

        const imgDirection = directionsPool[(baseIdx + k) % directionsPool.length];
        const segKenBurns = {
          direction: imgDirection,
          intensity: kenBurns?.intensity || 0.10,
        };

        const segKbFilter = buildKenBurnsFilter(
          segKenBurns,
          fps,
          segFrames,
          width,
          height
        );

        // Apply scene transition only to final segment
        let segTransitionFilter = "";
        if (k === N - 1) {
          segTransitionFilter = buildTransitionFilter(transition, segDuration);
        }

        const segFilter = [segKbFilter, segTransitionFilter].filter(Boolean).join(",");

        const segCommand = [
          `"${ffmpeg}"`,
          "-y",
          "-loop 1",
          `-i "${segImgPath}"`,
          `-vf "${segFilter}"`,
          `-frames:v ${segFrames}`,
          "-fps_mode cfr",
          "-c:v libx264",
          "-preset medium",
          "-crf 17",
          "-pix_fmt yuv420p",
          `-r ${fps}`,
          "-vsync cfr",
          "-an",
          `"${segVideoPath}"`,
        ].join(" ");

        await execAsync(segCommand, {
          maxBuffer: 1024 * 1024 * 100,
        });

        if (!fs.existsSync(segVideoPath)) {
          throw new Error(`FFmpeg failed to produce segment ${k + 1} for scene ${sceneIndex}.`);
        }

        segmentFiles.push(segVideoPath);
      }

      // Concat all segments using FFmpeg filtergraph concat for seamless continuous timestamps
      const inputs = segmentFiles.map((f) => `-i "${f}"`).join(" ");
      const filterInputs = segmentFiles.map((_, idx) => `[${idx}:v]`).join("");
      const filterComplex = `"${filterInputs}concat=n=${N}:v=1:a=0[v]"`;

      logger.log(`Concatenating ${N} image segments for Scene ${sceneIndex} via filtergraph concat...`);
      const concatCommand = [
        `"${ffmpeg}"`,
        "-y",
        inputs,
        `-filter_complex ${filterComplex}`,
        '-map "[v]"',
        "-c:v libx264",
        "-preset veryfast",
        "-crf 17",
        "-pix_fmt yuv420p",
        "-fps_mode cfr",
        `-r ${fps}`,
        "-vsync cfr",
        "-an",
        `"${videoPath}"`,
      ].join(" ");

      await execAsync(concatCommand, {
        maxBuffer: 1024 * 1024 * 100,
      });
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`FFmpeg did not produce video for scene ${sceneIndex}.`);
    }

    /**
     * 4. MUX AUDIO IF AVAILABLE
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
    logRenderPayload("Trigger renderer input (local FFmpeg; no Modal request)", payload);
    const {
      channelSlug,
      topicSlug,
      sceneIndex = 1,
      imageUrl,
      imageUrls = [],
      imagePrompts = [],
      audioText = "",
      timingPlan = null,
      audioUrl,
      fps = 60,
      width = 1376,
      height = 768,
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
      imageCount: Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls.length : 1,
    });

    return await renderSingleScene({
      channelSlug,
      topicSlug,
      sceneIndex,
      imageUrl,
      imageUrls,
      imagePrompts,
      audioText,
      timingPlan,
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
 * Task: Render All Scene Frame Videos (Concurrent Multi-Machine Batch)
 * Spawns an isolated machine instance for each individual scene using batchTriggerAndWait.
 * All scenes render simultaneously across separate worker machines without shared memory limits.
 */
export const renderAllSceneFramesTask = task({
  id: "render-all-scene-frames",
  maxDuration: 7200, // 2 hour max
  run: async (payload) => {
    logRenderPayload("Trigger renderer input (local FFmpeg; no Modal request)", payload);
    const {
      channelSlug,
      topicSlug,
      scenes = [],
      sceneImages = {},
      sceneAudios = {},
      fps = 60,
      width = 1376,
      height = 768,
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
      `Preparing concurrent multi-machine batch render for ${scenes.length} scene(s)...`,
      {
        channelSlug,
        topicSlug,
        totalScenes: scenes.length,
      }
    );

    // 1. Build payload for each separate scene
    const batchPayloads = [];
    const skippedResults = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneIndex =
        scene.scene_number || scene.scene_index || scene.index || (i + 1);

      const imgData =
        sceneImages[sceneIndex] ||
        sceneImages[String(sceneIndex)] ||
        sceneImages[Number(sceneIndex)];
      const audioData =
        sceneAudios[sceneIndex] ||
        sceneAudios[String(sceneIndex)] ||
        sceneAudios[Number(sceneIndex)];

      // Collect all image URLs & prompts for this scene
      let imageUrls = [];
      let imagePrompts = [];
      if (Array.isArray(imgData?.images) && imgData.images.length > 0) {
        imageUrls = imgData.images
          .map((img) => (typeof img === "string" ? img : img?.url))
          .filter(Boolean);
        imagePrompts = imgData.images
          .map((img) => (typeof img === "object" ? (img.prompt || img.description || "") : ""))
          .filter(Boolean);
      } else if (Array.isArray(scene?.images) && scene.images.length > 0) {
        imageUrls = scene.images
          .map((img) => (typeof img === "string" ? img : img?.url))
          .filter(Boolean);
        imagePrompts = scene.images
          .map((img) => (typeof img === "object" ? (img.prompt || img.description || "") : ""))
          .filter(Boolean);
      } else if (Array.isArray(scene?.imageUrls) && scene.imageUrls.length > 0) {
        imageUrls = scene.imageUrls.filter(Boolean);
      }

      const imageUrl = imgData?.url || scene.imageUrl || scene.visual_url || imageUrls[0] || "";
      if (imageUrls.length === 0 && imageUrl) {
        imageUrls = [imageUrl];
      }
      const audioUrl = audioData?.url || scene.audioUrl || null;
      const audioText = scene.narration || scene.audio_text || scene.audioText || scene.text || "";

      if (!imageUrl || !audioUrl) {
        logger.warn(
          `Skipping scene ${sceneIndex} because it does not have both an image and audio (hasImage: ${!!imageUrl}, hasAudio: ${!!audioUrl}).`
        );
        skippedResults.push({
          sceneIndex,
          success: false,
          skipped: true,
          error: `Scene ${sceneIndex} skipped: Requires both image and voice audio to render video.`,
        });
        continue;
      }

      batchPayloads.push({
        payload: {
          channelSlug,
          topicSlug,
          sceneIndex,
          imageUrl,
          imageUrls,
          imagePrompts,
          audioText,
          audioUrl,
          fps,
          width,
          height,
          kenBurns: scene?.ken_burns || {
            direction: "zoom-in",
            intensity: 0.1,
          },
          transition: scene?.transition || "fade",
        },
      });
    }

    if (batchPayloads.length === 0) {
      return {
        success: false,
        channelSlug,
        topicSlug,
        totalScenes: scenes.length,
        completedVideos: 0,
        videos: skippedResults,
      };
    }

    logger.log(
      `Dispatching ${batchPayloads.length} separate concurrent machine instances via batchTriggerAndWait...`
    );

    // 2. Trigger all scenes simultaneously across isolated worker instances and await results
    const batch = await renderSceneFrameTask.batchTriggerAndWait(batchPayloads);

    logger.log(
      `All ${batch.runs?.length || 0} concurrent machine instances finished execution.`
    );

    // 3. Process results from all instances
    const renderedResults = (batch.runs || []).map((run, idx) => {
      const sceneIndex = batchPayloads[idx]?.payload?.sceneIndex || idx + 1;
      if (run.ok) {
        return run.output;
      } else {
        logger.error(`Instance for Scene ${sceneIndex} failed:`, { error: run.error });
        return {
          sceneIndex,
          success: false,
          error: run.error?.message || "Task instance failed",
        };
      }
    });

    const allResults = [...renderedResults, ...skippedResults].sort(
      (a, b) => (a.sceneIndex || 0) - (b.sceneIndex || 0)
    );

    const completedCount = allResults.filter((r) => r.success).length;
    logger.log(
      `Concurrent batch render summary: ${completedCount}/${scenes.length} successful.`
    );

    return {
      success: completedCount > 0,
      channelSlug,
      topicSlug,
      totalScenes: scenes.length,
      completedVideos: completedCount,
      videos: allResults,
    };
  },
});

export default renderSceneFrameTask;
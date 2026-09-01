import { task, logger } from "@trigger.dev/sdk";
import { getDbSql, initDbSchema } from "@/lib/db";

const DEFAULT_MODAL_API_URL =
  process.env.MODAL_RENDERER_API_URL ||
  "https://me-chimaobi--faceless-video-renderer-api.modal.run";

/**
 * Helper to dynamically resolve Modal API URL from general_settings table in Neon DB
 */
async function resolveModalApiUrl(passedUrl) {
  if (passedUrl && typeof passedUrl === "string" && passedUrl.trim().length > 0) {
    return passedUrl.trim();
  }

  try {
    const sql = getDbSql();
    if (sql) {
      await initDbSchema();
      const rows = await sql`
        SELECT modal_video_render_url AS "modalVideoRenderUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;
      if (rows?.[0]?.modalVideoRenderUrl) {
        return rows[0].modalVideoRenderUrl.trim();
      }
    }
  } catch (err) {
    logger.warn("Could not query modal_video_render_url from DB:", err.message);
  }

  return (process.env.MODAL_RENDERER_API_URL || DEFAULT_MODAL_API_URL).trim();
}

/**
 * Trigger.dev task to render scene frame video clips on Modal backend.
 * Submits scene data and credentials to Modal API, polls for job completion,
 * and persists/returns the resulting video clips.
 */
export const renderFrameVideoModalTask = task({
  id: "render-frame-video-modal",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      sceneIndex,
      imageUrl,
      audioUrl,
      kenBurns,
      transition = "fade",
      scenes = [],
      sceneImages = {},
      sceneAudios = {},
      fps = 60,
      width = 1376,
      height = 768,
      renderConcurrency = 4,
      downloadConcurrency = 12,
      modalApiUrl,
    } = payload;

    if (!channelSlug || !topicSlug) {
      throw new Error("channelSlug and topicSlug are required.");
    }

    const resolvedEndpoint = await resolveModalApiUrl(modalApiUrl);
    const endpoint = resolvedEndpoint.replace(/\/+$/, "");

    // 1. Build standardized scenes array for Modal
    let scenesToRender = [];

    if (sceneIndex !== undefined) {
      // Single scene request
      if (!imageUrl || !audioUrl) {
        throw new Error(
          `Scene ${sceneIndex} requires both an imageUrl and an audioUrl.`
        );
      }
      const kbDir =
        (typeof kenBurns === "string" ? kenBurns : kenBurns?.direction) ||
        "zoom-in";
      scenesToRender = [
        {
          scene_number: parseInt(sceneIndex, 10),
          imageUrl: imageUrl.trim(),
          audioUrl: audioUrl.trim(),
          ken_burns: {
            direction: kbDir,
          },
          transition: transition || "fade",
        },
      ];
    } else if (Array.isArray(scenes) && scenes.length > 0) {
      // Batch scenes request
      scenesToRender = scenes
        .map((s, idx) => {
          const sNum = s.scene_number || idx + 1;
          const imgObj =
            sceneImages[sNum] ||
            sceneImages[String(sNum)] ||
            sceneImages[Number(sNum)];
          const audObj =
            sceneAudios[sNum] ||
            sceneAudios[String(sNum)] ||
            sceneAudios[Number(sNum)];

          const imgUrl = (s.imageUrl || s.image_url || imgObj?.url || "").trim();
          const audUrl = (s.audioUrl || s.audio_url || audObj?.url || "").trim();

          if (!imgUrl || !audUrl) {
            return null; // Skip scenes missing either image or audio
          }

          const kb = s.ken_burns || s.kenBurns;
          const kbDir =
            (typeof kb === "string" ? kb : kb?.direction) || "zoom-in";
          return {
            scene_number: parseInt(sNum, 10),
            imageUrl: imgUrl,
            audioUrl: audUrl,
            ken_burns: {
              direction: kbDir,
            },
            transition: s.transition || "fade",
          };
        })
        .filter(Boolean);

      if (scenesToRender.length === 0) {
        throw new Error(
          "None of the provided scenes have both an image URL and an audio URL ready for rendering."
        );
      }
    } else {
      throw new Error(
        "Provide either sceneIndex (for single scene) or scenes array (for batch rendering)."
      );
    }

    logger.log(`Preparing Modal video rendering for ${scenesToRender.length} scene(s)...`, {
      channelSlug,
      topicSlug,
      endpoint,
      sceneNumbers: scenesToRender.map((s) => s.scene_number),
    });

    // 2. Prepare credentials and configuration payload
    const tokenVal = (
      process.env.CLOUDFLARE_TOKEN_VALUE ||
      process.env.CLOUDFLARE_TOKEN_ ||
      process.env.CLOUDFLARE_API_TOKEN ||
      "none"
    ).trim();

    const requestBody = {
      credentials: {
        DATABASE_URL: (process.env.DATABASE_URL || "").trim(),
        CLOUDFLARE_R2_ACCOUNT_ID: (process.env.CLOUDFLARE_R2_ACCOUNT_ID || "").trim(),
        CLOUDFLARE_R2_ACCESS_KEY_ID: (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim(),
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim(),
        CLOUDFLARE_R2_BUCKET_NAME: (process.env.CLOUDFLARE_R2_BUCKET_NAME || "faceless-media").trim(),
        CLOUDFLARE_R2_PUBLIC_URL: (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim(),
        CLOUDFLARE_TOKEN_: tokenVal,
      },
      KEN_BURNS_ZOOM_AMOUNT: parseFloat(process.env.KEN_BURNS_ZOOM_AMOUNT || "0.15"),
      KEN_BURNS_PAN_ZOOM: parseFloat(process.env.KEN_BURNS_PAN_ZOOM || "1.10"),
      channelSlug,
      topicSlug,
      fps: parseInt(fps || 60, 10),
      width: parseInt(width || 1376, 10),
      height: parseInt(height || 768, 10),
      renderConcurrency: parseInt(renderConcurrency || 4, 10),
      downloadConcurrency: parseInt(downloadConcurrency || 12, 10),
      scenes: scenesToRender,
    };

    // 3. Submit render job to Modal
    const renderUrl = `${endpoint}/render`;
    logger.log(`Submitting render request to Modal: ${renderUrl}`);

    const submitRes = await fetch(renderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const submitJson = await submitRes.json().catch(() => ({}));

    if (!submitRes.ok) {
      const errorMsg =
        submitJson.error ||
        submitJson.message ||
        `Modal submission failed with status ${submitRes.status}: ${JSON.stringify(submitJson)}`;
      logger.error("Modal submission error:", { error: errorMsg, status: submitRes.status });
      throw new Error(errorMsg);
    }

    const jobId = submitJson.jobId;
    if (!jobId) {
      throw new Error(
        `Modal did not return a jobId in submission response: ${JSON.stringify(submitJson)}`
      );
    }

    logger.log(`Modal job submitted successfully. Job ID: ${jobId}. Polling status...`);

    // 4. Poll Modal job status until completion
    const jobUrl = `${endpoint}/jobs/${encodeURIComponent(jobId)}`;
    const pollIntervalMs = 2000;
    const maxPollTimeMs = 15 * 60 * 1000; // 15 minutes timeout
    const startTime = Date.now();

    let jobResult = null;

    while (Date.now() - startTime < maxPollTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      try {
        const pollRes = await fetch(jobUrl);
        const pollJson = await pollRes.json().catch(() => ({}));

        if (pollRes.status === 200 && pollJson.status === "completed") {
          logger.log(`Modal job ${jobId} completed successfully!`, pollJson.result);
          jobResult = pollJson.result || pollJson;
          break;
        } else if (pollJson.status === "failed" || pollRes.status >= 400) {
          const failMsg =
            pollJson.error ||
            pollJson.message ||
            `Modal job ${jobId} failed with status: ${pollJson.status}`;
          logger.error(`Modal job ${jobId} failed:`, failMsg);
          throw new Error(failMsg);
        } else {
          // Status is "submitted", "processing", or HTTP 202
          logger.log(
            `Modal job ${jobId} in progress (status: ${pollJson.status || pollRes.status})...`
          );
        }
      } catch (pollErr) {
        if (pollErr.message && pollErr.message.includes("Modal job")) {
          throw pollErr;
        }
        logger.warn(`Polling warning for job ${jobId}:`, pollErr.message);
      }
    }

    if (!jobResult) {
      throw new Error(
        `Modal render job timed out after ${maxPollTimeMs / 1000}s without completion.`
      );
    }

    // 5. Ensure records are synced to Neon database (topic_assets)
    const sql = getDbSql();
    if (sql) {
      try {
        await initDbSchema();
        const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
        const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
        const channelId = cRows?.[0]?.id || null;
        const topicId = tRows?.[0]?.id || null;

        const renderedVideos = jobResult.videos || [];
        for (const vid of renderedVideos) {
          if (vid.success && vid.sceneIndex && vid.publicUrl && channelId && topicId) {
            const fileName = vid.fileName || `scene-${vid.sceneIndex}.mp4`;
            const fileKey = vid.key || `channels/${channelSlug}/topics/${topicSlug}/videos/${fileName}`;

            // Clean up previous record if exists
            await sql`
              DELETE FROM topic_assets
              WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'video' AND scene_index = ${vid.sceneIndex};
            `.catch(() => {});

            // Insert updated video asset
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
                ${vid.sceneIndex},
                ${vid.publicUrl || vid.videoUrl},
                ${fileKey},
                ${fileName},
                'video/mp4',
                ${vid.fileSize || 0}
              );
            `.catch((dbErr) => logger.warn(`DB sync error for scene ${vid.sceneIndex}:`, dbErr.message));
          }
        }
      } catch (syncErr) {
        logger.warn("Database sync warning after Modal render:", syncErr.message);
      }
    }

    // 6. Format standardized output for frontend
    const outputVideos = (jobResult.videos || []).map((v) => ({
      sceneIndex: v.sceneIndex,
      videoUrl: v.videoUrl || v.publicUrl,
      publicUrl: v.publicUrl || v.videoUrl,
      key: v.key,
      fileName: v.fileName || `scene-${v.sceneIndex}.mp4`,
      duration: v.duration,
      fps: v.fps || 60,
      fileSize: v.fileSize,
      success: v.success,
    }));

    return {
      success: true,
      jobId,
      channelSlug,
      topicSlug,
      totalScenes: jobResult.totalScenes || outputVideos.length,
      completedVideos: jobResult.completedVideos || outputVideos.length,
      failedVideos: jobResult.failedVideos || 0,
      videos: outputVideos,
      // If single scene, also provide top-level videoUrl and sceneIndex for compatibility
      ...(sceneIndex !== undefined && outputVideos[0]
        ? {
            sceneIndex: outputVideos[0].sceneIndex,
            videoUrl: outputVideos[0].videoUrl,
            publicUrl: outputVideos[0].publicUrl,
            key: outputVideos[0].key,
            fileName: outputVideos[0].fileName,
            duration: outputVideos[0].duration,
          }
        : {}),
    };
  },
});

export default renderFrameVideoModalTask;

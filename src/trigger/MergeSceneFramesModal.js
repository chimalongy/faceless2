import { task, logger, wait } from "@trigger.dev/sdk";
import { getDbSql, initDbSchema } from "@/lib/db";

const DEFAULT_MODAL_MERGER_API_URL =
  process.env.MODAL_SCENE_MERGER_URL ||
  "https://chima-geniusdomains--faceless-scene-merger-api.modal.run";

/**
 * Resolve the Modal Scene Merger API URL.
 *
 * Priority:
 * 1. modalMergerApiUrl / modalApiUrl supplied in the task payload
 * 2. modal_scene_merger_url stored in general_settings
 * 3. MODAL_SCENE_MERGER_URL environment variable
 * 4. DEFAULT_MODAL_MERGER_API_URL
 */
async function resolveModalMergerApiUrl(passedUrl) {
  if (
    passedUrl &&
    typeof passedUrl === "string" &&
    passedUrl.trim().length > 0
  ) {
    return passedUrl.trim();
  }

  try {
    const sql = getDbSql();

    if (sql) {
      await initDbSchema();

      const rows = await sql`
        SELECT modal_scene_merger_url AS "modalSceneMergerUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;

      if (rows?.[0]?.modalSceneMergerUrl) {
        return rows[0].modalSceneMergerUrl.trim();
      }
    }
  } catch (error) {
    logger.warn("Could not query Modal Scene Merger URL from database.", {
      error: error?.message || String(error),
    });
  }

  return (
    process.env.MODAL_SCENE_MERGER_URL || DEFAULT_MODAL_MERGER_API_URL
  ).trim();
}

/**
 * Trigger.dev task that:
 *
 * 1. Formats scene video records for Modal scene merger
 * 2. Injects credentials and sends request to the Modal merger container
 * 3. Polls Modal status using checkpointable wait.for()
 * 4. Verifies/updates Neon database topic_assets & topics.master_video_url
 * 5. Returns completed master video metadata
 */
export const mergeSceneFramesModalTask = task({
  id: "merge-scene-frames-modal",

  // 3 hours max duration for long merges
  maxDuration: 10800,

  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      sceneVideos = [],
      resolution = "1080p",
      fps = 60,
      downloadConcurrency = 8,
      ffmpegThreads = 16,
      preset = "veryfast",
      crf = 19,
      audioBitrate = "192k",
      modalApiUrl,
      modalMergerApiUrl,
    } = payload;

    if (!channelSlug || !topicSlug) {
      throw new Error("channelSlug and topicSlug are required.");
    }

    const resolvedEndpoint = await resolveModalMergerApiUrl(
      modalMergerApiUrl || modalApiUrl
    );
    const endpoint = resolvedEndpoint.replace(/\/+$/, "");

    logger.log(`Resolving scene videos for merge topic ${channelSlug}/${topicSlug}...`, {
      endpoint,
      providedVideosCount: Array.isArray(sceneVideos) ? sceneVideos.length : 0,
      resolution,
    });

    // 1. Prepare scene videos array (or let Modal pull from DB)
    let formattedSceneVideos = [];

    if (Array.isArray(sceneVideos) && sceneVideos.length > 0) {
      formattedSceneVideos = sceneVideos
        .map((scene, index) => {
          const sceneNumber =
            scene.scene_number ??
            scene.sceneIndex ??
            scene.scene_index ??
            scene.index ??
            index + 1;

          const videoUrl = (
            scene.video_url ||
            scene.videoUrl ||
            scene.url ||
            scene.publicUrl ||
            ""
          ).trim();

          const videoKey = (
            scene.video_key ||
            scene.videoKey ||
            scene.key ||
            ""
          ).trim();

          if (!videoUrl && !videoKey) {
            return null;
          }

          return {
            scene_number: Number.parseInt(sceneNumber, 10),
            video_url: videoUrl,
            video_key: videoKey,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.scene_number - b.scene_number);
    }

    // 2. Load credentials
    const cloudflareToken = (
      process.env.CLOUDFLARE_TOKEN_VALUE ||
      process.env.CLOUDFLARE_TOKEN_ ||
      process.env.CLOUDFLARE_API_TOKEN ||
      ""
    ).trim();

    const databaseUrl = (process.env.DATABASE_URL || "").trim();
    const r2AccountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || "").trim();
    const r2AccessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim();
    const r2SecretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim();
    const r2BucketName = (process.env.CLOUDFLARE_R2_BUCKET_NAME || "").trim();
    const r2PublicUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim();

    const missingValues = [];
    if (!databaseUrl) missingValues.push("DATABASE_URL");
    if (!r2AccountId) missingValues.push("CLOUDFLARE_R2_ACCOUNT_ID");
    if (!r2AccessKeyId) missingValues.push("CLOUDFLARE_R2_ACCESS_KEY_ID");
    if (!r2SecretAccessKey) missingValues.push("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    if (!r2BucketName) missingValues.push("CLOUDFLARE_R2_BUCKET_NAME");
    if (!r2PublicUrl) missingValues.push("CLOUDFLARE_R2_PUBLIC_URL");

    if (missingValues.length > 0) {
      throw new Error(
        `Missing required credentials for Modal scene merge: ${missingValues.join(", ")}`
      );
    }

    const normResolution = String(resolution || "1080p").toLowerCase().trim() === "720p" ? "720p" : "1080p";

    const requestBody = {
      credentials: {
        DATABASE_URL: databaseUrl,
        CLOUDFLARE_R2_ACCOUNT_ID: r2AccountId,
        CLOUDFLARE_R2_ACCESS_KEY_ID: r2AccessKeyId,
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: r2SecretAccessKey,
        CLOUDFLARE_R2_BUCKET_NAME: r2BucketName,
        CLOUDFLARE_R2_PUBLIC_URL: r2PublicUrl,
        CLOUDFLARE_TOKEN_: cloudflareToken,
      },
      channelSlug,
      topicSlug,
      sceneVideos: formattedSceneVideos,
      resolution: normResolution,
      fps: Number.parseInt(fps || 60, 10),
      downloadConcurrency: Number.parseInt(downloadConcurrency || 8, 10),
      ffmpegThreads: Number.parseInt(ffmpegThreads || 16, 10),
      preset: String(preset || "veryfast").trim().toLowerCase(),
      crf: Number.parseInt(crf ?? 19, 10),
      audioBitrate: String(audioBitrate || "192k").trim().toLowerCase(),
    };

    // 3. Submit merge request to Modal
    const mergeUrl = `${endpoint}/merge`;

    logger.log("Submitting merge request to Modal scene merger service...", {
      mergeUrl,
      channelSlug,
      topicSlug,
      sceneCount: formattedSceneVideos.length,
      resolution: normResolution,
    });

    let submitResponse;

    try {
      submitResponse = await fetch(mergeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      throw new Error(
        `Could not connect to the Modal scene merger endpoint: ${
          error?.message || String(error)
        }`
      );
    }

    const submitJson = await submitResponse.json().catch(() => ({}));

    if (!submitResponse.ok) {
      const errorMessage =
        submitJson.detail ||
        submitJson.error ||
        submitJson.message ||
        `Modal merge submission failed with HTTP ${submitResponse.status}.`;

      logger.error("Modal scene merger submission failed.", {
        status: submitResponse.status,
        error: errorMessage,
      });

      throw new Error(
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage)
      );
    }

    const jobId = submitJson.jobId || submitJson.job_id;

    if (!jobId) {
      throw new Error(
        `Modal did not return a jobId for merge: ${JSON.stringify(submitJson)}`
      );
    }

    logger.log("Modal merge job submitted successfully. Starting polling...", {
      jobId,
    });

    // 4. Poll Modal for job completion
    const jobUrl = `${endpoint}/jobs/${encodeURIComponent(jobId)}`;
    const pollIntervalSeconds = 30;
    const maxPollTimeMs = 2.5 * 60 * 60 * 1000; // 2.5 hours timeout
    const pollingStartedAt = Date.now();

    let jobResult = null;

    while (Date.now() - pollingStartedAt < maxPollTimeMs) {
      try {
        const pollResponse = await fetch(jobUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(30_000),
        });

        const pollJson = await pollResponse.json().catch(() => ({}));

        const elapsedSeconds = Math.round(
          (Date.now() - pollingStartedAt) / 1000
        );

        if (pollResponse.ok && pollJson.status === "completed") {
          logger.log(`Modal merge job ${jobId} completed successfully!`, {
            elapsedSeconds,
            result: pollJson.result,
          });

          jobResult = pollJson.result || pollJson.data || pollJson;
          break;
        }

        if (pollJson.status === "failed" || pollJson.status === "error") {
          const failureMessage =
            pollJson.detail ||
            pollJson.error ||
            pollJson.message ||
            `Modal merge job ${jobId} failed.`;

          logger.error(`Modal merge job ${jobId} failed.`, {
            status: pollJson.status,
            error: failureMessage,
          });

          throw new Error(
            typeof failureMessage === "string"
              ? failureMessage
              : JSON.stringify(failureMessage)
          );
        }

        if (pollResponse.status === 404) {
          throw new Error(
            `Modal merge job ${jobId} was not found on the container.`
          );
        }

        if (!pollResponse.ok && pollResponse.status < 500) {
          const pollingError =
            pollJson.detail ||
            pollJson.error ||
            pollJson.message ||
            `Modal merge status request failed with HTTP ${pollResponse.status}.`;

          throw new Error(
            typeof pollingError === "string"
              ? pollingError
              : JSON.stringify(pollingError)
          );
        }

        logger.log(`Modal merge job ${jobId} is processing...`, {
          status: pollJson.status || pollResponse.status,
          elapsedSeconds,
        });
      } catch (pollError) {
        const pollMessage = pollError?.message || String(pollError);

        const isTemporaryNetworkError =
          pollError?.name === "AbortError" ||
          pollError?.name === "TimeoutError" ||
          pollMessage.toLowerCase().includes("operation was aborted") ||
          pollMessage.toLowerCase().includes("fetch failed") ||
          pollMessage.toLowerCase().includes("network");

        if (!isTemporaryNetworkError) {
          throw pollError;
        }

        logger.warn(`Temporary polling error for Modal merge job ${jobId}.`, {
          error: pollMessage,
        });
      }

      await wait.for({
        seconds: pollIntervalSeconds,
      });
    }

    if (!jobResult) {
      throw new Error(
        `Modal merge job ${jobId} did not complete within ${
          maxPollTimeMs / 1000
        } seconds.`
      );
    }

    // 5. Ensure master video is updated in Neon database
    const finalVideoUrl = jobResult.videoUrl || jobResult.publicUrl || jobResult.video_url || jobResult.public_url;
    const finalKey = jobResult.key || jobResult.file_key || `channels/${channelSlug}/topics/${topicSlug}/master/${jobResult.fileName || "merged-master.mp4"}`;
    const finalFileName = jobResult.fileName || jobResult.file_name || `${topicSlug}-master-${normResolution}.mp4`;
    const finalDuration = Number.parseFloat(jobResult.duration || 0);
    const finalSizeBytes = Number.parseInt(jobResult.sizeBytes || jobResult.size_bytes || 0, 10);
    const finalSceneCount = Number.parseInt(jobResult.sceneCount || jobResult.scene_count || formattedSceneVideos.length, 10);

    const sql = getDbSql();
    if (sql && finalVideoUrl) {
      try {
        await initDbSchema();
        const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
        const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
        const channelId = cRows?.[0]?.id || null;
        const topicId = tRows?.[0]?.id || null;

        if (channelId && topicId) {
          // Delete prior completed video asset
          await sql`
            DELETE FROM topic_assets
            WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'completedvideo';
          `.catch(() => {});

          // Insert newly merged video asset
          await sql`
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
              ${finalVideoUrl},
              ${finalKey},
              ${finalFileName},
              'video/mp4',
              ${finalSizeBytes}
            );
          `.catch((dbErr) => logger.warn("DB topic_assets master insertion warning:", dbErr.message));

          // Update topics.master_video_url
          await sql`
            UPDATE topics
            SET master_video_url = ${finalVideoUrl}, updated_at = NOW()
            WHERE id = ${topicId};
          `.catch((dbErr) => logger.warn("DB topics master_video_url update warning:", dbErr.message));
        }
      } catch (syncErr) {
        logger.warn("Database sync warning after Modal merge completion:", syncErr.message);
      }
    }

    return {
      success: true,
      jobId,
      channelSlug,
      topicSlug,
      videoUrl: finalVideoUrl,
      publicUrl: finalVideoUrl,
      key: finalKey,
      fileName: finalFileName,
      duration: finalDuration,
      sceneCount: finalSceneCount,
      sceneOrder: jobResult.sceneOrder || jobResult.scene_order || [],
      sizeBytes: finalSizeBytes,
      resolution: jobResult.resolution || normResolution,
      fps: jobResult.fps || fps,
    };
  },
});

export default mergeSceneFramesModalTask;

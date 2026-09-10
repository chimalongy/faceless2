import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getAudioDuration } from "@/lib/ffmpeg-helper";
import { task, logger, wait } from "@trigger.dev/sdk";
import { getDbSql, initDbSchema } from "@/lib/db";
import { planSceneTiming, normalizeTimings } from "@/lib/scene-planner";


// Probe a downloaded narration; URL contents never enter a shell command.
async function measureNarrationDuration(audioUrl) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "scene-audio-probe-"));
  try {
    const response = await fetch(audioUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Audio download failed: HTTP ${response.status}`);
    const audioPath = path.join(directory, "narration.audio");
    await fs.writeFile(audioPath, Buffer.from(await response.arrayBuffer()));
    return await getAudioDuration(audioPath, { strict: true });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

const DEFAULT_MODAL_API_URL =
  process.env.MODAL_RENDERER_API_URL ||
  "https://me-chimaobi--faceless-video-renderer-api.modal.run";

/**
 * Resolve the Modal API URL.
 *
 * Priority:
 * 1. modalApiUrl supplied in the task payload
 * 2. modal_video_render_url stored in general_settings
 * 3. MODAL_RENDERER_API_URL environment variable
 * 4. DEFAULT_MODAL_API_URL
 */
async function resolveModalApiUrl(passedUrl) {
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
        SELECT modal_video_render_url AS "modalVideoRenderUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;

      if (rows?.[0]?.modalVideoRenderUrl) {
        return rows[0].modalVideoRenderUrl.trim();
      }
    }
  } catch (error) {
    logger.warn("Could not query Modal URL from database.", {
      error: error?.message || String(error),
    });
  }

  return (
    process.env.MODAL_RENDERER_API_URL || DEFAULT_MODAL_API_URL
  ).trim();
}

/**
 * Trigger.dev task that:
 *
 * 1. Builds the scene payload
 * 2. Sends the entire render request to one Modal container
 * 3. Polls Modal using checkpointable Trigger.dev waits
 * 4. Waits for up to three hours
 * 5. Updates topic_assets after rendering
 * 6. Returns all generated videos
 */
export const renderFrameVideoModalTask = task({
  id: "render-frame-video-modal",

  // This must be longer than maxPollTimeMs below.
  // 11,100 seconds = 3 hours and 5 minutes.
  maxDuration: 11100,

  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,

      // Single-scene fields
      sceneIndex,
      imageUrl,
      imageUrls = [],
      audioUrl,
      kenBurns,
      transition = "fade",

      // Batch-scene fields
      scenes = [],
      sceneImages = {},
      sceneAudios = {},

      // Rendering configuration
      fps = 60,
      width = 1376,
      height = 768,
      renderConcurrency = 4,
      downloadConcurrency = 12,

      // Optional Modal URL override
      modalApiUrl,
    } = payload;

    if (!channelSlug || !topicSlug) {
      throw new Error("channelSlug and topicSlug are required.");
    }

    const resolvedEndpoint = await resolveModalApiUrl(modalApiUrl);
    const endpoint = resolvedEndpoint.replace(/\/+$/, "");

    /*
     * Build the standardized scenes array that Modal expects.
     *
     * This supports:
     * - One scene using sceneIndex, imageUrl/imageUrls and audioUrl
     * - Multiple scenes using the scenes array
     */
    let scenesToRender = [];

    if (sceneIndex !== undefined && sceneIndex !== null) {
      let resolvedImageUrls = Array.isArray(imageUrls) && imageUrls.length > 0
        ? imageUrls.map((u) => (typeof u === "string" ? u : u?.url)).filter(Boolean)
        : (imageUrl ? [imageUrl.trim()] : []);

      // DB fallback if only 1 image provided
      if (resolvedImageUrls.length <= 1 && channelSlug && topicSlug) {
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
                AND ta.scene_index = ${Number.parseInt(sceneIndex, 10)}
              ORDER BY ta.file_name ASC, ta.id ASC;
            `;
            if (dbRows && dbRows.length > 1) {
              resolvedImageUrls = dbRows.map((r) => r.file_url).filter(Boolean);
            }
          }
        } catch (_) {}
      }

      if (resolvedImageUrls.length === 0) {
        throw new Error(
          `Scene ${sceneIndex} requires an imageUrl or imageUrls.`
        );
      }
      if (!audioUrl) {
        throw new Error(
          `Scene ${sceneIndex} requires an audioUrl.`
        );
      }

      const kenBurnsDirection =
        (typeof kenBurns === "string"
          ? kenBurns
          : kenBurns?.direction) || "zoom-in";

      scenesToRender = [
        {
          scene_number: Number.parseInt(sceneIndex, 10),
          imageUrl: resolvedImageUrls[0] || (imageUrl || "").trim(),
          imageUrls: resolvedImageUrls,
          imagePrompts: payload.imagePrompts || [],
          audioText: (payload.audioText || payload.narration || "").trim(),
          audioUrl: audioUrl.trim(),
          ken_burns: {
            direction: kenBurnsDirection,
          },
          transition: transition || "fade",
        },
      ];
    } else if (Array.isArray(scenes) && scenes.length > 0) {
      scenesToRender = scenes
        .map((scene, index) => {
          const sceneNumber =
            scene.scene_number ??
            scene.sceneIndex ??
            scene.scene_index ??
            index + 1;

          const imageAsset =
            sceneImages[sceneNumber] ??
            sceneImages[String(sceneNumber)] ??
            sceneImages[Number(sceneNumber)];

          const audioAsset =
            sceneAudios[sceneNumber] ??
            sceneAudios[String(sceneNumber)] ??
            sceneAudios[Number(sceneNumber)];

          let resolvedImageUrls = [];
          if (Array.isArray(imageAsset?.images) && imageAsset.images.length > 0) {
            resolvedImageUrls = imageAsset.images
              .map((img) => (typeof img === "string" ? img : img?.url))
              .filter(Boolean);
          } else if (Array.isArray(scene?.images) && scene.images.length > 0) {
            resolvedImageUrls = scene.images
              .map((img) => (typeof img === "string" ? img : img?.url))
              .filter(Boolean);
          } else if (Array.isArray(scene?.imageUrls) && scene.imageUrls.length > 0) {
            resolvedImageUrls = scene.imageUrls.filter(Boolean);
          }

          const resolvedImageUrl = (
            resolvedImageUrls[0] ||
            scene.imageUrl ||
            scene.image_url ||
            imageAsset?.url ||
            ""
          ).trim();

          if (resolvedImageUrls.length === 0 && resolvedImageUrl) {
            resolvedImageUrls = [resolvedImageUrl];
          }

          const resolvedAudioUrl = (
            scene.audioUrl ||
            scene.audio_url ||
            audioAsset?.url ||
            ""
          ).trim();

          if (!resolvedImageUrl || !resolvedAudioUrl) {
            logger.warn(`Skipping scene ${sceneNumber}.`, {
              reason: "Scene does not have both an image URL and audio URL.",
              hasImage: Boolean(resolvedImageUrl),
              hasAudio: Boolean(resolvedAudioUrl),
            });

            return null;
          }

          let scenePrompts = [];
          if (Array.isArray(scene?.images)) {
            scenePrompts = scene.images
              .map((img) => (typeof img === "object" ? (img.prompt || img.description || "") : ""))
              .filter(Boolean);
          } else if (Array.isArray(imageAsset?.images)) {
            scenePrompts = imageAsset.images
              .map((img) => (typeof img === "object" ? (img.prompt || img.description || "") : ""))
              .filter(Boolean);
          }

          const sceneAudioText = (
            scene.narration ||
            scene.audio_text ||
            scene.audioText ||
            scene.text ||
            ""
          ).trim();

          const sceneKenBurns =
            scene.ken_burns || scene.kenBurns;

          const kenBurnsDirection =
            (typeof sceneKenBurns === "string"
              ? sceneKenBurns
              : sceneKenBurns?.direction) || "zoom-in";

          return {
            scene_number: Number.parseInt(sceneNumber, 10),
            imageUrl: resolvedImageUrl,
            imageUrls: resolvedImageUrls,
            imagePrompts: scenePrompts,
            audioText: sceneAudioText,
            audioUrl: resolvedAudioUrl,
            ken_burns: {
              direction: kenBurnsDirection,
            },
            transition: scene.transition || "fade",
          };
        })
        .filter(Boolean);

      // Augment with DB assets for multi-image scenes if any scene only has 1 image
      try {
        const sql = getDbSql();
        if (sql && channelSlug && topicSlug) {
          await initDbSchema();
          const dbRows = await sql`
            SELECT ta.scene_index, ta.file_url FROM topic_assets ta
            JOIN topics t ON ta.topic_id = t.id
            JOIN channels c ON ta.channel_id = c.id
            WHERE c.slug = ${channelSlug}
              AND t.slug = ${topicSlug}
              AND ta.asset_type = 'image'
            ORDER BY ta.scene_index ASC, ta.file_name ASC, ta.id ASC;
          `;
          if (dbRows && dbRows.length > 0) {
            const dbMap = {};
            for (const row of dbRows) {
              const sIdx = Number(row.scene_index);
              if (!dbMap[sIdx]) dbMap[sIdx] = [];
              if (row.file_url) dbMap[sIdx].push(row.file_url);
            }
            for (const s of scenesToRender) {
              if ((!s.imageUrls || s.imageUrls.length <= 1) && dbMap[s.scene_number]?.length > 1) {
                s.imageUrls = dbMap[s.scene_number];
                s.imageUrl = s.imageUrls[0];
              }
            }
          }
        }
      } catch (_) {}

      if (scenesToRender.length === 0) {
        throw new Error(
          "None of the provided scenes have both an image URL and an audio URL."
        );
      }
    } else {
      throw new Error(
        "Provide either sceneIndex for a single scene or a scenes array for batch rendering."
      );
    }

    // Keep each URL and its timing together in the outgoing payload.
    for (const scene of scenesToRender) {
      const duration = await measureNarrationDuration(scene.audioUrl);
      const images = scene.imageUrls.map((url, index) => ({
        image_number: index + 1,
        url,
        prompt: scene.imagePrompts?.[index] || `Scene image ${index + 1}`,
      }));
      let timings = null;
      if (images.length > 1) {
        try {
          timings = await planSceneTiming({
            sceneNumber: scene.scene_number,
            audioText: scene.audioText || "",
            audioUrl: scene.audioUrl,
            audioDuration: duration,
            images,
            channelSlug,
            topicSlug,
          });
        } catch (error) {
          logger.warn(`Timing planning failed for scene ${scene.scene_number}; using equal durations.`, {
            error: error?.message || String(error),
          });
        }
      }
      timings = normalizeTimings(timings, images, duration);
      scene.imageConfiguration = images.map((image, index) => ({
        image_number: image.image_number,
        start_time: timings[index].start_time,
        end_time: timings[index].end_time,
        duration: timings[index].duration,
        image_url: image.url,
      }));
      delete scene.imageUrl;
      delete scene.imageUrls;
      delete scene.imagePrompts;
      delete scene.imageTimings;
    }

    logger.log(
      `Preparing Modal video rendering for ${scenesToRender.length} scene(s).`,
      {
        channelSlug,
        topicSlug,
        endpoint,
        sceneNumbers: scenesToRender.map(
          (scene) => scene.scene_number
        ),
      }
    );

    /*
     * Load values that will be passed through the request to Modal.
     *
     * These environment variables are stored on Trigger.dev and sent
     * to the Modal FastAPI endpoint in the JSON request.
     */
    const cloudflareToken = (
      process.env.CLOUDFLARE_TOKEN_VALUE ||
      process.env.CLOUDFLARE_TOKEN_ ||
      process.env.CLOUDFLARE_API_TOKEN ||
      ""
    ).trim();

    const databaseUrl = (
      process.env.DATABASE_URL || ""
    ).trim();

    const r2AccountId = (
      process.env.CLOUDFLARE_R2_ACCOUNT_ID || ""
    ).trim();

    const r2AccessKeyId = (
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || ""
    ).trim();

    const r2SecretAccessKey = (
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ""
    ).trim();

    const r2BucketName = (
      process.env.CLOUDFLARE_R2_BUCKET_NAME || ""
    ).trim();

    const r2PublicUrl = (
      process.env.CLOUDFLARE_R2_PUBLIC_URL || ""
    ).trim();

    const kenBurnsZoomAmount = Number.parseFloat(
      process.env.KEN_BURNS_ZOOM_AMOUNT || ""
    );

    const kenBurnsPanZoom = Number.parseFloat(
      process.env.KEN_BURNS_PAN_ZOOM || ""
    );

    /*
     * Validate all required values before sending anything to Modal.
     *
     * The two Ken Burns values are mandatory. The task returns an error
     * without starting a Modal render if either one is missing or invalid.
     */
    const missingValues = [];

    if (!databaseUrl) {
      missingValues.push("DATABASE_URL");
    }

    if (!r2AccountId) {
      missingValues.push("CLOUDFLARE_R2_ACCOUNT_ID");
    }

    if (!r2AccessKeyId) {
      missingValues.push("CLOUDFLARE_R2_ACCESS_KEY_ID");
    }

    if (!r2SecretAccessKey) {
      missingValues.push("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    }

    if (!r2BucketName) {
      missingValues.push("CLOUDFLARE_R2_BUCKET_NAME");
    }

    if (!r2PublicUrl) {
      missingValues.push("CLOUDFLARE_R2_PUBLIC_URL");
    }

    if (!process.env.KEN_BURNS_ZOOM_AMOUNT?.trim()) {
      missingValues.push("KEN_BURNS_ZOOM_AMOUNT");
    } else if (!Number.isFinite(kenBurnsZoomAmount)) {
      missingValues.push(
        "KEN_BURNS_ZOOM_AMOUNT must be a valid number"
      );
    }

    if (!process.env.KEN_BURNS_PAN_ZOOM?.trim()) {
      missingValues.push("KEN_BURNS_PAN_ZOOM");
    } else if (!Number.isFinite(kenBurnsPanZoom)) {
      missingValues.push(
        "KEN_BURNS_PAN_ZOOM must be a valid number"
      );
    }

    if (missingValues.length > 0) {
      throw new Error(
        `Missing or invalid Modal render configuration: ${missingValues.join(
          ", "
        )}`
      );
    }

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

      // These are required by the Modal endpoint.
      KEN_BURNS_ZOOM_AMOUNT: kenBurnsZoomAmount,
      KEN_BURNS_PAN_ZOOM: kenBurnsPanZoom,

      channelSlug,
      topicSlug,

      fps: Number.parseInt(fps, 10),
      width: Number.parseInt(width, 10),
      height: Number.parseInt(height, 10),

      // Parallel rendering happens inside one Modal container.
      renderConcurrency: Number.parseInt(
        renderConcurrency,
        10
      ),
      downloadConcurrency: Number.parseInt(
        downloadConcurrency,
        10
      ),

      scenes: scenesToRender,
    };

    /*
     * Submit the render job to Modal.
     */
    const renderUrl = `${endpoint}/render`;

    logger.log(`Submitting render request to Modal.`, {
      renderUrl,
      sceneCount: scenesToRender.length,
      renderConcurrency: requestBody.renderConcurrency,
      downloadConcurrency: requestBody.downloadConcurrency,
    });

    let submitResponse;

    try {
      logger.log(JSON.stringify({ ...requestBody, credentials: "[REDACTED]" }, null, 2));

      submitResponse = await fetch(renderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      throw new Error(
        `Could not connect to the Modal render endpoint: ${
          error?.message || String(error)
        }`
      );
    }

    const submitJson = await submitResponse
      .json()
      .catch(() => ({}));

    if (!submitResponse.ok) {
      const errorMessage =
        submitJson.detail ||
        submitJson.error ||
        submitJson.message ||
        `Modal submission failed with HTTP ${submitResponse.status}.`;

      logger.error("Modal render submission failed.", {
        status: submitResponse.status,
        error: errorMessage,
      });

      throw new Error(
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage)
      );
    }

    const jobId =
      submitJson.jobId ||
      submitJson.job_id;

    if (!jobId) {
      throw new Error(
        `Modal did not return a jobId: ${JSON.stringify(
          submitJson
        )}`
      );
    }

    logger.log(
      `Modal render job submitted successfully.`,
      {
        jobId,
      }
    );

    /*
     * Poll Modal until the background render finishes.
     *
     * wait.for() is checkpointable. It does not continuously occupy
     * a Trigger.dev worker while waiting between status requests.
     *
     * A 65-second interval also prevents excessive calls to Modal.
     */
    const jobUrl = `${endpoint}/jobs/${encodeURIComponent(
      jobId
    )}`;

    const pollIntervalSeconds = 65;
    const maxPollTimeMs = 3 * 60 * 60 * 1000;
    const pollingStartedAt = Date.now();

    let jobResult = null;

    while (
      Date.now() - pollingStartedAt < maxPollTimeMs
    ) {
      try {
        const pollResponse = await fetch(jobUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(30_000),
        });

        const pollJson = await pollResponse
          .json()
          .catch(() => ({}));

        const elapsedSeconds = Math.round(
          (Date.now() - pollingStartedAt) / 1000
        );

        if (
          pollResponse.ok &&
          pollJson.status === "completed"
        ) {
          logger.log(
            `Modal job ${jobId} completed successfully.`,
            {
              elapsedSeconds,
            }
          );

          jobResult =
            pollJson.result ||
            pollJson.data ||
            pollJson;

          break;
        }

        if (
          pollJson.status === "failed" ||
          pollJson.status === "error"
        ) {
          const failureMessage =
            pollJson.detail ||
            pollJson.error ||
            pollJson.message ||
            `Modal job ${jobId} failed.`;

          logger.error(`Modal job ${jobId} failed.`, {
            status: pollJson.status,
            error: failureMessage,
          });

          throw new Error(
            typeof failureMessage === "string"
              ? failureMessage
              : JSON.stringify(failureMessage)
          );
        }

        /*
         * A 404 is considered permanent because Modal no longer knows
         * about this job. Other 5xx responses are treated as temporary.
         */
        if (pollResponse.status === 404) {
          throw new Error(
            `Modal job ${jobId} was not found. The Modal container may have restarted and lost its in-memory job status.`
          );
        }

        if (
          !pollResponse.ok &&
          pollResponse.status < 500
        ) {
          const pollingError =
            pollJson.detail ||
            pollJson.error ||
            pollJson.message ||
            `Modal status request failed with HTTP ${pollResponse.status}.`;

          throw new Error(
            typeof pollingError === "string"
              ? pollingError
              : JSON.stringify(pollingError)
          );
        }

        logger.log(
          `Modal job ${jobId} is still processing.`,
          {
            status:
              pollJson.status ||
              pollResponse.status,
            elapsedSeconds,
          }
        );
      } catch (pollError) {
        const pollMessage =
          pollError?.message || String(pollError);

        const isTemporaryNetworkError =
          pollError?.name === "AbortError" ||
          pollError?.name === "TimeoutError" ||
          pollMessage
            .toLowerCase()
            .includes("operation was aborted") ||
          pollMessage
            .toLowerCase()
            .includes("fetch failed") ||
          pollMessage
            .toLowerCase()
            .includes("network");

        if (!isTemporaryNetworkError) {
          throw pollError;
        }

        logger.warn(
          `Temporary polling error for Modal job ${jobId}.`,
          {
            error: pollMessage,
            elapsedSeconds: Math.round(
              (Date.now() - pollingStartedAt) / 1000
            ),
          }
        );
      }

      await wait.for({
        seconds: pollIntervalSeconds,
      });
    }

    if (!jobResult) {
      throw new Error(
        `Modal render job ${jobId} did not complete within ${
          maxPollTimeMs / 1000
        } seconds. Check the existing Modal job before submitting another render.`
      );
    }

    /*
     * Normalize the response from Modal.
     */
    const renderedVideos = Array.isArray(
      jobResult.videos
    )
      ? jobResult.videos
      : [];

    /*
     * Synchronize completed videos to Neon.
     *
     * Modal may already update the database. This provides a second
     * synchronization layer for compatibility with the existing app.
     */
    const sql = getDbSql();

    if (sql) {
      try {
        await initDbSchema();

        const channelRows = await sql`
          SELECT id
          FROM channels
          WHERE slug = ${channelSlug}
          LIMIT 1;
        `;

        const topicRows = await sql`
          SELECT id
          FROM topics
          WHERE slug = ${topicSlug}
          LIMIT 1;
        `;

        const channelId =
          channelRows?.[0]?.id || null;

        const topicId =
          topicRows?.[0]?.id || null;

        if (!channelId || !topicId) {
          logger.warn(
            "Could not synchronize rendered videos because the channel or topic was not found.",
            {
              channelSlug,
              topicSlug,
              channelFound: Boolean(channelId),
              topicFound: Boolean(topicId),
            }
          );
        } else {
          for (const video of renderedVideos) {
            const renderedSceneIndex =
              video.sceneIndex ??
              video.scene_index ??
              video.sceneNumber ??
              video.scene_number;

            const publicUrl =
              video.publicUrl ||
              video.public_url ||
              video.videoUrl ||
              video.video_url;

            const videoSucceeded =
              video.success !== false &&
              Boolean(publicUrl);

            if (
              !videoSucceeded ||
              renderedSceneIndex === undefined ||
              renderedSceneIndex === null
            ) {
              continue;
            }

            const fileName =
              video.fileName ||
              video.file_name ||
              `scene-${renderedSceneIndex}.mp4`;

            const fileKey =
              video.key ||
              video.fileKey ||
              video.file_key ||
              `channels/${channelSlug}/topics/${topicSlug}/videos/${fileName}`;

            const fileSize =
              video.fileSize ||
              video.file_size ||
              video.size_bytes ||
              0;

            /*
             * Remove the old scene video before inserting the replacement.
             */
            await sql`
              DELETE FROM topic_assets
              WHERE topic_id = ${topicId}
                AND channel_id = ${channelId}
                AND asset_type = 'video'
                AND scene_index = ${renderedSceneIndex};
            `;

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
              )
              VALUES (
                ${topicId},
                ${channelId},
                'video',
                ${renderedSceneIndex},
                ${publicUrl},
                ${fileKey},
                ${fileName},
                'video/mp4',
                ${fileSize}
              );
            `;
          }
        }
      } catch (syncError) {
        /*
         * Rendering has already completed, so a database synchronization
         * failure is logged without discarding the successful render result.
         */
        logger.warn(
          "Database synchronization warning after Modal rendering.",
          {
            error:
              syncError?.message ||
              String(syncError),
          }
        );
      }
    }

    /*
     * Return a stable response format to the caller.
     */
    const outputVideos = renderedVideos.map(
      (video) => {
        const outputSceneIndex =
          video.sceneIndex ??
          video.scene_index ??
          video.sceneNumber ??
          video.scene_number;

        const outputVideoUrl =
          video.videoUrl ||
          video.video_url ||
          video.publicUrl ||
          video.public_url;

        const outputPublicUrl =
          video.publicUrl ||
          video.public_url ||
          outputVideoUrl;

        return {
          sceneIndex: outputSceneIndex,
          videoUrl: outputVideoUrl,
          publicUrl: outputPublicUrl,
          key:
            video.key ||
            video.fileKey ||
            video.file_key,
          fileName:
            video.fileName ||
            video.file_name ||
            `scene-${outputSceneIndex}.mp4`,
          duration: video.duration,
          fps: video.fps || requestBody.fps,
          fileSize:
            video.fileSize ||
            video.file_size ||
            video.size_bytes,
          success: video.success !== false,
          error: video.error || null,
        };
      }
    );

    const successfulVideos =
      outputVideos.filter(
        (video) => video.success
      );

    const failedVideos =
      outputVideos.filter(
        (video) => !video.success
      );

    const response = {
      success: failedVideos.length === 0,
      jobId,
      channelSlug,
      topicSlug,
      totalScenes:
        jobResult.totalScenes ??
        jobResult.total_scenes ??
        outputVideos.length,
      completedVideos:
        jobResult.completedVideos ??
        jobResult.completed_videos ??
        successfulVideos.length,
      failedVideos:
        jobResult.failedVideos ??
        jobResult.failed_videos ??
        failedVideos.length,
      videos: outputVideos,
    };

    /*
     * Preserve compatibility with callers that expect a single-scene
     * result at the top level.
     */
    if (
      sceneIndex !== undefined &&
      sceneIndex !== null &&
      outputVideos[0]
    ) {
      response.sceneIndex =
        outputVideos[0].sceneIndex;
      response.videoUrl =
        outputVideos[0].videoUrl;
      response.publicUrl =
        outputVideos[0].publicUrl;
      response.key = outputVideos[0].key;
      response.fileName =
        outputVideos[0].fileName;
      response.duration =
        outputVideos[0].duration;
    }

    return response;
  },
});

export default renderFrameVideoModalTask;
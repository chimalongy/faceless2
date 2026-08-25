import { task, logger } from "@trigger.dev/sdk";
import { generateImage } from "@/lib/image-generator";
import { uploadToR2, deleteFromR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

export const generateSceneImagesTask = task({
  id: "generate-scene-images",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      scenes = [],
      sceneIndex = null,
      prompt = "",
      globalThemePrompt = "",
      width = 1664,
      height = 928,
      numInferenceSteps = 50,
      seed = 42,
    } = payload;

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required and must be passed to generate-scene-images task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required and must be passed to generate-scene-images task.");
    }

    // Support both single scene invocation and batch array invocation
    let sceneList = [];
    const isSingleScene = sceneIndex !== null && sceneIndex !== undefined;

    if (Array.isArray(scenes) && scenes.length > 0) {
      sceneList = scenes;
    } else if (isSingleScene && prompt) {
      sceneList = [
        {
          scene_number: sceneIndex,
          image_prompt: prompt,
          width,
          height,
          numInferenceSteps,
          seed,
        },
      ];
    } else {
      throw new Error("Either a valid scenes array or (sceneIndex + prompt) is required for generate-scene-images task.");
    }

    logger.log(`Starting scene images generation task for ${sceneList.length} scene(s)...`, {
      channelSlug,
      topicSlug,
      totalScenes: sceneList.length,
      isSingleScene,
    });

    // Helper to generate an individual scene image
    async function processSingleScene(scene) {
      const currentSceneIndex = scene.scene_number || scene.scene_index || scene.index || 1;

      // Skip if this scene was already flagged as having an image (batch mode only)
      if (!isSingleScene && (scene.existingImageUrl || scene.hasImage)) {
        logger.log(`Skipping scene ${currentSceneIndex} because image already exists.`);
        return {
          sceneIndex: currentSceneIndex,
          success: true,
          skipped: true,
          publicUrl: scene.existingImageUrl || "",
        };
      }

      const scenePromptText = scene.image_prompt || scene.prompt || scene.visual_prompt || scene.description || "";
      const fullPrompt = `${globalThemePrompt} ${scenePromptText}`.trim();

      if (!fullPrompt) {
        logger.warn(`Skipping scene ${currentSceneIndex} due to empty prompt.`);
        return {
          sceneIndex: currentSceneIndex,
          success: false,
          error: "Empty prompt",
        };
      }

      logger.log(`[Parallel] Dispatching generation for Scene ${currentSceneIndex}...`);

      try {
        const genResult = await generateImage({
          prompt: fullPrompt,
          width: scene.width || width,
          height: scene.height || height,
          numInferenceSteps: scene.numInferenceSteps || numInferenceSteps,
          seed: scene.seed !== undefined ? scene.seed : seed,
        });

        // Clean up previous scene image from Cloudflare R2 and Neon DB if regenerating
        try {
          const sql = getDbSql();
          if (sql && currentSceneIndex !== null) {
            await initDbSchema();
            const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
            const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
            const channelId = cRows?.[0]?.id || null;
            const topicId = tRows?.[0]?.id || null;

            if (channelId && topicId) {
              const oldRows = await sql`
                SELECT file_key FROM topic_assets
                WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'image' AND scene_index = ${currentSceneIndex};
              `;
              if (oldRows && oldRows.length > 0) {
                for (const row of oldRows) {
                  if (row.file_key) {
                    await deleteFromR2(row.file_key).catch(() => {});
                  }
                }
                await sql`
                  DELETE FROM topic_assets
                  WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'image' AND scene_index = ${currentSceneIndex};
                `;
              }
            }
          }
        } catch (cleanErr) {
          logger.warn(`Could not clean up old image before saving new one for scene ${currentSceneIndex}:`, cleanErr.message);
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const key = `channels/${channelSlug}/topics/${topicSlug}/images/scene-${currentSceneIndex}-${timestamp}-${randomSuffix}.png`;

        const uploadResult = await uploadToR2({
          key,
          buffer: genResult.imageBuffer,
          mimeType: "image/png",
          metadata: {
            channelSlug,
            topicSlug,
            sceneIndex: String(currentSceneIndex),
            endpointUsed: genResult.endpointUsed,
          },
        });

        // Record in DB
        try {
          const sql = getDbSql();
          if (sql) {
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
                  'image',
                  ${currentSceneIndex},
                  ${uploadResult.publicUrl},
                  ${uploadResult.key},
                  ${`${topicSlug}-scene-${currentSceneIndex}.png`},
                  'image/png',
                  ${genResult.imageBuffer.length}
                );
              `;
            }
          }
        } catch (dbErr) {
          logger.warn(`Could not save DB record for scene ${currentSceneIndex}:`, { error: dbErr.message });
        }

        logger.log(`[Parallel] Scene ${currentSceneIndex} completed successfully!`);

        return {
          sceneIndex: currentSceneIndex,
          success: true,
          imageUrl: uploadResult.publicUrl,
          publicUrl: uploadResult.publicUrl,
          key: uploadResult.key,
          endpointUsed: genResult.endpointUsed,
          remainingUsage: genResult.remainingUsage,
        };
      } catch (err) {
        logger.error(`[Parallel] Failed to generate image for scene ${currentSceneIndex}:`, { error: err.message });
        return {
          sceneIndex: currentSceneIndex,
          success: false,
          error: err.message,
        };
      }
    }

    // Run ALL scenes concurrently in parallel
    const results = await Promise.all(sceneList.map((scene) => processSingleScene(scene)));

    const completedCount = results.filter((r) => r.success && !r.skipped).length;
    logger.log(`Completed ${completedCount}/${sceneList.length} scene image generations.`);

    // If single scene mode, provide top-level convenient properties as well
    const singleResult = isSingleScene && results.length > 0 ? results[0] : null;

    return {
      success: isSingleScene ? Boolean(singleResult?.success) : true,
      channelSlug,
      topicSlug,
      totalScenes: sceneList.length,
      completedFrames: completedCount,
      frames: results,
      results,
      ...(singleResult
        ? {
            sceneIndex: singleResult.sceneIndex,
            imageUrl: singleResult.imageUrl || singleResult.publicUrl,
            publicUrl: singleResult.publicUrl,
            key: singleResult.key,
            endpointUsed: singleResult.endpointUsed,
            remainingUsage: singleResult.remainingUsage,
            error: singleResult.error,
          }
        : {}),
    };
  },
});

export default generateSceneImagesTask;

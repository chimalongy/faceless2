import { task, logger } from "@trigger.dev/sdk";
import { generateImage } from "@/lib/image-generator";
import { uploadToR2, deleteFromR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";
import { getImageIndex } from "@/lib/scene-images";

export const generateSceneImagesTask = task({
  id: "generate-scene-images",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      scenes = [],
      sceneIndex = null,
      imageIndex = null,
      prompt = "",
      globalThemePrompt = "",
      width = 1376,
      height = 768,
      numInferenceSteps = 50,
      seed = 42,
    } = payload;

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required and must be passed to generate-scene-images task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required and must be passed to generate-scene-images task.");
    }

    // Support both single scene/frame invocation and batch array invocation
    let sceneList = [];
    const isSingleScene = sceneIndex !== null && sceneIndex !== undefined;

    if (Array.isArray(scenes) && scenes.length > 0) {
      sceneList = scenes;
    } else if (isSingleScene && prompt) {
      sceneList = [
        {
          scene_number: sceneIndex,
          imageIndex: imageIndex ? Number(imageIndex) : 1,
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

    // Expand scenes into individual frame generation tasks to support multiple images per scene
    const frameTasks = [];

    for (let sIdx = 0; sIdx < sceneList.length; sIdx++) {
      const scene = sceneList[sIdx];
      const sNum = scene.scene_number || scene.scene_index || scene.index || (sIdx + 1);

      if (isSingleScene) {
        const targetFrameIndex = imageIndex ? Number(imageIndex) : (scene.imageIndex ? Number(scene.imageIndex) : 1);
        frameTasks.push({
          sceneNumber: sNum,
          imageIndex: targetFrameIndex,
          prompt: scene.image_prompt || prompt,
          seed: scene.seed !== undefined ? scene.seed : seed,
          width: scene.width || width,
          height: scene.height || height,
          numInferenceSteps: scene.numInferenceSteps || numInferenceSteps,
          hasMultiple: targetFrameIndex > 1,
          hasImage: false,
          existingImageUrl: "",
        });
      } else if (Array.isArray(scene.images) && scene.images.length > 0) {
        const hasMultiple = scene.images.length > 1 || Number(scene.number_of_images) > 1;
        scene.images.forEach((imgDef, i) => {
          const fIndex = imgDef.image_number ? Number(imgDef.image_number) : (i + 1);
          frameTasks.push({
            sceneNumber: sNum,
            imageIndex: fIndex,
            prompt: imgDef.image_prompt || imgDef.prompt || scene.image_prompt || "",
            seed: imgDef.seed !== undefined ? imgDef.seed : scene.seed,
            width: scene.width || width,
            height: scene.height || height,
            numInferenceSteps: scene.numInferenceSteps || numInferenceSteps,
            hasMultiple: hasMultiple || fIndex > 1,
            hasImage: Boolean(imgDef.hasImage),
            existingImageUrl: imgDef.existingImageUrl || imgDef.url || "",
          });
        });
      } else {
        const hasMultiple = Number(scene.number_of_images) > 1;
        frameTasks.push({
          sceneNumber: sNum,
          imageIndex: scene.imageIndex || 1,
          prompt: scene.image_prompt || scene.prompt || scene.visual_prompt || scene.description || "",
          seed: scene.seed,
          width: scene.width || width,
          height: scene.height || height,
          numInferenceSteps: scene.numInferenceSteps || numInferenceSteps,
          hasMultiple,
          hasImage: Boolean(scene.hasImage),
          existingImageUrl: scene.existingImageUrl || scene.url || "",
        });
      }
    }

    logger.log(`Starting image generation task: ${frameTasks.length} frame(s) across ${sceneList.length} scene(s)...`, {
      channelSlug,
      topicSlug,
      totalScenes: sceneList.length,
      totalFrames: frameTasks.length,
      isSingleScene,
    });

    // Helper to generate an individual frame
    async function processSingleFrame(taskItem) {
      const currentSceneIndex = taskItem.sceneNumber;
      const currentFrameIndex = taskItem.imageIndex;

      // Skip if this specific frame was already flagged as having an image (batch mode only)
      if (!isSingleScene && (taskItem.hasImage || taskItem.existingImageUrl)) {
        logger.log(`Skipping Scene ${currentSceneIndex} Frame #${currentFrameIndex} because image already exists.`);
        return {
          sceneIndex: currentSceneIndex,
          imageIndex: currentFrameIndex,
          success: true,
          skipped: true,
          publicUrl: taskItem.existingImageUrl || "",
        };
      }

      const scenePromptText = taskItem.prompt || "";
      const fullPrompt = `${globalThemePrompt} ${scenePromptText}`.trim();

      if (!fullPrompt) {
        logger.warn(`Skipping Scene ${currentSceneIndex} Frame #${currentFrameIndex} due to empty prompt.`);
        return {
          sceneIndex: currentSceneIndex,
          imageIndex: currentFrameIndex,
          success: false,
          error: "Empty prompt",
        };
      }

      logger.log(`[Sequential] Generating Scene ${currentSceneIndex} Frame #${currentFrameIndex}...`);

      try {
        const resolvedSeed =
          taskItem.seed !== undefined && taskItem.seed !== null
            ? Number(taskItem.seed)
            : Math.floor(Math.random() * 2147483647) + 1;

        const genResult = await generateImage({
          prompt: fullPrompt,
          width: taskItem.width || width,
          height: taskItem.height || height,
          numInferenceSteps: taskItem.numInferenceSteps || numInferenceSteps,
          seed: resolvedSeed,
        });

        // Clean up previous image asset ONLY for this specific frame of this scene
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
                SELECT id, file_key, file_name FROM topic_assets
                WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'image' AND scene_index = ${currentSceneIndex};
              `;
              if (oldRows && oldRows.length > 0) {
                for (const row of oldRows) {
                  const rowFrameIdx = getImageIndex(row.file_name, currentSceneIndex);
                  if (rowFrameIdx === currentFrameIndex) {
                    if (row.file_key) {
                      await deleteFromR2(row.file_key).catch(() => {});
                    }
                    await sql`
                      DELETE FROM topic_assets
                      WHERE id = ${row.id};
                    `;
                  }
                }
              }
            }
          }
        } catch (cleanErr) {
          logger.warn(`Could not clean up old image for scene ${currentSceneIndex} frame ${currentFrameIndex}:`, cleanErr.message);
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const isMulti = taskItem.hasMultiple || currentFrameIndex > 1;
        const imageSuffix = isMulti ? `-${currentFrameIndex}` : "";
        const assetFileName = `scene-${currentSceneIndex}${imageSuffix}.png`;
        const key = `channels/${channelSlug}/topics/${topicSlug}/images/scene-${currentSceneIndex}${imageSuffix}-${timestamp}-${randomSuffix}.png`;

        const uploadResult = await uploadToR2({
          key,
          buffer: genResult.imageBuffer,
          mimeType: "image/png",
          metadata: {
            channelSlug,
            topicSlug,
            sceneIndex: String(currentSceneIndex),
            imageIndex: String(currentFrameIndex),
            endpointUsed: genResult.endpointUsed,
          },
        });

        // Record in Neon DB
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
                  ${assetFileName},
                  'image/png',
                  ${genResult.imageBuffer.length}
                );
              `;
            }
          }
        } catch (dbErr) {
          logger.warn(`Could not save DB record for scene ${currentSceneIndex} frame ${currentFrameIndex}:`, { error: dbErr.message });
        }

        logger.log(`[Sequential] Scene ${currentSceneIndex} Frame #${currentFrameIndex} completed successfully!`);

        return {
          sceneIndex: currentSceneIndex,
          imageIndex: currentFrameIndex,
          success: true,
          imageUrl: uploadResult.publicUrl,
          publicUrl: uploadResult.publicUrl,
          key: uploadResult.key,
          name: assetFileName,
          endpointUsed: genResult.endpointUsed,
          remainingUsage: genResult.remainingUsage,
        };
      } catch (err) {
        logger.error(`[Sequential] Failed to generate Scene ${currentSceneIndex} Frame #${currentFrameIndex}:`, { error: err.message });
        return {
          sceneIndex: currentSceneIndex,
          imageIndex: currentFrameIndex,
          success: false,
          error: err.message,
        };
      }
    }

    // Run frame tasks sequentially so single-container Modal GPU doesn't drop/cancel queued requests
    const results = [];
    for (let i = 0; i < frameTasks.length; i++) {
      const taskItem = frameTasks[i];
      logger.log(`[Sequential ${i + 1}/${frameTasks.length}] Processing Scene ${taskItem.sceneNumber} Frame #${taskItem.imageIndex}...`);
      const frameRes = await processSingleFrame(taskItem);
      results.push(frameRes);
    }

    const completedCount = results.filter((r) => r.success && !r.skipped).length;
    logger.log(`Completed ${completedCount}/${frameTasks.length} image frame generations across ${sceneList.length} scenes.`);

    // If single scene mode, provide top-level convenient properties as well
    const singleResult = isSingleScene && results.length > 0 ? results[0] : null;

    return {
      success: isSingleScene ? Boolean(singleResult?.success) : true,
      channelSlug,
      topicSlug,
      totalScenes: sceneList.length,
      totalFrames: frameTasks.length,
      completedFrames: completedCount,
      frames: results,
      results,
      ...(singleResult
        ? {
            sceneIndex: singleResult.sceneIndex,
            imageIndex: singleResult.imageIndex,
            imageUrl: singleResult.imageUrl || singleResult.publicUrl,
            publicUrl: singleResult.publicUrl,
            key: singleResult.key,
            name: singleResult.name,
            endpointUsed: singleResult.endpointUsed,
            remainingUsage: singleResult.remainingUsage,
            error: singleResult.error,
          }
        : {}),
    };
  },
});

export default generateSceneImagesTask;

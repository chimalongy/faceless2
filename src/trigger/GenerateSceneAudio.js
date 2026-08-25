import { task, logger } from "@trigger.dev/sdk";
import { generateAudio } from "@/lib/audio-generator";
import { uploadToR2, deleteFromR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

export const generateSceneAudioTask = task({
  id: "generate-scene-audio",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      scenes = [],
      sceneIndex = null,
      scriptText = "",
      text = "",
      speed = 1.0,
    } = payload;

    const selectedVoice = payload.voice || payload.voiceId || "af_heart";

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required and must be passed to generate-scene-audio task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required and must be passed to generate-scene-audio task.");
    }

    // Support both single scene invocation and batch array invocation
    let sceneList = [];
    const isSingleScene = sceneIndex !== null && sceneIndex !== undefined;
    const singleText = (scriptText || text || "").trim();

    if (Array.isArray(scenes) && scenes.length > 0) {
      sceneList = scenes;
    } else if (isSingleScene && singleText) {
      sceneList = [
        {
          scene_number: sceneIndex,
          audio_text: singleText,
          voice: selectedVoice,
          speed,
        },
      ];
    } else {
      throw new Error("Either a valid scenes array or (sceneIndex + narration text) is required for generate-scene-audio task.");
    }

    logger.log(`Starting scene audio narration task for ${sceneList.length} scene(s)...`, {
      channelSlug,
      topicSlug,
      voice: selectedVoice,
      totalScenes: sceneList.length,
      isSingleScene,
    });

    // Helper to generate audio for an individual scene
    async function processSingleSceneAudio(scene) {
      const currentSceneIndex = scene.scene_number || scene.scene_index || scene.index || 1;

      // Skip if audio already exists (batch mode only)
      if (!isSingleScene && (scene.existingAudioUrl || scene.hasAudio)) {
        logger.log(`Skipping scene ${currentSceneIndex} because audio already exists.`);
        return {
          sceneIndex: currentSceneIndex,
          success: true,
          skipped: true,
          publicUrl: scene.existingAudioUrl || "",
        };
      }

      const sceneText = (scene.audio_text || scene.narration || scene.script || scene.text || "").trim();
      if (!sceneText) {
        logger.warn(`Skipping scene ${currentSceneIndex} audio due to empty narration text.`);
        return {
          sceneIndex: currentSceneIndex,
          success: false,
          error: "Empty narration text",
        };
      }

      logger.log(`[Parallel Audio] Synthesizing Scene ${currentSceneIndex}...`);

      try {
        const audioResult = await generateAudio({
          text: sceneText,
          voice: scene.voice || selectedVoice,
          speed: scene.speed || speed,
          format: "wav",
        });

        // Clean up previous scene audio from Cloudflare R2 and Neon DB if regenerating
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
                WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'audio' AND scene_index = ${currentSceneIndex};
              `;
              if (oldRows && oldRows.length > 0) {
                for (const row of oldRows) {
                  if (row.file_key) {
                    await deleteFromR2(row.file_key).catch(() => {});
                  }
                }
                await sql`
                  DELETE FROM topic_assets
                  WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'audio' AND scene_index = ${currentSceneIndex};
                `;
              }
            }
          }
        } catch (cleanErr) {
          logger.warn(`Could not clean up old audio before saving new one for scene ${currentSceneIndex}:`, cleanErr.message);
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const key = `channels/${channelSlug}/topics/${topicSlug}/audio/scene-${currentSceneIndex}-${timestamp}-${randomSuffix}.wav`;

        const uploadResult = await uploadToR2({
          key,
          buffer: audioResult.audioBuffer,
          mimeType: "audio/wav",
          metadata: {
            channelSlug,
            topicSlug,
            sceneIndex: String(currentSceneIndex),
            voice: scene.voice || selectedVoice,
            endpointUsed: audioResult.endpointUsed,
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
                  'audio',
                  ${currentSceneIndex},
                  ${uploadResult.publicUrl},
                  ${uploadResult.key},
                  ${`${topicSlug}-scene-${currentSceneIndex}.wav`},
                  'audio/wav',
                  ${audioResult.audioBuffer.length}
                );
              `;
            }
          }
        } catch (dbErr) {
          logger.warn(`Could not save DB audio record for scene ${currentSceneIndex}:`, { error: dbErr.message });
        }

        logger.log(`[Parallel Audio] Scene ${currentSceneIndex} audio generated successfully!`);

        return {
          sceneIndex: currentSceneIndex,
          success: true,
          audioUrl: uploadResult.publicUrl,
          publicUrl: uploadResult.publicUrl,
          key: uploadResult.key,
          endpointUsed: audioResult.endpointUsed,
          remainingUsage: audioResult.remainingUsage,
          durationEstimate: audioResult.durationEstimate,
        };
      } catch (err) {
        logger.error(`[Parallel Audio] Failed scene ${currentSceneIndex}:`, { error: err.message });
        return {
          sceneIndex: currentSceneIndex,
          success: false,
          error: err.message,
        };
      }
    }

    // Run ALL scene audio tasks concurrently in parallel
    const results = await Promise.all(sceneList.map((scene) => processSingleSceneAudio(scene)));
    const completedCount = results.filter((r) => r.success && !r.skipped).length;

    logger.log(`Completed ${completedCount}/${sceneList.length} scene audio generations.`);

    const singleResult = isSingleScene && results.length > 0 ? results[0] : null;

    return {
      success: isSingleScene ? Boolean(singleResult?.success) : true,
      channelSlug,
      topicSlug,
      totalScenes: sceneList.length,
      completedAudios: completedCount,
      audios: results,
      results,
      ...(singleResult
        ? {
            sceneIndex: singleResult.sceneIndex,
            audioUrl: singleResult.audioUrl || singleResult.publicUrl,
            publicUrl: singleResult.publicUrl,
            key: singleResult.key,
            endpointUsed: singleResult.endpointUsed,
            remainingUsage: singleResult.remainingUsage,
            durationEstimate: singleResult.durationEstimate,
            error: singleResult.error,
          }
        : {}),
    };
  },
});

export default generateSceneAudioTask;

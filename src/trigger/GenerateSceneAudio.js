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

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required and must be passed to generate-scene-audio task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required and must be passed to generate-scene-audio task.");
    }

    // Resolve channel context: tts_model, default_voice, audio_theme
    let resolvedTtsModel = payload.ttsModel || null;
    let resolvedVoice = payload.voice || payload.voiceId || null;
    let resolvedInstruct = payload.instruct || payload.audioTheme || null;

    try {
      const sql = getDbSql();
      if (sql) {
        await initDbSchema();
        const cRows = await sql`
          SELECT id, default_voice, audio_theme, tts_model
          FROM channels
          WHERE slug = ${channelSlug}
          LIMIT 1;
        `;
        if (cRows && cRows.length > 0) {
          const ch = cRows[0];
          if (!resolvedTtsModel) {
            resolvedTtsModel = ch.tts_model || "kokoro";
          }
          if (!resolvedVoice) {
            resolvedVoice = ch.default_voice || (resolvedTtsModel === "qwen" ? "Ryan" : "af_heart");
          }
          if (!resolvedInstruct) {
            resolvedInstruct = ch.audio_theme || null;
          }
        }

        // Fallback: If channel audio_theme is empty, inspect content pillar tone
        if (!resolvedInstruct) {
          const tRows = await sql`
            SELECT pillar_id FROM topics WHERE slug = ${topicSlug} LIMIT 1;
          `;
          if (tRows?.[0]?.pillar_id) {
            const pRows = await sql`
              SELECT tone FROM content_pillars WHERE id = ${tRows[0].pillar_id} LIMIT 1;
            `;
            if (pRows?.[0]?.tone) {
              resolvedInstruct = pRows[0].tone;
            }
          }
        }
      }
    } catch (dbErr) {
      logger.warn("Could not load channel audio strategy from database:", dbErr);
    }

    if (!resolvedTtsModel) resolvedTtsModel = "kokoro";
    if (!resolvedVoice) resolvedVoice = resolvedTtsModel === "qwen" ? "Ryan" : "af_heart";

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
          voice: resolvedVoice,
          ttsModel: resolvedTtsModel,
          instruct: resolvedInstruct,
          speed,
        },
      ];
    } else {
      throw new Error("Either a valid scenes array or (sceneIndex + narration text) is required for generate-scene-audio task.");
    }

    logger.log(`Starting scene audio narration task for ${sceneList.length} scene(s)...`, {
      channelSlug,
      topicSlug,
      ttsModel: resolvedTtsModel,
      voice: resolvedVoice,
      instruct: resolvedInstruct ? `"${resolvedInstruct.slice(0, 50)}..."` : "None",
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

      const sceneVoice = scene.voice || resolvedVoice;
      const sceneTtsModel = scene.ttsModel || resolvedTtsModel;
      const sceneInstruct = scene.instruct || resolvedInstruct;

      logger.log(`[Parallel Audio] Synthesizing Scene ${currentSceneIndex} via ${sceneTtsModel} (Voice: ${sceneVoice})...`);

      try {
        const audioResult = await generateAudio({
          text: sceneText,
          voice: sceneVoice,
          ttsModel: sceneTtsModel,
          instruct: sceneInstruct,
          audioTheme: sceneInstruct,
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
            voice: sceneVoice,
            ttsModel: sceneTtsModel,
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
                  size_bytes,
                  created_at
                )
                VALUES (
                  ${topicId},
                  ${channelId},
                  'audio',
                  ${currentSceneIndex},
                  ${uploadResult.publicUrl},
                  ${uploadResult.key},
                  ${`Scene ${currentSceneIndex} Audio.wav`},
                  'audio/wav',
                  ${audioResult.byteLength},
                  NOW()
                );
              `;
            }
          }
        } catch (dbErr) {
          logger.warn(`Could not record audio asset in DB for scene ${currentSceneIndex}:`, dbErr.message);
        }

        return {
          sceneIndex: currentSceneIndex,
          success: true,
          publicUrl: uploadResult.publicUrl,
          key: uploadResult.key,
          endpointUsed: audioResult.endpointUsed,
          durationEstimate: audioResult.durationEstimate,
          ttsModel: audioResult.ttsModel,
        };
      } catch (err) {
        logger.error(`Failed to generate audio for scene ${currentSceneIndex}:`, err);
        return {
          sceneIndex: currentSceneIndex,
          success: false,
          error: err.message,
        };
      }
    }

    // Process all scenes concurrently
    logger.log(`Synthesizing narration for ${sceneList.length} scene(s)...`);
    const results = await Promise.all(sceneList.map((scene) => processSingleSceneAudio(scene)));

    const completed = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    logger.log(`Scene audio narration synthesis complete. ${completed.length} succeeded, ${failed.length} failed.`);

    if (isSingleScene) {
      const single = results[0];
      if (!single.success) {
        throw new Error(single.error || "Failed to generate single scene audio narration.");
      }
      return {
        success: true,
        sceneIndex: single.sceneIndex,
        audioUrl: single.publicUrl,
        key: single.key,
        endpointUsed: single.endpointUsed,
        durationEstimate: single.durationEstimate,
        ttsModel: single.ttsModel,
      };
    }

    return {
      success: completed.length > 0,
      totalScenes: sceneList.length,
      completedAudios: completed.length,
      failedAudios: failed.length,
      audios: results,
      ttsModel: resolvedTtsModel,
    };
  },
});

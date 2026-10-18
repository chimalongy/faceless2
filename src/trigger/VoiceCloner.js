import { task, logger } from "@trigger.dev/sdk";
import {
  createVoiceClone,
  generateClonedAudio,
  resolveModalVoiceCloneUrl,
} from "@/lib/voice-cloner";
import { uploadToR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

/**
 * Trigger.dev task for Qwen3-TTS Voice Cloning operations.
 *
 * Supported Actions:
 *  1. "register" | "new-clone"
 *     Registers a new voice clone by uploading reference audio and transcript to Modal.
 *
 *  2. "generate" | "synthesize"
 *     Synthesizes zero-shot speech from a registered voice clone and optionally uploads
 *     the output WAV to Cloudflare R2 / associates it with topic_assets.
 *
 *  3. "full-pipeline" | "both"
 *     Registers the voice clone and immediately generates synthesized speech from it.
 */
export const voiceClonerTask = task({
  id: "voice-cloner",
  run: async (payload) => {
    const {
      action = "register",
      voiceName,
      refText,
      refAudioBase64,
      text,
      language = "English",
      channelSlug = null,
      topicSlug = null,
      sceneIndex = null,
      saveToR2 = true,
    } = payload;

    const normalizedAction = String(action || "register").toLowerCase().trim();
    logger.log(`[VoiceClonerTask] Starting action "${normalizedAction}" for voice "${voiceName}"...`);

    const trimmedVoiceName = String(voiceName || "").trim();
    if (!trimmedVoiceName) {
      throw new Error("voiceName is required for voice-cloner task.");
    }

    // Resolve Modal endpoint for health & debug logging
    const modalUrl = await resolveModalVoiceCloneUrl();
    logger.log(`[VoiceClonerTask] Connecting to Modal Voice Cloner at ${modalUrl}`);

    let registrationResult = null;
    let audioBuffer = null;
    let r2Asset = null;

    // =========================================================================
    // STEP 1: VOICE REGISTRATION (for 'register', 'new-clone', 'both', 'full-pipeline')
    // =========================================================================
    if (
      normalizedAction === "register" ||
      normalizedAction === "new-clone" ||
      normalizedAction === "both" ||
      normalizedAction === "full-pipeline"
    ) {
      const trimmedRefText = String(refText || "").trim();
      if (!trimmedRefText) {
        throw new Error("refText is required to register a voice clone.");
      }
      if (!refAudioBase64 || typeof refAudioBase64 !== "string") {
        throw new Error("refAudioBase64 is required to register a voice clone.");
      }

      logger.log(`[VoiceClonerTask] Registering voice "${trimmedVoiceName}" on Modal GPU volume...`);

      registrationResult = await createVoiceClone({
        voiceName: trimmedVoiceName,
        refText: trimmedRefText,
        refAudioBase64,
      });

      logger.log(`[VoiceClonerTask] Successfully registered voice "${trimmedVoiceName}".`, registrationResult);
    }

    // =========================================================================
    // STEP 2: SPEECH SYNTHESIS (for 'generate', 'synthesize', 'both', 'full-pipeline')
    // =========================================================================
    if (
      normalizedAction === "generate" ||
      normalizedAction === "synthesize" ||
      normalizedAction === "both" ||
      normalizedAction === "full-pipeline"
    ) {
      const trimmedText = String(text || "").trim();
      if (!trimmedText) {
        throw new Error("text is required to generate speech from voice clone.");
      }

      logger.log(`[VoiceClonerTask] Synthesizing speech with voice "${trimmedVoiceName}" (${trimmedText.length} chars, language: ${language})...`);

      audioBuffer = await generateClonedAudio({
        voiceName: trimmedVoiceName,
        text: trimmedText,
        language: language || "English",
      });

      logger.log(`[VoiceClonerTask] Synthesis complete. Generated ${audioBuffer.length} bytes.`);

      // Optional: Upload synthesized audio to Cloudflare R2
      if (saveToR2 && audioBuffer && audioBuffer.length > 0) {
        try {
          const timestamp = Date.now();
          const safeVoice = trimmedVoiceName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
          let r2Key;

          if (channelSlug && topicSlug) {
            const sceneSuffix = sceneIndex !== null && sceneIndex !== undefined ? `_scene_${sceneIndex}` : "";
            r2Key = `channels/${channelSlug}/topics/${topicSlug}/audio/clone_${safeVoice}${sceneSuffix}_${timestamp}.wav`;
          } else {
            r2Key = `voice-clones/${safeVoice}/generated_${timestamp}.wav`;
          }

          logger.log(`[VoiceClonerTask] Uploading synthesized audio to R2: ${r2Key}...`);
          const uploadResult = await uploadToR2({
            key: r2Key,
            buffer: audioBuffer,
            mimeType: "audio/wav",
            metadata: {
              voiceName: trimmedVoiceName,
              action: normalizedAction,
              language: language || "English",
            },
          });

          r2Asset = {
            key: r2Key,
            publicUrl: uploadResult.publicUrl,
            sizeBytes: audioBuffer.length,
          };

          // If linked to a channel topic in the database, record in topic_assets
          if (channelSlug && topicSlug) {
            try {
              const sql = getDbSql();
              if (sql) {
                await initDbSchema();
                const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
                const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
                const channelId = cRows?.[0]?.id;
                const topicId = tRows?.[0]?.id;

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
                      ${sceneIndex !== null && sceneIndex !== undefined ? Number(sceneIndex) : null},
                      ${uploadResult.publicUrl},
                      ${r2Key},
                      ${`clone_${safeVoice}_${timestamp}.wav`},
                      'audio/wav',
                      ${audioBuffer.length}
                    );
                  `;
                  logger.log(`[VoiceClonerTask] Successfully linked asset to topic_assets in Neon DB.`);
                }
              }
            } catch (dbErr) {
              logger.warn(`[VoiceClonerTask] Could not record asset in topic_assets:`, dbErr.message);
            }
          }
        } catch (r2Err) {
          logger.warn(`[VoiceClonerTask] R2 upload failed (audio still returned as base64):`, r2Err.message);
        }
      }
    }

    return {
      success: true,
      action: normalizedAction,
      voiceName: trimmedVoiceName,
      registration: registrationResult,
      audioBase64: audioBuffer ? audioBuffer.toString("base64") : null,
      audioUrl: r2Asset?.publicUrl || null,
      r2Key: r2Asset?.key || null,
      sizeBytes: audioBuffer ? audioBuffer.length : null,
      timestamp: new Date().toISOString(),
    };
  },
});

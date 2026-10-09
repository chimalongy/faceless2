import { getDbSql, initDbSchema } from "./db.js";

/**
 * Get the configured maximum audio generations allowed per URL per month.
 * Default is 250 (from process.env.MAX_AUDIO_URL_GEN or process.env.MAX_IMAGE_URL_GEN).
 */
export function getMaxAudioUrlGen() {
  const envVal = parseInt(process.env.MAX_AUDIO_URL_GEN || process.env.MAX_IMAGE_URL_GEN, 10);
  return !isNaN(envVal) && envVal > 0 ? envVal : 250;
}

/**
 * Get current year-month string (e.g., "2026-08")
 */
export function getCurrentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Kokoro-82M Voice Catalog
 */
export const KOKORO_VOICES = [
  // American English (Female)
  { id: "af_heart", name: "Heart (American Female - Premium Grade A)", lang: "en-US", gender: "female" },
  { id: "af_bella", name: "Bella (American Female - Grade A-)", lang: "en-US", gender: "female" },
  { id: "af_nicole", name: "Nicole (American Female - Grade B-)", lang: "en-US", gender: "female" },
  { id: "af_aoede", name: "Aoede (American Female)", lang: "en-US", gender: "female" },
  { id: "af_kore", name: "Kore (American Female)", lang: "en-US", gender: "female" },
  { id: "af_sarah", name: "Sarah (American Female)", lang: "en-US", gender: "female" },
  { id: "af_nova", name: "Nova (American Female)", lang: "en-US", gender: "female" },
  { id: "af_sky", name: "Sky (American Female)", lang: "en-US", gender: "female" },

  // American English (Male)
  { id: "am_fenrir", name: "Fenrir (American Male - Grade C+)", lang: "en-US", gender: "male" },
  { id: "am_michael", name: "Michael (American Male - Grade C+)", lang: "en-US", gender: "male" },
  { id: "am_puck", name: "Puck (American Male - Grade C+)", lang: "en-US", gender: "male" },
  { id: "am_echo", name: "Echo (American Male)", lang: "en-US", gender: "male" },
  { id: "am_eric", name: "Eric (American Male)", lang: "en-US", gender: "male" },
  { id: "am_liam", name: "Liam (American Male)", lang: "en-US", gender: "male" },
  { id: "am_onyx", name: "Onyx (American Male)", lang: "en-US", gender: "male" },
  { id: "am_adam", name: "Adam (American Male)", lang: "en-US", gender: "male" },

  // British English
  { id: "bf_emma", name: "Emma (British Female - Grade B-)", lang: "en-GB", gender: "female" },
  { id: "bf_isabella", name: "Isabella (British Female)", lang: "en-GB", gender: "female" },
  { id: "bf_alice", name: "Alice (British Female)", lang: "en-GB", gender: "female" },
  { id: "bf_lily", name: "Lily (British Female)", lang: "en-GB", gender: "female" },
  { id: "bm_fable", name: "Fable (British Male)", lang: "en-GB", gender: "male" },
  { id: "bm_george", name: "George (British Male)", lang: "en-GB", gender: "male" },
  { id: "bm_lewis", name: "Lewis (British Male)", lang: "en-GB", gender: "male" },
  { id: "bm_daniel", name: "Daniel (British Male)", lang: "en-GB", gender: "male" },

  // Spanish
  { id: "ef_dora", name: "Dora (Spanish Female)", lang: "es-ES", gender: "female" },
  { id: "em_alex", name: "Alex (Spanish Male)", lang: "es-ES", gender: "male" },

  // French
  { id: "ff_siwis", name: "Siwis (French Female)", lang: "fr-FR", gender: "female" },

  // Italian
  { id: "if_sara", name: "Sara (Italian Female)", lang: "it-IT", gender: "female" },
  { id: "im_nicola", name: "Nicola (Italian Male)", lang: "it-IT", gender: "male" },

  // Hindi
  { id: "hf_alpha", name: "Alpha (Hindi Female)", lang: "hi-IN", gender: "female" },
  { id: "hm_omega", name: "Omega (Hindi Male)", lang: "hi-IN", gender: "male" },

  // Japanese
  { id: "jf_alpha", name: "Alpha (Japanese Female)", lang: "ja-JP", gender: "female" },
  { id: "jm_kumo", name: "Kumo (Japanese Male)", lang: "ja-JP", gender: "male" },
];

/**
 * Qwen3-TTS 1.7B CustomVoice Catalog
 */
export const QWEN_VOICES = [
  { id: "Ryan", name: "Ryan (Dynamic male with strong rhythmic drive)", lang: "English", gender: "male", description: "Dynamic male with strong rhythmic drive" },
  { id: "Aiden", name: "Aiden (Sunny American male, clear midrange)", lang: "English", gender: "male", description: "Sunny American male, clear midrange" },
  { id: "Vivian", name: "Vivian (Bright, slightly edgy young female)", lang: "Chinese", gender: "female", description: "Bright, slightly edgy young female" },
  { id: "Serena", name: "Serena (Warm, gentle young female)", lang: "Chinese", gender: "female", description: "Warm, gentle young female" },
  { id: "Uncle_Fu", name: "Uncle_Fu (Seasoned male, low and mellow timbre)", lang: "Chinese", gender: "male", description: "Seasoned male, low and mellow timbre" },
  { id: "Dylan", name: "Dylan (Youthful male, clear and natural - Beijing dialect)", lang: "Chinese (Beijing dialect)", gender: "male", description: "Youthful male, clear and natural" },
  { id: "Eric", name: "Eric (Lively male, slightly husky brightness - Sichuan dialect)", lang: "Chinese (Sichuan dialect)", gender: "male", description: "Lively male, slightly husky brightness" },
  { id: "Ono_Anna", name: "Ono_Anna (Playful female, light and nimble)", lang: "Japanese", gender: "female", description: "Playful female, light and nimble" },
  { id: "Sohee", name: "Sohee (Warm female with rich emotion)", lang: "Korean", gender: "female", description: "Warm female with rich emotion" },
];

/**
 * Check if a given voice ID belongs to the Qwen3 voice catalog.
 */
export function isQwenVoice(voiceId) {
  if (!voiceId || typeof voiceId !== "string") return false;
  const normalized = voiceId.trim().toLowerCase();
  return QWEN_VOICES.some((v) => v.id.toLowerCase() === normalized);
}

/**
 * Resolve the Modal Qwen3-TTS API URL from general_settings or environment variables.
 */
export async function resolveModalQwenTtsUrl() {
  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      const rows = await sql`
        SELECT modal_qwen_tts_url AS "modalQwenTtsUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;
      if (rows?.[0]?.modalQwenTtsUrl) {
        return rows[0].modalQwenTtsUrl.trim();
      }
    } catch (err) {
      console.warn("Could not query Modal Qwen TTS URL from database:", err.message);
    }
  }

  return (
    process.env.MODAL_QWEN_TTS_URL ||
    "https://geniusdomainnames--qwen3-tts-custom-web.modal.run"
  ).trim();
}

/**
 * Load all audio API keys and endpoints from the database.
 */
export async function loadAudioEndpoints() {
  const sql = getDbSql();
  if (!sql) {
    throw new Error("Database connection not available. Please check DATABASE_URL.");
  }

  await initDbSchema();

  const currentMonth = getCurrentMonthString();
  const maxQuota = getMaxAudioUrlGen();

  try {
    // 1. Initialize any uninitialized rows to the current month WITHOUT modifying usage
    await sql`
      UPDATE audio_endpoints
      SET last_reset_month = ${currentMonth}
      WHERE last_reset_month IS NULL;
    `;

    // 2. Only reset usage on the 1st of a new month (when last_reset_month != currentMonth)
    await sql`
      UPDATE audio_endpoints
      SET usage = ${maxQuota},
          last_reset_month = ${currentMonth},
          updated_at = NOW()
      WHERE last_reset_month != ${currentMonth};
    `;
  } catch (resetErr) {
    console.warn("Could not check monthly audio endpoint quota rollover:", resetErr);
  }

  // Fetch all audio endpoints ordered by ID
  const endpoints = await sql`
    SELECT 
      id,
      account_email AS "accountEmail",
      gen_url AS "genUrl",
      usage,
      last_reset_month AS "lastResetMonth",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM audio_endpoints
    ORDER BY id ASC;
  `;

  return endpoints || [];
}

/**
 * Decrement the usage count for an audio endpoint by 1.
 */
export async function decrementAudioEndpointUsage(endpointId) {
  const sql = getDbSql();
  if (!sql || !endpointId) return 0;

  try {
    const updated = await sql`
      UPDATE audio_endpoints
      SET usage = GREATEST(0, usage - 1),
          updated_at = NOW()
      WHERE id = ${endpointId}
      RETURNING usage;
    `;
    return updated?.[0]?.usage ?? 0;
  } catch (err) {
    console.error(`Failed to decrement usage for audio endpoint ${endpointId}:`, err);
    return 0;
  }
}

/**
 * Synthesize speech audio using either Qwen3-TTS 1.7B (Modal GPU) or Kokoro-82M.
 * 
 * @param {Object} options
 * @param {string} options.text - Narration text
 * @param {string} [options.voice="af_heart"] - Voice ID (Kokoro or Qwen)
 * @param {string} [options.ttsModel] - "qwen" | "kokoro" (auto-detected if voice is from Qwen catalog)
 * @param {string} [options.instruct] - Tone/style instruction for Qwen3-TTS (channel audio_theme or pillar tone)
 * @param {string} [options.audioTheme] - Alias for instruct
 * @param {string} [options.language] - Optional explicit language (e.g. "English", "Chinese")
 * @param {number} [options.speed=1.0] - Speech rate (0.5 - 2.0)
 * @param {string} [options.format="wav"] - Format ("wav" | "pcm")
 * @param {number} [options.timeoutMs=180000] - Request timeout in ms
 * @returns {Promise<{ success: boolean, audioBuffer: Buffer, endpointUsed: string, remainingUsage: number, durationEstimate: string, ttsModel: string }>}
 */
export async function generateAudio({
  text,
  voice = "af_heart",
  ttsModel = null,
  instruct = null,
  audioTheme = null,
  language = null,
  speed = 1.0,
  format = "wav",
  timeoutMs = 180000,
}) {
  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("Text is required for audio narration synthesis.");
  }

  // 1. Determine TTS model engine
  const isQwen =
    (ttsModel && ttsModel.toLowerCase().startsWith("qwen")) ||
    isQwenVoice(voice);

  // =========================================================================
  // PATH A: Qwen3-TTS 1.7B CustomVoice (Style-instructed Modal GPU deployment)
  // =========================================================================
  if (isQwen) {
    const targetBase = await resolveModalQwenTtsUrl();
    let targetUrl = targetBase.replace(/\/+$/, "");
    if (!targetUrl.endsWith("/synthesize")) {
      targetUrl = `${targetUrl}/synthesize`;
    }

    // Resolve speaker: if current voice isn't in Qwen list, fallback to Ryan
    const resolvedSpeaker = isQwenVoice(voice) ? voice : "Ryan";
    const speakerMeta = QWEN_VOICES.find((v) => v.id.toLowerCase() === resolvedSpeaker.toLowerCase());

    const finalInstruct = (instruct || audioTheme || "").trim();

    console.log(
      `[AudioGenerator] Synthesizing speech via Qwen3-TTS (${targetUrl}) | Speaker: ${resolvedSpeaker} | Instruct: "${finalInstruct || "None"}" | Speed: ${Number(speed) || 1.0}x | Words: ${text.split(/\s+/).length}`
    );

    const payload = {
      text: text.trim(),
      speaker: resolvedSpeaker,
      voice: resolvedSpeaker,
      language: language || speakerMeta?.lang || "English",
      instruct: finalInstruct || undefined,
      audio_theme: finalInstruct || undefined,
      speed: Number(speed) || 1.0,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error("Qwen3-TTS endpoint responded with empty audio payload.");
      }

      // Estimate audio duration based on word count (~150 words/min)
      const wordCount = text.trim().split(/\s+/).length;
      const totalSeconds = Math.max(1, Math.round((wordCount / (150 * (Number(speed) || 1))) * 60));
      const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const secs = String(totalSeconds % 60).padStart(2, "0");
      const durationEstimate = `${mins}:${secs}`;

      console.log(
        `[AudioGenerator] Success! Generated ${audioBuffer.length} bytes of Qwen3-TTS audio. Speaker: ${resolvedSpeaker}`
      );

      return {
        success: true,
        audioBuffer,
        endpointUsed: `Qwen3-TTS (${resolvedSpeaker} @ Modal)`,
        remainingUsage: 999,
        durationEstimate,
        format,
        byteLength: audioBuffer.length,
        ttsModel: "qwen",
      };
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[AudioGenerator] Qwen3-TTS generation failed:", err);
      throw new Error(`Qwen3-TTS generation error: ${err.message}`);
    }
  }

  // =========================================================================
  // PATH B: Kokoro-82M Voice Catalog (Endpoints Pool)
  // =========================================================================
  const endpoints = await loadAudioEndpoints();

  if (!endpoints || endpoints.length === 0) {
    throw new Error("No audio generation endpoints found in database. Please configure audio endpoints in Dashboard Settings.");
  }

  const availableEndpoints = endpoints.filter((ep) => ep.genUrl && (parseInt(ep.usage, 10) > 0));

  if (availableEndpoints.length === 0) {
    throw new Error("Audio endpoint usage exhausted. All audio generation endpoints have 0 remaining quota.");
  }

  let lastError = null;

  for (const endpoint of availableEndpoints) {
    const currentUsage = parseInt(endpoint.usage, 10);
    if (currentUsage <= 0) continue;

    // Normalize target URL (ensure /synthesize endpoint)
    let targetUrl = endpoint.genUrl.trim().replace(/\/+$/, "");
    if (!targetUrl.endsWith("/synthesize")) {
      targetUrl = `${targetUrl}/synthesize`;
    }

    console.log(
      `[AudioGenerator] Synthesizing speech via ${endpoint.accountEmail} (${targetUrl}) | Voice: ${voice} | Speed: ${Number(speed) || 1.0}x | Words: ${text.split(/\s+/).length}`
    );

    const payload = {
      text: text.trim(),
      voice,
      speed: Number(speed) || 1.0,
      format,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      // Read audio binary bytes
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error("Endpoint responded with empty audio payload.");
      }

      // Decrement usage quota in database
      const remainingUsage = await decrementAudioEndpointUsage(endpoint.id);

      // Estimate audio duration based on word count (~150 words/min)
      const wordCount = text.trim().split(/\s+/).length;
      const totalSeconds = Math.max(1, Math.round((wordCount / (150 * (Number(speed) || 1))) * 60));
      const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const secs = String(totalSeconds % 60).padStart(2, "0");
      const durationEstimate = `${mins}:${secs}`;

      console.log(
        `[AudioGenerator] Success! Generated ${audioBuffer.length} bytes of audio via ${endpoint.accountEmail}. Remaining usage: ${remainingUsage}`
      );

      return {
        success: true,
        audioBuffer,
        endpointUsed: endpoint.accountEmail,
        remainingUsage,
        durationEstimate,
        format,
        byteLength: audioBuffer.length,
        ttsModel: "kokoro",
      };
    } catch (reqError) {
      console.warn(`[AudioGenerator] Failed synthesis on endpoint ${endpoint.accountEmail}:`, reqError.message);
      lastError = reqError;
      // Continue to next available endpoint
    }
  }

  throw new Error(`Audio generation failed across all available endpoints: ${lastError?.message || "Unknown error"}`);
}

import { getDbSql, initDbSchema } from "./db.js";

const DEFAULT_MODAL_VOICE_CLONE_URL = "https://geniusdomainnames--qwen3-tts-voice-cloner.us-east.modal.run";

/**
 * Resolves the configured Modal Qwen Voice Cloning endpoint URL.
 */
export async function resolveModalVoiceCloneUrl() {
  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      const rows = await sql`
        SELECT modal_qwen_voice_clone_url AS "modalQwenVoiceCloneUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;
      if (rows?.[0]?.modalQwenVoiceCloneUrl) {
        return rows[0].modalQwenVoiceCloneUrl.trim().replace(/\/+$/, "");
      }
    } catch (err) {
      console.warn("Could not query Modal Voice Clone URL from database:", err.message);
    }
  }

  return (
    process.env.MODAL_QWEN_VOICE_CLONE_URL ||
    DEFAULT_MODAL_VOICE_CLONE_URL
  ).trim().replace(/\/+$/, "");
}

/**
 * Check health status of the voice clone service.
 */
export async function checkVoiceClonerHealth() {
  const baseUrl = await resolveModalVoiceCloneUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { online: false, status: res.status, endpoint: baseUrl };
    }
    const data = await res.json().catch(() => ({}));
    return { online: true, ...data, endpoint: baseUrl };
  } catch (err) {
    return { online: false, error: err.message, endpoint: baseUrl };
  }
}

/**
 * Fetch all registered voice clones from Modal volume.
 */
export async function listVoiceClones() {
  const baseUrl = await resolveModalVoiceCloneUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${baseUrl}/voices`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Failed to list voice clones (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      success: true,
      endpoint: baseUrl,
      voices: Array.isArray(data.voices) ? data.voices : [],
      count: data.count || (Array.isArray(data.voices) ? data.voices.length : 0),
    };
  } catch (err) {
    return {
      success: false,
      endpoint: baseUrl,
      error: err.message,
      voices: [],
      count: 0,
    };
  }
}

/**
 * Register a new voice clone with reference audio and transcript.
 */
export async function createVoiceClone({ voiceName, refText, refAudioBase64 }) {
  const baseUrl = await resolveModalVoiceCloneUrl();
  const name = String(voiceName || "").trim();
  const text = String(refText || "").trim();

  if (!name) throw new Error("voice_name is required");
  if (!text) throw new Error("ref_text is required");
  if (!refAudioBase64) throw new Error("ref_audio_base64 is required");

  const payload = {
    voice_name: name,
    ref_text: text,
    ref_audio_base64: refAudioBase64,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 1 minute max for upload & normalize

  try {
    const res = await fetch(`${baseUrl}/new-clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const detail = errData.detail || errData.error || `HTTP ${res.status}`;
      throw new Error(detail);
    }

    const result = await res.json();
    return {
      success: true,
      message: result.message || "Voice registered successfully",
      voiceName: result.voice_name || name,
      createdAt: result.created_at,
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Delete a voice clone from the Modal volume.
 */
export async function deleteVoiceClone(voiceName) {
  const baseUrl = await resolveModalVoiceCloneUrl();
  const name = String(voiceName || "").trim();
  if (!name) throw new Error("voiceName is required");

  try {
    const res = await fetch(`${baseUrl}/delete-clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_name: name }),
    });

    if (!res.ok) {
      // Also try DELETE /voices/{name}
      const delRes = await fetch(`${baseUrl}/voices/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!delRes.ok) {
        const errData = await delRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to delete voice clone (HTTP ${delRes.status})`);
      }
      return await delRes.json();
    }

    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Synthesize speech from a registered voice clone.
 */
export async function generateClonedAudio({ voiceName, text, language = "English" }) {
  const baseUrl = await resolveModalVoiceCloneUrl();
  const name = String(voiceName || "").trim();
  const content = String(text || "").trim();

  if (!name) throw new Error("voiceName is required");
  if (!content) throw new Error("text is required");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout for neural synthesis

  try {
    const res = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_name: name,
        text: content,
        language: language || "English",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Voice synthesis failed (HTTP ${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Retrieve reference audio WAV for playback.
 */
export async function getReferenceAudio(voiceName) {
  const baseUrl = await resolveModalVoiceCloneUrl();
  const name = String(voiceName || "").trim();
  if (!name) throw new Error("voiceName is required");

  const res = await fetch(`${baseUrl}/voices/${encodeURIComponent(name)}/reference-audio`);
  if (!res.ok) {
    throw new Error(`Reference audio not found (HTTP ${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

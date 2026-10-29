import { getDbSql, initDbSchema } from "@/lib/db";

export const DEFAULT_MODAL_TRANSCRIPTION_URL =
  process.env.MODAL_TRANSCRIPTION_URL ||
  "https://me-chimaobi--whisper-api-optimized-whisperservice-transcribe.modal.run";

/**
 * Resolve the Modal Audio Transcription URL.
 *
 * Priority:
 * 1. passedUrl override
 * 2. modal_audio_transcription_url in general_settings DB table
 * 3. MODAL_TRANSCRIPTION_URL environment variable
 * 4. DEFAULT_MODAL_TRANSCRIPTION_URL
 */
export async function getTranscriptionUrl(passedUrl = null) {
  if (passedUrl && typeof passedUrl === "string" && passedUrl.trim().length > 0) {
    return passedUrl.trim();
  }

  try {
    const sql = getDbSql();
    if (sql) {
      await initDbSchema();
      const rows = await sql`
        SELECT modal_audio_transcription_url AS "modalAudioTranscriptionUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;

      if (rows?.[0]?.modalAudioTranscriptionUrl) {
        return rows[0].modalAudioTranscriptionUrl.trim();
      }
    }
  } catch (err) {
    console.warn("Could not query transcription URL from database:", err?.message || err);
  }

  return (process.env.MODAL_TRANSCRIPTION_URL || DEFAULT_MODAL_TRANSCRIPTION_URL).trim();
}

/**
 * Send an audio URL or audio buffer to the Modal Whisper transcription endpoint.
 *
 * @param {Object} options
 * @param {string} options.audioUrl - Publicly accessible URL of the audio file to transcribe
 * @param {string} [options.transcriptionUrl] - Optional endpoint override
 * @param {string} [options.language] - Optional language code (e.g. "en")
 * @returns {Promise<Object>} Transcription response including segments, text, and timestamps
 */
export async function transcribeAudio({ audioUrl, transcriptionUrl = null, language = "en" }) {
  if (!audioUrl) {
    throw new Error("audioUrl is required for transcription.");
  }

  const endpoint = await getTranscriptionUrl(transcriptionUrl);

  const payload = {
    audio_url: audioUrl,
    url: audioUrl,
    language,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Transcription request failed with status ${response.status}: ${errorText || response.statusText}`
    );
  }

  return await response.json();
}

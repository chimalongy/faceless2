import { getDbSql, initDbSchema } from "./db.js";
import {
  uploadToR2,
  downloadFromR2,
  deletePrefixFromR2,
} from "./storage.js";

export const DEFAULT_FISH_VOICE_CLONE_URL =
  "https://geniusdomainnames--faceless-fish-s2-tts-serve.modal.run";
export const DEFAULT_QWEN_VOICE_CLONE_URL =
  "https://geniusdomainnames--qwen3-tts-voice-cloner.modal.run";

/**
 * Resolves the configured Modal Voice Cloning endpoint URL for the specified model.
 *
 * @param {"fish" | "qwen"} [model="fish"]
 * @returns {Promise<string>}
 */
export async function resolveModalVoiceCloneUrl(model = "fish") {
  const normalizedModel = String(model || "fish").toLowerCase().trim();
  const isQwen = normalizedModel === "qwen" || normalizedModel.includes("qwen");

  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      const rows = await sql`
        SELECT 
          id,
          modal_qwen_voice_clone_url AS "modalQwenVoiceCloneUrl",
          modal_fish_voice_clone_url AS "modalFishVoiceCloneUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;
      const settings = rows?.[0] || {};

      if (isQwen) {
        let url = (settings.modalQwenVoiceCloneUrl || "").trim().replace(/\/+$/, "");
        url = url.replace(".us-east.modal.run", ".modal.run");
        // Self-heal: If the Qwen field contains the Fish URL (because user previously had only 1 field in settings),
        // ignore it for Qwen and use the correct default Qwen URL!
        if (url && !url.toLowerCase().includes("fish")) {
          if (url.includes("qwen3-tts-clone")) {
            url = url.replace("qwen3-tts-clone", "qwen3-tts-voice-cloner");
          }
          return url;
        }
        let fallback = (process.env.MODAL_QWEN_VOICE_CLONE_URL || DEFAULT_QWEN_VOICE_CLONE_URL).trim().replace(/\/+$/, "");
        return fallback.replace(".us-east.modal.run", ".modal.run");
      }

      if (!isQwen) {
        let url = (settings.modalFishVoiceCloneUrl || "").trim().replace(/\/+$/, "");
        // If modal_fish_voice_clone_url has a valid non-qwen URL, return it
        if (url && !url.toLowerCase().includes("qwen")) {
          return url;
        }
        // If modalQwenVoiceCloneUrl had the fish URL, use it!
        if (settings.modalQwenVoiceCloneUrl && settings.modalQwenVoiceCloneUrl.toLowerCase().includes("fish")) {
          return settings.modalQwenVoiceCloneUrl.trim().replace(/\/+$/, "");
        }
        return (
          process.env.MODAL_FISH_S2_URL ||
          process.env.MODAL_FISH_VOICE_CLONE_URL ||
          DEFAULT_FISH_VOICE_CLONE_URL
        ).trim().replace(/\/+$/, "");
      }
    } catch (err) {
      console.warn("Could not query Modal Voice Clone URL from database:", err.message);
    }
  }

  if (isQwen) {
    let qwenEnv = (
      process.env.MODAL_QWEN_VOICE_CLONE_URL || DEFAULT_QWEN_VOICE_CLONE_URL
    ).trim().replace(/\/+$/, "").replace(".us-east.modal.run", ".modal.run");
    if (qwenEnv.includes("qwen3-tts-clone")) {
      qwenEnv = qwenEnv.replace("qwen3-tts-clone", "qwen3-tts-voice-cloner");
    }
    return qwenEnv;
  }

  return (
    process.env.MODAL_FISH_S2_URL ||
    process.env.MODAL_FISH_VOICE_CLONE_URL ||
    DEFAULT_FISH_VOICE_CLONE_URL
  ).trim().replace(/\/+$/, "");
}

/**
 * Identify which model engine ("fish" | "qwen") a registered voice was created with.
 */
export async function getVoiceModel(voiceName) {
  if (!voiceName) return "fish";
  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      const rows = await sql`
        SELECT model FROM voice_clones
        WHERE LOWER(name) = LOWER(${voiceName.trim()})
        LIMIT 1;
      `;
      if (rows?.[0]?.model) {
        return rows[0].model.toLowerCase();
      }
    } catch {}
  }
  return "fish";
}

/**
 * Check health status of voice cloning services.
 *
 * @param {"fish" | "qwen" | null} [model=null]
 */
export async function checkVoiceClonerHealth(model = null) {
  async function ping(targetUrl) {
    if (!targetUrl) return { online: false, error: "No URL configured" };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${targetUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return { online: false, status: res.status, endpoint: targetUrl };
      }
      const data = await res.json().catch(() => ({}));
      return { online: true, ...data, endpoint: targetUrl };
    } catch (err) {
      return { online: false, error: err.message, endpoint: targetUrl };
    }
  }

  if (model === "fish") {
    const url = await resolveModalVoiceCloneUrl("fish");
    return ping(url);
  }

  if (model === "qwen") {
    const url = await resolveModalVoiceCloneUrl("qwen");
    return ping(url);
  }

  const [fishUrl, qwenUrl] = await Promise.all([
    resolveModalVoiceCloneUrl("fish"),
    resolveModalVoiceCloneUrl("qwen"),
  ]);

  const [fishHealth, qwenHealth] = await Promise.all([
    ping(fishUrl),
    ping(qwenUrl),
  ]);

  return {
    online: fishHealth.online || qwenHealth.online,
    fish: fishHealth,
    qwen: qwenHealth,
    endpoint: fishHealth.online ? fishUrl : qwenUrl,
  };
}

/**
 * Fetch all registered voice clones from Neon PostgreSQL database.
 * Only syncs with remote Modal volumes if explicitly requested via `options.syncWithModal`.
 *
 * @param {string | Object} [options]
 * @param {"fish" | "qwen" | null} [options.model=null] - Filter by specific model
 * @param {boolean} [options.syncWithModal=false] - Only sync with Modal volume if explicitly requested
 */
export async function listVoiceClones(options = {}) {
  const model = typeof options === "string" ? options : options?.model;
  const syncWithModal = typeof options === "object" ? Boolean(options?.syncWithModal) : false;
  const normalizedModel = model ? String(model).toLowerCase().trim() : null;

  // 1. Fetch tracked voice clone records strictly from Neon DB (<15ms)
  let dbVoices = [];
  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      const rows = normalizedModel
        ? await sql`
            SELECT name, model, ref_text AS "refText", reference_audio_url AS "refAudioUrl", created_at AS "createdAt"
            FROM voice_clones
            WHERE LOWER(model) = ${normalizedModel}
            ORDER BY created_at DESC;
          `
        : await sql`
            SELECT name, model, ref_text AS "refText", reference_audio_url AS "refAudioUrl", created_at AS "createdAt"
            FROM voice_clones
            ORDER BY created_at DESC;
          `;
      dbVoices = rows || [];
    } catch (dbErr) {
      console.warn("Could not load voice clones from database:", dbErr.message);
    }
  }

  // 2. Optional remote sync: only executed if explicitly requested
  if (syncWithModal) {
    async function fetchModalVoices(targetModel) {
      try {
        const url = await resolveModalVoiceCloneUrl(targetModel);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${url}/voices`, {
          method: "GET",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);

        if (!res.ok) return [];
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.voices) ? data.voices : [];
        return list.map((v) => ({
          ...v,
          model: targetModel,
          voice_name: v.voice_name || v.name || "",
        }));
      } catch {
        return [];
      }
    }

    const [fishList, qwenList] = await Promise.all([
      fetchModalVoices("fish"),
      fetchModalVoices("qwen"),
    ]);
    const remoteVoices = [...fishList, ...qwenList];

    if (sql && remoteVoices.length > 0) {
      try {
        for (const rv of remoteVoices) {
          if (!rv.voice_name) continue;
          await sql`
            INSERT INTO voice_clones (name, model, ref_text, created_at, updated_at)
            VALUES (
              ${rv.voice_name},
              ${rv.model || "fish"},
              ${rv.ref_text || ""},
              NOW(),
              NOW()
            )
            ON CONFLICT (name) DO UPDATE
            SET model = EXCLUDED.model,
                ref_text = COALESCE(NULLIF(EXCLUDED.ref_text, ''), voice_clones.ref_text),
                updated_at = NOW();
          `;
        }
        // Re-read DB voices after sync
        const refreshedRows = normalizedModel
          ? await sql`
              SELECT name, model, ref_text AS "refText", reference_audio_url AS "refAudioUrl", created_at AS "createdAt"
              FROM voice_clones
              WHERE LOWER(model) = ${normalizedModel}
              ORDER BY created_at DESC;
            `
          : await sql`
              SELECT name, model, ref_text AS "refText", reference_audio_url AS "refAudioUrl", created_at AS "createdAt"
              FROM voice_clones
              ORDER BY created_at DESC;
            `;
        dbVoices = refreshedRows || [];
      } catch (backfillErr) {
        console.warn("[listVoiceClones] Backfill error:", backfillErr.message);
      }
    }
  }

  // 3. Map database voices directly into frontend-ready format
  const voices = dbVoices.map((v) => ({
    voice_name: v.name,
    model: v.model || "fish",
    ref_text: v.refText || "",
    reference_audio_url: v.refAudioUrl || null,
    created_at: v.createdAt || "",
    has_reference_audio: true,
    engine_label: (v.model || "fish").toLowerCase() === "qwen" ? "Qwen3-TTS 1.7B" : "Fish Audio S2 Pro",
  }));

  return {
    success: true,
    voices,
    count: voices.length,
  };
}

/**
 * Register a new voice clone with reference audio and transcript on the chosen model.
 *
 * @param {Object} options
 * @param {string} options.voiceName
 * @param {string} options.refText
 * @param {string} options.refAudioBase64
 * @param {"fish" | "qwen"} [options.model="fish"]
 */
export async function createVoiceClone({
  voiceName,
  refText,
  refAudioBase64,
  model = "fish",
}) {
  const chosenModel = String(model || "fish").toLowerCase().trim() === "qwen" ? "qwen" : "fish";
  const baseUrl = await resolveModalVoiceCloneUrl(chosenModel);

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
  const timeout = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout for cold starts

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
      throw new Error(`${detail} (called ${chosenModel} cloner at: ${baseUrl})`);
    }

    const result = await res.json();

    // Upload reference audio to Cloudflare R2 for fast replays without contacting Modal
    let refAudioUrl = null;
    try {
      const audioBuffer = Buffer.from(refAudioBase64, "base64");
      const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const r2Upload = await uploadToR2({
        key: `voice-clones/${safeName}/reference.wav`,
        buffer: audioBuffer,
        mimeType: "audio/wav",
        metadata: {
          voiceName: name,
          model: chosenModel,
        },
      });
      refAudioUrl = r2Upload?.publicUrl || null;
    } catch (r2Err) {
      console.warn("[createVoiceClone] Could not save reference audio to Cloudflare R2:", r2Err.message);
    }

    // Persist registration into Neon DB
    const sql = getDbSql();
    if (sql) {
      try {
        await initDbSchema();
        await sql`
          INSERT INTO voice_clones (name, model, ref_text, reference_audio_url, updated_at)
          VALUES (${name}, ${chosenModel}, ${text}, ${refAudioUrl}, NOW())
          ON CONFLICT (name) DO UPDATE 
          SET model = ${chosenModel},
              ref_text = ${text},
              reference_audio_url = COALESCE(${refAudioUrl}, voice_clones.reference_audio_url),
              updated_at = NOW();
        `;
      } catch (dbErr) {
        console.warn("Could not save voice clone record to database:", dbErr.message);
      }
    }

    return {
      success: true,
      message: result.message || "Voice registered successfully",
      voiceName: result.voice_name || name,
      model: chosenModel,
      referenceAudioUrl: refAudioUrl,
      createdAt: result.created_at || new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Delete a voice clone from the database and the remote Modal volume.
 *
 * @param {string} voiceName
 * @param {"fish" | "qwen" | null} [model=null]
 */
export async function deleteVoiceClone(voiceName, model = null) {
  const name = String(voiceName || "").trim();
  if (!name) throw new Error("voiceName is required");

  let targetModel = model ? String(model).toLowerCase() : null;
  if (!targetModel) {
    targetModel = await getVoiceModel(name);
  }

  const baseUrl = await resolveModalVoiceCloneUrl(targetModel || "fish");

  // Delete from remote Modal volume
  try {
    await fetch(`${baseUrl}/delete-clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_name: name }),
    });
  } catch {}

  // Delete reference audio from Cloudflare R2
  try {
    const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    await deletePrefixFromR2(`voice-clones/${safeName}`);
  } catch {}

  // Delete from Neon DB
  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      await sql`
        DELETE FROM voice_clones
        WHERE LOWER(name) = LOWER(${name});
      `;
    } catch (dbErr) {
      console.warn("Could not delete voice clone from DB:", dbErr.message);
    }
  }

  return {
    success: true,
    message: `Voice clone '${name}' deleted successfully`,
    voiceName: name,
    model: targetModel,
  };
}

/**
 * Synthesize speech from a registered voice clone.
 *
 * Automatically routes to Fish Audio S2 Pro or Qwen3-TTS based on the voice's engine.
 *
 * @param {Object} options
 * @param {string} options.voiceName
 * @param {string} options.text
 * @param {string} [options.language="English"]
 * @param {"fish" | "qwen" | null} [options.model=null]
 * @returns {Promise<Buffer>}
 */
export async function generateClonedAudio({
  voiceName,
  text,
  language = "English",
  model = null,
}) {
  const name = String(voiceName || "").trim();
  const content = String(text || "").trim();

  if (!name) throw new Error("voiceName is required");
  if (!content) throw new Error("text is required");

  let targetModel = model ? String(model).toLowerCase() : null;
  if (!targetModel) {
    targetModel = await getVoiceModel(name);
  }

  const baseUrl = await resolveModalVoiceCloneUrl(targetModel || "fish");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 360000); // 6 minutes timeout for cold starts and generation

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
      throw new Error(errData.detail || errData.error || `Voice synthesis failed (HTTP ${res.status} from ${baseUrl})`);
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
 *
 * Replays are served directly from Cloudflare R2 without contacting Modal.
 * If a legacy clone exists on Modal but has not yet been cached in R2,
 * it is backfilled once to R2 so that all subsequent replays hit R2.
 *
 * @param {string} voiceName
 * @param {"fish" | "qwen" | null} [model=null]
 * @returns {Promise<Buffer>}
 */
export async function getReferenceAudio(voiceName, model = null) {
  const name = String(voiceName || "").trim();
  if (!name) throw new Error("voiceName is required");

  let targetModel = model ? String(model).toLowerCase() : null;
  const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const r2Key = `voice-clones/${safeName}/reference.wav`;

  // Step 1: Check Neon DB for stored reference_audio_url & model
  let refAudioUrl = null;
  const sql = getDbSql();
  if (sql) {
    try {
      await initDbSchema();
      const rows = await sql`
        SELECT reference_audio_url, model 
        FROM voice_clones 
        WHERE LOWER(name) = LOWER(${name}) 
        LIMIT 1;
      `;
      refAudioUrl = rows?.[0]?.reference_audio_url;
      if (!targetModel && rows?.[0]?.model) {
        targetModel = rows[0].model;
      }
    } catch (dbErr) {
      console.warn("DB lookup for voice reference audio failed:", dbErr.message);
    }
  }

  // Step 2: Try direct S3 download from Cloudflare R2 (Modal is NOT contacted)
  try {
    const r2Buffer = await downloadFromR2(r2Key);
    if (r2Buffer && r2Buffer.length > 0) {
      return r2Buffer;
    }
  } catch (r2Err) {
    console.warn("[getReferenceAudio] Direct R2 download error:", r2Err.message);
  }

  // Step 3: If we have a public reference_audio_url, fetch directly from Cloudflare R2 CDN
  if (refAudioUrl && refAudioUrl.startsWith("http")) {
    try {
      const res = await fetch(refAudioUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch {}
  }

  // Step 4: Fallback for older legacy voices not yet cached in R2:
  // Fetch ONCE from Modal, cache/save to Cloudflare R2, and update DB.
  if (!targetModel) {
    targetModel = await getVoiceModel(name);
  }

  const baseUrl = await resolveModalVoiceCloneUrl(targetModel || "fish");
  let modalRes = await fetch(`${baseUrl}/voices/${encodeURIComponent(name)}/reference-audio`);
  if (!modalRes.ok) {
    const otherModel = targetModel === "qwen" ? "fish" : "qwen";
    const otherUrl = await resolveModalVoiceCloneUrl(otherModel);
    modalRes = await fetch(`${otherUrl}/voices/${encodeURIComponent(name)}/reference-audio`);
  }

  if (!modalRes.ok) {
    throw new Error(`Reference audio not found for voice '${name}'`);
  }

  const arrayBuffer = await modalRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Backfill save to Cloudflare R2 so this voice never contacts Modal on replays again
  (async () => {
    try {
      const uploadRes = await uploadToR2({
        key: r2Key,
        buffer,
        mimeType: "audio/wav",
        metadata: {
          voiceName: name,
          model: targetModel || "fish",
        },
      });
      if (sql && uploadRes?.publicUrl) {
        await sql`
          UPDATE voice_clones 
          SET reference_audio_url = ${uploadRes.publicUrl}, updated_at = NOW()
          WHERE LOWER(name) = LOWER(${name});
        `;
      }
    } catch (cacheErr) {
      console.warn(`[getReferenceAudio] Could not backfill reference audio for '${name}' to R2:`, cacheErr.message);
    }
  })();

  return buffer;
}

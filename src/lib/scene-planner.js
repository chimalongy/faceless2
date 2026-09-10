import { resolveImageDurations } from "@/lib/scene-timing";
import OpenAI from "openai";
import { getDbSql, initDbSchema } from "@/lib/db";
import { transcribeAudio } from "@/lib/transcription";
import { getScenePlannerPrompt } from "@/lib/LLMPrompts/ScenePlannerPrompt";

/**
 * Robustly extract a JSON array from LLM text output,
 * handling cases where explanatory text/brackets appear after the JSON array.
 */
export function extractJsonArray(text) {
  if (!text || typeof text !== "string") return null;

  let str = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    const direct = JSON.parse(str);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === "object") {
      if (Array.isArray(direct.timings)) return direct.timings;
      if (Array.isArray(direct.images)) return direct.images;
      if (Array.isArray(direct.scenes)) return direct.scenes;
      const vals = Object.values(direct);
      if (vals.length > 0 && typeof vals[0] === "object" && (vals[0].duration !== undefined || vals[0].start_time !== undefined || vals[0].image_number !== undefined)) {
        return vals;
      }
    }
  } catch (_) {}

  const startIdx = str.indexOf("[");
  if (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < str.length; i++) {
      const char = str[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "[") {
          depth++;
        } else if (char === "]") {
          depth--;
          if (depth === 0) {
            const candidate = str.slice(startIdx, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (Array.isArray(parsed)) return parsed;
            } catch (e) {
              try {
                const cleaned = candidate
                  .replace(/,\s*]/g, "]")
                  .replace(/,\s*}/g, "}");
                const p2 = JSON.parse(cleaned);
                if (Array.isArray(p2)) return p2;
              } catch (_) {}
            }
          }
        }
      }
    }
  }

  const arrayMatch = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try {
      const p = JSON.parse(arrayMatch[0]);
      if (Array.isArray(p)) return p;
    } catch (_) {
      try {
        const cleaned = arrayMatch[0].replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
        const p2 = JSON.parse(cleaned);
        if (Array.isArray(p2)) return p2;
      } catch (_) {}
    }
  }

  // Fallback: Check if the model wrapped output in an object like { "0": {...}, "1": {...} }
  const objMatch = str.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const pObj = JSON.parse(objMatch[0]);
      if (pObj && typeof pObj === "object" && !Array.isArray(pObj)) {
        if (Array.isArray(pObj.timings)) return pObj.timings;
        if (Array.isArray(pObj.images)) return pObj.images;
        const vals = Object.values(pObj);
        if (vals.length > 0 && typeof vals[0] === "object" && (vals[0].duration !== undefined || vals[0].start_time !== undefined || vals[0].image_number !== undefined)) {
          return vals;
        }
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Fallback helper: generate proportional timing slices across N images.
 */
export function generateProportionalTimings(images, totalDuration) {
  return normalizeTimings(null, images, totalDuration);
}

/**
 * Sanitize and validate timing outputs so there are zero gaps or overlaps,
 * and the entire audio duration is covered accurately.
 */
export function normalizeTimings(rawTimings, images, totalDuration) {
  if (!images.length) return [];
  const durations = resolveImageDurations(rawTimings, images.length, Number(totalDuration));
  let start = 0;
  return durations.map((duration, i) => {
    const end = i === durations.length - 1 ? Number(totalDuration) : start + duration;
    const timing = { image_number: images[i].image_number || i + 1,
      start_time: start, end_time: end, duration: end - start };
    start = end;
    return timing;
  });
}

/**
 * Plan scene timing:
 * 1. Transcribes audio via Whisper Modal API to obtain .ass subtitle timestamps.
 * 2. Invokes the ScenePlanner LLM with audio_text, .ass, duration, and image prompts.
 * 3. Returns validated, continuous start_time and duration for each image.
 */
export async function planSceneTiming({
  sceneNumber = 1,
  audioText = "",
  audioUrl = null,
  audioDuration = null,
  images = [],
  channelSlug = null,
  topicSlug = null,
  forceEqualSplit = false,
} = {}) {
  const safeDuration = Number(audioDuration);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
    throw new Error("Measured audioDuration is required for scene timing.");
  }

  // If only 1 image, or if equal split is explicitly requested, return equal proportional timings immediately
  if (forceEqualSplit || !Array.isArray(images) || images.length <= 1) {
    if (forceEqualSplit && Array.isArray(images) && images.length > 1) {
      console.log(`[ScenePlanner] Equal split explicitly requested for Scene ${sceneNumber}. Splitting duration (${safeDuration}s) equally across ${images.length} images.`);
    }
    return generateProportionalTimings(images, safeDuration);
  }

  try {
    // 1. Transcribe scene audio to get ASS timestamps
    let assContent = "";
    if (audioUrl) {
      try {
        console.log(`[ScenePlanner] Transcribing audio for Scene ${sceneNumber} via Whisper Modal...`);
        const transResult = await transcribeAudio({ audioUrl });
        assContent = transResult?.ass || "";
        console.log(`[ScenePlanner] Successfully received ASS transcription for Scene ${sceneNumber} (${assContent.length} chars).`);
      } catch (transErr) {
        console.warn(`[ScenePlanner] Whisper transcription warning for Scene ${sceneNumber}:`, transErr?.message || transErr);
      }
    }

    // 2. Fetch LLM settings & accounts from database
    let configuredModel = "gemini-2.5-flash";
    let gemmaBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    let openRouterBaseUrl = "https://openrouter.ai/api/v1";
    let sceneGenSource = "gemini";
    let executionAccounts = [];

    try {
      const sql = getDbSql();
      if (sql) {
        await initDbSchema();
        const generalRows = await sql`
          SELECT
            scene_gen_source AS "sceneGenSource",
            scene_gen_model AS "sceneGenModel",
            default_llm_source AS "defaultLlmSource",
            default_llm_model AS "defaultLlmModel",
            gemma_base_url AS "gemmaBaseUrl",
            open_router_base_url AS "openRouterBaseUrl"
          FROM general_settings
          LIMIT 1;
        `;

        if (generalRows?.[0]) {
          const g = generalRows[0];
          sceneGenSource = (g.defaultLlmSource || g.sceneGenSource || "gemini").trim().toLowerCase();
          configuredModel = (g.defaultLlmModel || g.sceneGenModel || "gemini-2.5-flash-lite").trim();
          if (g.gemmaBaseUrl) gemmaBaseUrl = g.gemmaBaseUrl;
          if (g.openRouterBaseUrl) openRouterBaseUrl = g.openRouterBaseUrl;
        }

        const rawAccounts = await sql`
          SELECT id, account_email AS "accountEmail", source, api_token AS "apiToken"
          FROM llm_accounts
          ORDER BY id ASC;
        `;

        if (rawAccounts && rawAccounts.length > 0) {
          const matching = rawAccounts.filter(
            (a) => (a.source || "gemini").trim().toLowerCase() === sceneGenSource
          );
          const others = rawAccounts.filter(
            (a) => (a.source || "gemini").trim().toLowerCase() !== sceneGenSource
          );
          executionAccounts = [...matching, ...others];
        }
      }
    } catch (dbErr) {
      console.warn("[ScenePlanner] DB config lookup warning:", dbErr?.message || dbErr);
    }

    // If no LLM accounts configured, fallback to proportional
    if (executionAccounts.length === 0) {
      console.warn(`[ScenePlanner] No LLM accounts available. Splitting image durations equally for Scene ${sceneNumber} (${safeDuration}s).`);
      return generateProportionalTimings(images, safeDuration);
    }

    // 3. Build prompt
    const prompt = getScenePlannerPrompt({
      sceneNumber,
      audioText,
      assContent,
      audioDuration: safeDuration,
      images,
    });

    // 4. Call LLM with account failover
    for (let i = 0; i < executionAccounts.length; i++) {
      const acc = executionAccounts[i];
      const source = (acc.source || "gemini").trim().toLowerCase();
      const token = (acc.apiToken || "").trim();
      if (!token) continue;

      const baseURL = source === "openrouter" ? openRouterBaseUrl : gemmaBaseUrl;

      const candidateModels = [configuredModel];
      if (source === "gemini") {
        for (const m of ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
          if (!candidateModels.includes(m)) candidateModels.push(m);
        }
      }

      const openai = new OpenAI({
        apiKey: token,
        baseURL,
      });

      for (const currentModel of candidateModels) {
        try {
          console.log(`[ScenePlanner] Calling LLM (${currentModel}) via ${source} for Scene ${sceneNumber}...`);
          const completion = await openai.chat.completions.create({
            model: currentModel,
            messages: [
              {
                role: "system",
                content: "You are an expert video director. You MUST return ONLY a top-level raw JSON array starting with '[' and ending with ']'. Never return a JSON object with numeric keys like {\"0\": ...} or wrapper objects. Return ONLY: [ { \"image_number\": 1, \"start_time\": 0.0, \"end_time\": ..., \"duration\": ... } ]. No markdown fences.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.2,
          });

          const rawContent = completion.choices?.[0]?.message?.content || "";
          const parsed = extractJsonArray(rawContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validated = normalizeTimings(parsed, images, safeDuration);
            console.log(`[ScenePlanner] Successfully planned Scene ${sceneNumber} image timings:`, validated);
            return validated;
          }
          throw new Error(`Could not parse valid JSON array from LLM response: ${rawContent.slice(0, 100)}...`);
        } catch (llmErr) {
          console.warn(`[ScenePlanner] Attempt with ${currentModel} on account ${i + 1} failed for Scene ${sceneNumber}:`, llmErr?.message || llmErr);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Fallback if all attempts fail
    console.warn(`[ScenePlanner] All LLM attempts failed for Scene ${sceneNumber}. Falling back to equal duration split to fill total audio length (${safeDuration}s).`);
    return generateProportionalTimings(images, safeDuration);
  } catch (error) {
    console.warn(`[ScenePlanner] Unhandled error during timing planning for Scene ${sceneNumber}: ${error?.message || error}. Falling back to equal duration split to fill total audio length (${safeDuration}s).`);
    return generateProportionalTimings(images, safeDuration);
  }
}

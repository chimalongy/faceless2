import OpenAI from "openai";
import { getDbSql, initDbSchema } from "@/lib/db";
import { transcribeAudio } from "@/lib/transcription";
import { getScenePlannerPrompt } from "@/lib/LLMPrompts/ScenePlannerPrompt";

/**
 * Fallback helper: generate proportional timing slices across N images.
 */
export function generateProportionalTimings(images, totalDuration) {
  const N = Math.max(1, images.length);
  const dur = Math.max(1.0, Number(totalDuration) || 5.0);
  const baseDuration = dur / N;

  return images.map((img, idx) => {
    const start = idx * baseDuration;
    const isLast = idx === N - 1;
    const end = isLast ? dur : (idx + 1) * baseDuration;
    const segmentDuration = end - start;

    return {
      image_number: img.image_number || idx + 1,
      start_time: Number(start.toFixed(2)),
      end_time: Number(end.toFixed(2)),
      duration: Number(segmentDuration.toFixed(2)),
    };
  });
}

/**
 * Sanitize and validate timing outputs so there are zero gaps or overlaps,
 * and the entire audio duration is covered accurately.
 */
export function normalizeTimings(rawTimings, images, totalDuration) {
  const N = images.length;
  const dur = Math.max(1.0, Number(totalDuration) || 5.0);

  if (!Array.isArray(rawTimings) || rawTimings.length !== N) {
    return generateProportionalTimings(images, dur);
  }

  const normalized = [];
  let currentStart = 0.0;

  for (let i = 0; i < N; i++) {
    const item = rawTimings[i];
    const isLast = i === N - 1;
    const imgNum = images[i].image_number || i + 1;

    let plannedDuration = Number(item.duration) || (Number(item.end_time) - Number(item.start_time));
    if (!Number.isFinite(plannedDuration) || plannedDuration < 0.5) {
      plannedDuration = (dur - currentStart) / (N - i);
    }

    let end = isLast ? dur : currentStart + plannedDuration;
    if (end > dur || isLast) {
      end = dur;
    }

    const duration = Math.max(0.2, end - currentStart);

    normalized.push({
      image_number: imgNum,
      start_time: Number(currentStart.toFixed(2)),
      end_time: Number(end.toFixed(2)),
      duration: Number(duration.toFixed(2)),
    });

    currentStart = end;
  }

  return normalized;
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
  audioDuration = 5.0,
  images = [],
  channelSlug = null,
  topicSlug = null,
} = {}) {
  const safeDuration = Math.max(1.0, Number(audioDuration) || 5.0);

  // If only 1 image, no planner needed
  if (!Array.isArray(images) || images.length <= 1) {
    return [
      {
        image_number: 1,
        start_time: 0.0,
        end_time: Number(safeDuration.toFixed(2)),
        duration: Number(safeDuration.toFixed(2)),
      },
    ];
  }

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
        sceneGenSource = (g.sceneGenSource || g.defaultLlmSource || "gemini").trim().toLowerCase();
        configuredModel = (g.sceneGenModel || g.defaultLlmModel || "gemini-2.5-flash").trim();
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
    console.warn(`[ScenePlanner] No LLM accounts available. Using proportional timing for Scene ${sceneNumber}.`);
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

    try {
      console.log(`[ScenePlanner] Calling LLM (${configuredModel}) via ${source} for Scene ${sceneNumber}...`);
      const openai = new OpenAI({
        apiKey: token,
        baseURL,
      });

      const completion = await openai.chat.completions.create({
        model: configuredModel,
        messages: [
          {
            role: "system",
            content: "You are an expert video director. Return ONLY a valid JSON array of image timing objects with image_number, start_time, end_time, duration. Do not include markdown code fences or any conversational text.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

      let content = (completion.choices?.[0]?.message?.content || "").trim();
      content = content.replace(/```json/gi, "").replace(/```/g, "").trim();

      const firstBracket = content.indexOf("[");
      const lastBracket = content.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        content = content.slice(firstBracket, lastBracket + 1);
      }

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validated = normalizeTimings(parsed, images, safeDuration);
        console.log(`[ScenePlanner] Successfully planned Scene ${sceneNumber} image timings:`, validated);
        return validated;
      }
    } catch (llmErr) {
      console.warn(`[ScenePlanner] LLM account attempt ${i + 1} failed for Scene ${sceneNumber}:`, llmErr?.message || llmErr);
    }
  }

  // Fallback if all attempts fail
  console.warn(`[ScenePlanner] Falling back to proportional timings for Scene ${sceneNumber}.`);
  return generateProportionalTimings(images, safeDuration);
}

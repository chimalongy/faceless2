import { getDbSql } from "./db.js";

export const DEFAULT_PROMPT_ENHANCER_URL =
  "https://longychima--qwen-image-2-1-pe-t2i-t4-qwenpet2i-web.modal.run";

/**
 * Resolves the Qwen PE-T2I prompt enhancement endpoint URL.
 * Priority:
 * 1. Explicitly passed customUrl
 * 2. Process env MODAL_PROMPT_ENHANCER_URL
 * 3. Database general_settings.modal_prompt_enhancer_url
 * 4. DEFAULT_PROMPT_ENHANCER_URL
 *
 * @param {string|null} customUrl
 * @returns {Promise<string>}
 */
export async function resolvePromptEnhancerUrl(customUrl = null) {
  if (customUrl && typeof customUrl === "string" && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, "");
  }

  if (process.env.MODAL_PROMPT_ENHANCER_URL && process.env.MODAL_PROMPT_ENHANCER_URL.trim()) {
    return process.env.MODAL_PROMPT_ENHANCER_URL.trim().replace(/\/+$/, "");
  }

  try {
    const sql = getDbSql();
    if (sql) {
      const rows = await sql`
        SELECT modal_prompt_enhancer_url AS "modalPromptEnhancerUrl"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;
      if (rows?.[0]?.modalPromptEnhancerUrl && rows[0].modalPromptEnhancerUrl.trim()) {
        return rows[0].modalPromptEnhancerUrl.trim().replace(/\/+$/, "");
      }
    }
  } catch (err) {
    console.warn("[PromptEnhancer] Could not query modal_prompt_enhancer_url from DB:", err?.message || err);
  }

  return DEFAULT_PROMPT_ENHANCER_URL;
}

/**
 * Enhances a raw image prompt using the Qwen-Image-2.1-PE-T2I model on Modal.
 * NOTE: Image generation STOPS if prompt enhancement fails. No unenhanced prompt will proceed.
 *
 * @param {string} prompt - The compiled scene prompt to enhance
 * @param {Object} [options={}]
 * @param {string} [options.endpointUrl] - Override URL
 * @param {number} [options.timeoutMs=300000] - Timeout in ms (default 5 minutes to accommodate CPU cold-starts)
 * @returns {Promise<string>} - The enhanced rewritten prompt
 * @throws {Error} If the prompt cannot be enhanced
 */
export async function enhanceImagePrompt(prompt, options = {}) {
  const { endpointUrl = null, timeoutMs = 300000 } = options;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("[PromptEnhancer] Cannot enhance an empty prompt.");
  }

  const cleanPrompt = prompt.trim();
  const targetUrl = await resolvePromptEnhancerUrl(endpointUrl);

  console.log(`[PromptEnhancer] Sending prompt to PE-T2I at ${targetUrl} (Timeout: ${timeoutMs / 1000}s)...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: cleanPrompt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Endpoint returned HTTP ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json().catch((jsonErr) => {
      throw new Error(`Failed to parse PE-T2I JSON response: ${jsonErr.message}`);
    });

    if (!data || data.success === false) {
      const errorMsg = data?.error || data?.message || "Unknown error from PE-T2I service";
      throw new Error(`PE-T2I returned failure: ${errorMsg}`);
    }

    const rewritten = data.rewritten_prompt;
    if (!rewritten || typeof rewritten !== "string" || !rewritten.trim()) {
      throw new Error("PE-T2I response succeeded but did not contain a valid 'rewritten_prompt'.");
    }

    const enhanced = rewritten.trim();
    console.log(
      `[PromptEnhancer] Successfully enhanced prompt (${cleanPrompt.length} chars -> ${enhanced.length} chars).`
    );

    return enhanced;
  } catch (error) {
    clearTimeout(timeoutId);

    const isTimeout = error.name === "AbortError";
    const failureReason = isTimeout
      ? `Request timed out after ${timeoutMs / 1000}s (cold-start or inference timeout)`
      : error.message;

    console.error(`[PromptEnhancer] Enhancement failed: ${failureReason}`);
    // Strict requirement: Image generation MUST stop if prompt is not enhanced.
    throw new Error(`[PromptEnhancer] Image generation halted: Prompt enhancement failed: ${failureReason}`);
  }
}

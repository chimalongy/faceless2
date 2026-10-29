/**
 * Normalizes an OpenAI-compatible base URL.
 * Strips any trailing '/chat/completions' or trailing slashes, because
 * OpenAI SDK automatically appends '/chat/completions' when invoking chat.completions.create().
 *
 * @param {string} url
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeBaseUrl(url, fallback = "") {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/chat\/completions$/i, "") || fallback;
}

/**
 * Resolves the appropriate baseURL for a given account source ('gemini', 'openrouter', 'nvidia').
 *
 * @param {string} accountSource
 * @param {Object} endpoints
 * @param {string} [endpoints.gemmaBaseUrl]
 * @param {string} [endpoints.openRouterBaseUrl]
 * @param {string} [endpoints.nvidiaBaseUrl]
 * @returns {string}
 */
export function resolveLlmBaseUrl(accountSource, { gemmaBaseUrl, openRouterBaseUrl, nvidiaBaseUrl } = {}) {
  const src = (accountSource || "gemini").trim().toLowerCase();
  if (src === "openrouter") {
    return normalizeBaseUrl(openRouterBaseUrl, "https://openrouter.ai/api/v1");
  }
  if (src === "nvidia") {
    return normalizeBaseUrl(nvidiaBaseUrl, "https://integrate.api.nvidia.com/v1");
  }
  return normalizeBaseUrl(gemmaBaseUrl, "https://generativelanguage.googleapis.com/v1beta/openai/");
}

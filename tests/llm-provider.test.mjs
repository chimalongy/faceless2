import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBaseUrl, resolveLlmBaseUrl } from "../src/lib/llm-provider.js";

test("normalizeBaseUrl trims trailing slashes and /chat/completions suffix", () => {
  assert.equal(
    normalizeBaseUrl("https://integrate.api.nvidia.com/v1/chat/completions"),
    "https://integrate.api.nvidia.com/v1"
  );
  assert.equal(
    normalizeBaseUrl("https://integrate.api.nvidia.com/v1/chat/completions/"),
    "https://integrate.api.nvidia.com/v1"
  );
  assert.equal(
    normalizeBaseUrl("https://integrate.api.nvidia.com/v1/"),
    "https://integrate.api.nvidia.com/v1"
  );
  assert.equal(
    normalizeBaseUrl("https://integrate.api.nvidia.com/v1"),
    "https://integrate.api.nvidia.com/v1"
  );
});

test("resolveLlmBaseUrl handles gemini, openrouter, and nvidia correctly", () => {
  const endpoints = {
    gemmaBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    openRouterBaseUrl: "https://openrouter.ai/api/v1",
    nvidiaBaseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
  };

  assert.equal(
    resolveLlmBaseUrl("nvidia", endpoints),
    "https://integrate.api.nvidia.com/v1"
  );
  assert.equal(
    resolveLlmBaseUrl("NVIDIA", endpoints),
    "https://integrate.api.nvidia.com/v1"
  );
  assert.equal(
    resolveLlmBaseUrl("openrouter", endpoints),
    "https://openrouter.ai/api/v1"
  );
  assert.equal(
    resolveLlmBaseUrl("gemini", endpoints),
    "https://generativelanguage.googleapis.com/v1beta/openai"
  );
  assert.equal(
    resolveLlmBaseUrl(null, endpoints),
    "https://generativelanguage.googleapis.com/v1beta/openai"
  );
});

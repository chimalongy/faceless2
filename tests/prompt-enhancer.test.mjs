import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROMPT_ENHANCER_URL,
  resolvePromptEnhancerUrl,
  enhanceImagePrompt,
} from "../src/lib/prompt-enhancer.js";

test("resolvePromptEnhancerUrl returns default when no overrides exist", async () => {
  const url = await resolvePromptEnhancerUrl(null);
  assert.equal(url, DEFAULT_PROMPT_ENHANCER_URL);
});

test("resolvePromptEnhancerUrl prioritizes explicit argument", async () => {
  const custom = "https://custom-enhancer.modal.run";
  const url = await resolvePromptEnhancerUrl(custom);
  assert.equal(url, custom);
});

test("enhanceImagePrompt throws on empty prompt", async () => {
  await assert.rejects(
    async () => {
      await enhanceImagePrompt("");
    },
    {
      message: /Cannot enhance an empty prompt/,
    }
  );
});

test("enhanceImagePrompt successfully returns rewritten prompt when PE-T2I succeeds", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.prompt, "An extreme close up of sneakers near pedals");
    return {
      ok: true,
      json: async () => ({
        success: true,
        rewritten_prompt: "Cinematic macro shot of pristine white sneakers resting on vehicle floor pedals with soft illumination.",
        wh_ratio: "16:9",
      }),
    };
  };

  try {
    const enhanced = await enhanceImagePrompt("An extreme close up of sneakers near pedals", {
      endpointUrl: "https://mock-pe.modal.run",
    });
    assert.equal(
      enhanced,
      "Cinematic macro shot of pristine white sneakers resting on vehicle floor pedals with soft illumination."
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enhanceImagePrompt halts and throws when PE-T2I returns failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: false,
      error: "PE-T2I CPU worker out of memory",
    }),
  });

  try {
    await assert.rejects(
      async () => {
        await enhanceImagePrompt("Test prompt", {
          endpointUrl: "https://mock-pe.modal.run",
        });
      },
      {
        message: /Image generation halted: Prompt enhancement failed: PE-T2I returned failure: PE-T2I CPU worker out of memory/,
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enhanceImagePrompt halts and throws on HTTP 500 error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    text: async () => "Container crashed",
  });

  try {
    await assert.rejects(
      async () => {
        await enhanceImagePrompt("Test prompt", {
          endpointUrl: "https://mock-pe.modal.run",
        });
      },
      {
        message: /Image generation halted: Prompt enhancement failed: Endpoint returned HTTP 500: Container crashed/,
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});


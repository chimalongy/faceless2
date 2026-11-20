import test from "node:test";
import assert from "node:assert/strict";
import {
  THUMBNAIL_ARCHETYPES,
  THUMBNAIL_ACCENT_COLORS,
  DEFAULT_THUMBNAIL_CONFIG,
  buildModularThumbnailPrompt,
} from "../src/lib/thumbnail-archetypes.js";

/**
 * Helper function replicating thumbnail dimension resolution logic
 */
function resolveThumbnailDimensions({ isShort, topic = {}, width = null, height = null }) {
  const isTopicShort = topic.videoType === "short" || topic.videoType === "shorts" || topic.aspectRatio === "9:16";
  const isShortVideo = isShort !== null && isShort !== undefined ? Boolean(isShort) : isTopicShort;
  const finalWidth = width ? Number(width) : isShortVideo ? 768 : 1376;
  const finalHeight = height ? Number(height) : isShortVideo ? 1376 : 768;
  return { width: finalWidth, height: finalHeight, isShort: isShortVideo };
}

/**
 * Helper function replicating prompt resolution logic
 */
function resolveThumbnailPrompt({ customPrompt, storedPrompt }) {
  const promptToUse = (customPrompt?.trim() || storedPrompt?.trim() || "");
  if (!promptToUse) {
    throw new Error("No thumbnail prompt found. Please generate or enter a thumbnail prompt first.");
  }
  return promptToUse;
}

/**
 * Helper function replicating R2 key formatting logic
 */
function buildThumbnailKey(channelSlug, topicSlug, timestamp, randomSuffix) {
  return `channels/${channelSlug}/topics/${topicSlug}/thumbnail/thumbnail-${timestamp}-${randomSuffix}.png`;
}

test("resolveThumbnailDimensions selects 16:9 (1376x768) for long-form content", () => {
  const dims = resolveThumbnailDimensions({ isShort: false });
  assert.equal(dims.width, 1376);
  assert.equal(dims.height, 768);
  assert.equal(dims.isShort, false);
});

test("resolveThumbnailDimensions selects 9:16 (768x1376) for short-form content", () => {
  const dims = resolveThumbnailDimensions({ isShort: true });
  assert.equal(dims.width, 768);
  assert.equal(dims.height, 1376);
  assert.equal(dims.isShort, true);
});

test("resolveThumbnailDimensions derives short format from topic videoType or aspectRatio when isShort is omitted", () => {
  const dimsShort = resolveThumbnailDimensions({ isShort: null, topic: { videoType: "shorts", aspectRatio: "9:16" } });
  assert.equal(dimsShort.width, 768);
  assert.equal(dimsShort.height, 1376);
  assert.equal(dimsShort.isShort, true);

  const dimsLong = resolveThumbnailDimensions({ isShort: null, topic: { videoType: "longform", aspectRatio: "16:9" } });
  assert.equal(dimsLong.width, 1376);
  assert.equal(dimsLong.height, 768);
  assert.equal(dimsLong.isShort, false);
});

test("resolveThumbnailDimensions allows explicit width and height overrides", () => {
  const dims = resolveThumbnailDimensions({ isShort: false, width: 1920, height: 1080 });
  assert.equal(dims.width, 1920);
  assert.equal(dims.height, 1080);
});

test("resolveThumbnailPrompt prioritizes customPrompt over storedPrompt", () => {
  const prompt = resolveThumbnailPrompt({
    customPrompt: "A high-contrast cinematic portrait of Marcus Aurelius",
    storedPrompt: "A generic Roman statue",
  });
  assert.equal(prompt, "A high-contrast cinematic portrait of Marcus Aurelius");
});

test("resolveThumbnailPrompt falls back to storedPrompt when customPrompt is empty", () => {
  const prompt = resolveThumbnailPrompt({
    customPrompt: "  ",
    storedPrompt: "A generic Roman statue",
  });
  assert.equal(prompt, "A generic Roman statue");
});

test("resolveThumbnailPrompt throws when both customPrompt and storedPrompt are empty", () => {
  assert.throws(
    () => resolveThumbnailPrompt({ customPrompt: "", storedPrompt: "" }),
    /No thumbnail prompt found/
  );
  assert.throws(
    () => resolveThumbnailPrompt({ customPrompt: null, storedPrompt: undefined }),
    /No thumbnail prompt found/
  );
});

test("buildThumbnailKey generates the correct Cloudflare R2 path hierarchy", () => {
  const key = buildThumbnailKey("the-stoic-core", "meditations-ch-1", 1700000000000, "abc123");
  assert.equal(
    key,
    "channels/the-stoic-core/topics/meditations-ch-1/thumbnail/thumbnail-1700000000000-abc123.png"
  );
});

test("THUMBNAIL_ARCHETYPES defines 5 core high-CTR archetypes with formulas", () => {
  const expectedKeys = [
    "documentary_noir",
    "split_dilemma",
    "colossal_anomaly",
    "extreme_eye_contact",
    "redacted_secret",
  ];
  for (const key of expectedKeys) {
    const arch = THUMBNAIL_ARCHETYPES[key];
    assert.ok(arch, `Missing archetype: ${key}`);
    assert.ok(arch.name);
    assert.ok(arch.badge);
    assert.ok(arch.compositionFormula);
    assert.ok(arch.recommendedFor);
  }
});

test("THUMBNAIL_ACCENT_COLORS defines 5 contrast accent palettes with lighting modifiers", () => {
  const expectedColors = [
    "golden_amber",
    "crimson_alert",
    "toxic_emerald",
    "cyber_cyan",
    "pure_white",
  ];
  for (const key of expectedColors) {
    const color = THUMBNAIL_ACCENT_COLORS[key];
    assert.ok(color, `Missing accent color: ${key}`);
    assert.ok(color.hex);
    assert.ok(color.promptModifier);
  }
});

test("DEFAULT_THUMBNAIL_CONFIG provides fallback defaults", () => {
  assert.equal(DEFAULT_THUMBNAIL_CONFIG.archetype, "documentary_noir");
  assert.equal(DEFAULT_THUMBNAIL_CONFIG.accentColor, "golden_amber");
  assert.equal(DEFAULT_THUMBNAIL_CONFIG.useMainCharacter, true);
});

test("buildModularThumbnailPrompt creates structured modular prompt for diffusion models", () => {
  const prompt = buildModularThumbnailPrompt({
    archetypeKey: "documentary_noir",
    accentColorKey: "golden_amber",
    topicTitle: "The Federal Reserve Trap",
    concept: {
      angle_name: "Character Tension",
      focal_hook: "Holding a burning treasury bond while shadowy silhouettes watch",
    },
    character: {
      name: "The Observer",
      physical_spec: "30-year-old man, short buzz cut, athletic build",
      signature_feature: "matte amber-tinted glasses",
      wardrobe: "burnt-orange overshirt, dark denim trousers",
    },
    customRules: "No text overlays or typography inside image",
  });

  assert.ok(prompt.includes("16:9 YouTube thumbnail in Documentary Noir composition."));
  assert.ok(prompt.includes("PRIMARY SUBJECT: The Observer (30-year-old man, short buzz cut, athletic build)"));
  assert.ok(prompt.includes("with matte amber-tinted glasses"));
  assert.ok(prompt.includes("wearing burnt-orange overshirt, dark denim trousers"));
  assert.ok(prompt.includes("LIGHTING & CONTRAST:"));
  assert.ok(prompt.includes("golden amber rim light"));
  assert.ok(prompt.includes("THE CURIOSITY HOOK: Holding a burning treasury bond while shadowy silhouettes watch"));
  assert.ok(prompt.includes("BACKGROUND: Deep dark obsidian negative space"));
  assert.ok(prompt.includes("ADDITIONAL RULES: No text overlays or typography inside image"));
});

test("buildModularThumbnailPrompt handles fallback when character is not provided", () => {
  const prompt = buildModularThumbnailPrompt({
    archetypeKey: "split_dilemma",
    accentColorKey: "crimson_alert",
    topicTitle: "Why 99% Fail in Crypto",
  });

  assert.ok(prompt.includes("The Split Dilemma"));
  assert.ok(prompt.includes("Central dramatic protagonist"));
  assert.ok(prompt.includes("crimson red rim light"));
});

test("buildModularThumbnailPrompt integrates bold text hook when provided", () => {
  const prompt = buildModularThumbnailPrompt({
    archetypeKey: "documentary_noir",
    accentColorKey: "golden_amber",
    topicTitle: "The Federal Reserve Trap",
    concept: {
      text_hook: "THE TRAP",
      focal_hook: "Burning bond",
    },
    includeTextHook: true,
  });

  assert.ok(prompt.includes('TYPOGRAPHY & TEXT HOOK: Bold, punchy high-contrast typography reading "THE TRAP"'));
});

test("buildModularThumbnailPrompt enforces zero text when includeTextHook is false", () => {
  const prompt = buildModularThumbnailPrompt({
    archetypeKey: "documentary_noir",
    accentColorKey: "golden_amber",
    topicTitle: "The Federal Reserve Trap",
    concept: {
      focal_hook: "Burning bond",
    },
    includeTextHook: false,
  });

  assert.ok(prompt.includes("Zero text overlays, zero typography, clean cinematic visual."));
});

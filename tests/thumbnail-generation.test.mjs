import test from "node:test";
import assert from "node:assert/strict";

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

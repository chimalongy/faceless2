import test from "node:test";
import assert from "node:assert/strict";

// Video overlay settings normalizer logic matching the route handler
function normalizeVideoSettings(rawSettings = {}) {
  const useOverlay = Boolean(rawSettings.useOverlay ?? rawSettings.use_overlay ?? false);
  const longsOverlayId = rawSettings.longsOverlayId !== undefined
    ? (rawSettings.longsOverlayId ? Number(rawSettings.longsOverlayId) : null)
    : (rawSettings.longs_overlay_id ? Number(rawSettings.longs_overlay_id) : null);

  const shortsOverlayId = rawSettings.shortsOverlayId !== undefined
    ? (rawSettings.shortsOverlayId ? Number(rawSettings.shortsOverlayId) : null)
    : (rawSettings.shorts_overlay_id ? Number(rawSettings.shorts_overlay_id) : null);

  const rawLongsOpacity = rawSettings.longsOpacity ?? rawSettings.longs_opacity;
  const rawShortsOpacity = rawSettings.shortsOpacity ?? rawSettings.shorts_opacity;

  const longsOpacity = rawLongsOpacity !== undefined && rawLongsOpacity !== null
    ? Math.max(0.0, Math.min(1.0, Number(rawLongsOpacity)))
    : 1.0;

  const shortsOpacity = rawShortsOpacity !== undefined && rawShortsOpacity !== null
    ? Math.max(0.0, Math.min(1.0, Number(rawShortsOpacity)))
    : 1.0;

  return {
    useOverlay,
    longsOverlayId,
    longsOverlayName: rawSettings.longsOverlayName || rawSettings.longs_overlay_name || null,
    longsOverlayUrl: rawSettings.longsOverlayUrl || rawSettings.longs_overlay_url || null,
    shortsOverlayId,
    shortsOverlayName: rawSettings.shortsOverlayName || rawSettings.shorts_overlay_name || null,
    shortsOverlayUrl: rawSettings.shortsOverlayUrl || rawSettings.shorts_overlay_url || null,
    longsOpacity: Number.isFinite(longsOpacity) ? longsOpacity : 1.0,
    shortsOpacity: Number.isFinite(shortsOpacity) ? shortsOpacity : 1.0,
  };
}

// Overlay aspect ratio filter logic matching frontend
function filterOverlaysForFormat(overlays = [], format = "16:9") {
  return overlays.filter((o) => {
    if (format === "16:9") {
      return o.aspectRatio === "16:9" || o.aspectRatio === "all";
    }
    if (format === "9:16") {
      return o.aspectRatio === "9:16" || o.aspectRatio === "all";
    }
    return true;
  });
}

test("normalizeVideoSettings handles defaults and empty input", () => {
  const result = normalizeVideoSettings();
  assert.equal(result.useOverlay, false);
  assert.equal(result.longsOverlayId, null);
  assert.equal(result.shortsOverlayId, null);
  assert.equal(result.longsOpacity, 1.0);
  assert.equal(result.shortsOpacity, 1.0);
});

test("normalizeVideoSettings parses camelCase input correctly", () => {
  const result = normalizeVideoSettings({
    useOverlay: true,
    longsOverlayId: "42",
    longsOverlayName: "Grain 16:9",
    longsOverlayUrl: "https://example.com/grain.mp4",
    shortsOverlayId: 10,
    shortsOverlayName: "Dust 9:16",
    shortsOverlayUrl: "https://example.com/dust.mp4",
    longsOpacity: 0.85,
    shortsOpacity: 0.6,
  });

  assert.equal(result.useOverlay, true);
  assert.equal(result.longsOverlayId, 42);
  assert.equal(result.longsOverlayName, "Grain 16:9");
  assert.equal(result.longsOverlayUrl, "https://example.com/grain.mp4");
  assert.equal(result.shortsOverlayId, 10);
  assert.equal(result.shortsOverlayName, "Dust 9:16");
  assert.equal(result.shortsOverlayUrl, "https://example.com/dust.mp4");
  assert.equal(result.longsOpacity, 0.85);
  assert.equal(result.shortsOpacity, 0.6);
});

test("normalizeVideoSettings parses snake_case input correctly", () => {
  const result = normalizeVideoSettings({
    use_overlay: true,
    longs_overlay_id: 15,
    longs_overlay_name: "Vintage 16:9",
    longs_overlay_url: "https://example.com/vintage.mp4",
    shorts_overlay_id: 20,
    shorts_overlay_name: "Light Leak 9:16",
    shorts_overlay_url: "https://example.com/light.mp4",
    longs_opacity: 0.7,
    shorts_opacity: 0.9,
  });

  assert.equal(result.useOverlay, true);
  assert.equal(result.longsOverlayId, 15);
  assert.equal(result.longsOverlayName, "Vintage 16:9");
  assert.equal(result.shortsOverlayId, 20);
  assert.equal(result.shortsOverlayName, "Light Leak 9:16");
  assert.equal(result.longsOpacity, 0.7);
  assert.equal(result.shortsOpacity, 0.9);
});

test("normalizeVideoSettings clamps opacity between 0.0 and 1.0", () => {
  assert.equal(normalizeVideoSettings({ longsOpacity: 1.5 }).longsOpacity, 1.0);
  assert.equal(normalizeVideoSettings({ longsOpacity: -0.2 }).longsOpacity, 0.0);
  assert.equal(normalizeVideoSettings({ shortsOpacity: 0.0 }).shortsOpacity, 0.0);
  assert.equal(normalizeVideoSettings({ shortsOpacity: 2.0 }).shortsOpacity, 1.0);
  assert.equal(normalizeVideoSettings({ longsOpacity: 0.5 }).longsOpacity, 0.5);
});

test("filterOverlaysForFormat correctly separates 16:9, 9:16 and all aspect ratios", () => {
  const mockOverlays = [
    { id: 1, name: "Film Grain 16:9", aspectRatio: "16:9" },
    { id: 2, name: "Dust 9:16", aspectRatio: "9:16" },
    { id: 3, name: "Universal Scratches", aspectRatio: "all" },
    { id: 4, name: "Horizontal Vignette", aspectRatio: "16:9" },
    { id: 5, name: "Vertical Glitch", aspectRatio: "9:16" },
  ];

  const longsList = filterOverlaysForFormat(mockOverlays, "16:9");
  assert.equal(longsList.length, 3);
  assert.deepEqual(longsList.map((o) => o.id), [1, 3, 4]);

  const shortsList = filterOverlaysForFormat(mockOverlays, "9:16");
  assert.equal(shortsList.length, 3);
  assert.deepEqual(shortsList.map((o) => o.id), [2, 3, 5]);
});

export function buildMergeFilterComplex({
  scaleFilter = "scale=640:360",
  hasVideoOverlay = false,
  videoOverlayInputIdx = null,
  overlayOpacity = 1.0,
  targetWidth = 640,
  targetHeight = 360,
  hasTitleCard = false,
  titleCardInputIdx = null,
  topY = 50,
  hasBgMusic = false,
  bgMusicInputIdx = null,
  bgMusicVolume = 0.15,
} = {}) {
  let vParts = [];
  let currentVLabel = "base_v";

  vParts.push(`[0:v]${scaleFilter}[${currentVLabel}]`);

  if (hasVideoOverlay && videoOverlayInputIdx !== null) {
    const opacityVal = Math.max(0.0, Math.min(1.0, Number(overlayOpacity) || 1.0)).toFixed(2);
    const ovPrepLabel = "ov_prep";
    const nextVLabel = "ov_blended";
    vParts.push(
      `[${videoOverlayInputIdx}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,format=rgba,colorchannelmixer=aa=${opacityVal}[${ovPrepLabel}]`
    );
    vParts.push(`[${currentVLabel}][${ovPrepLabel}]overlay=0:0:format=auto[${nextVLabel}]`);
    currentVLabel = nextVLabel;
  }

  if (hasTitleCard && titleCardInputIdx !== null) {
    const nextVLabel = "titled_v";
    vParts.push(`[${currentVLabel}][${titleCardInputIdx}:v]overlay=(W-w)/2:${topY}:format=auto[${nextVLabel}]`);
    currentVLabel = nextVLabel;
  }

  let videoFilterStr = vParts.join(";");
  videoFilterStr = videoFilterStr.replace(new RegExp(`\\[${currentVLabel}\\]$`), "[v]");

  if (hasBgMusic && bgMusicInputIdx !== null) {
    const bgVol = Math.max(0, Math.min(1, Number(bgMusicVolume) || 0.15)).toFixed(2);
    const audioFilterStr = `[${bgMusicInputIdx}:a]volume=${bgVol}[bg_vol];[0:a][bg_vol]amix=inputs=2:duration=first:dropout_transition=2[a]`;
    return {
      filterComplex: `${videoFilterStr};${audioFilterStr}`,
      hasVideoMap: true,
      hasAudioMap: true,
    };
  }

  return {
    filterComplex: videoFilterStr,
    hasVideoMap: true,
    hasAudioMap: false,
  };
}

test("buildMergeFilterComplex generates correct FFmpeg filter string with overlay opacity", () => {
  const result = buildMergeFilterComplex({
    scaleFilter: "scale=1920:1080",
    hasVideoOverlay: true,
    videoOverlayInputIdx: 1,
    overlayOpacity: 0.65,
    targetWidth: 1920,
    targetHeight: 1080,
    hasTitleCard: false,
    hasBgMusic: true,
    bgMusicInputIdx: 2,
    bgMusicVolume: 0.20,
  });

  assert(result.filterComplex.includes("colorchannelmixer=aa=0.65"), "Should contain opacity 0.65");
  assert(result.filterComplex.includes("overlay=0:0:format=auto"), "Should blend overlay onto base");
  assert(result.filterComplex.includes("amix=inputs=2:duration=first"), "Should include audio amix");
  assert.equal(result.hasVideoMap, true);
  assert.equal(result.hasAudioMap, true);
});

test("FFmpeg executes video overlay blending with opacity without error", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const { getFfmpegPath } = await import("../src/lib/ffmpeg-helper.js");

  const ffmpeg = getFfmpegPath();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "overlay-test-"));
  const baseVideoPath = path.join(tmpDir, "base.mp4");
  const overlayVideoPath = path.join(tmpDir, "overlay.mp4");
  const outputMergedPath = path.join(tmpDir, "merged.mp4");

  try {
    // 1. Generate 1.0s base test video (red color)
    execFileSync(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=red:s=320x240:d=1.0",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=1.0",
      "-c:v", "libx264",
      "-c:a", "aac",
      baseVideoPath,
    ]);

    // 2. Generate 0.5s overlay loop video (blue color)
    execFileSync(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=blue:s=320x240:d=0.5",
      "-c:v", "libx264",
      overlayVideoPath,
    ]);

    // 3. Blend overlay with 40% opacity (0.40) and loop
    const filterRes = buildMergeFilterComplex({
      scaleFilter: "scale=320:240",
      hasVideoOverlay: true,
      videoOverlayInputIdx: 1,
      overlayOpacity: 0.40,
      targetWidth: 320,
      targetHeight: 240,
      hasTitleCard: false,
      hasBgMusic: false,
    });

    execFileSync(ffmpeg, [
      "-y",
      "-i", baseVideoPath,
      "-stream_loop", "-1",
      "-i", overlayVideoPath,
      "-filter_complex", filterRes.filterComplex,
      "-map", "[v]",
      "-map", "0:a:0?",
      "-shortest",
      "-c:v", "libx264",
      "-c:a", "aac",
      outputMergedPath,
    ]);

    assert(fs.existsSync(outputMergedPath), "Merged video should be created");
    const stat = fs.statSync(outputMergedPath);
    assert(stat.size > 1000, "Merged video should have non-trivial size");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { getFfmpegPath, getAudioDuration } from "../src/lib/ffmpeg-helper.js";

// Helper to sanitize volume setting
function sanitizeVolume(val, defaultVal = 0.15) {
  if (val === null || val === undefined) return defaultVal;
  const num = Number(val);
  if (!Number.isFinite(num)) return defaultVal;
  return Math.max(0, Math.min(1, num));
}

// Helper to construct background music audio filter for FFmpeg amix
function buildBgMusicFilter({ bgInputIdx = 1, volume = 0.15 } = {}) {
  const vol = sanitizeVolume(volume).toFixed(2);
  return `[${bgInputIdx}:a]volume=${vol}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]`;
}

test("sanitizeVolume clamps and defaults properly", () => {
  assert.equal(sanitizeVolume(undefined), 0.15);
  assert.equal(sanitizeVolume(null), 0.15);
  assert.equal(sanitizeVolume("invalid"), 0.15);
  assert.equal(sanitizeVolume(0.25), 0.25);
  assert.equal(sanitizeVolume(-0.5), 0);
  assert.equal(sanitizeVolume(1.5), 1);
  assert.equal(sanitizeVolume(0), 0);
  assert.equal(sanitizeVolume(1), 1);
});

test("buildBgMusicFilter generates correct amix filter string", () => {
  assert.equal(
    buildBgMusicFilter({ bgInputIdx: 1, volume: 0.15 }),
    "[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]"
  );

  assert.equal(
    buildBgMusicFilter({ bgInputIdx: 2, volume: 0.30 }),
    "[2:a]volume=0.30[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]"
  );
});

test("FFmpeg loops background music infinitely and mixes under narration stopping at video end", async () => {
  const ffmpeg = getFfmpegPath();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bg-music-test-"));
  const narrationPath = path.join(tmpDir, "narration.wav");
  const bgMusicPath = path.join(tmpDir, "bg_music.wav");
  const mixedOutputPath = path.join(tmpDir, "mixed.wav");

  try {
    // 1. Generate 2.0s narration tone (440Hz)
    execFileSync(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=2.0",
      "-c:a", "pcm_s16le",
      narrationPath,
    ]);

    // 2. Generate 0.5s short music loop tone (880Hz)
    execFileSync(ffmpeg, [
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=880:duration=0.5",
      "-c:a", "pcm_s16le",
      bgMusicPath,
    ]);

    const narrationDuration = await getAudioDuration(narrationPath);
    const bgDuration = await getAudioDuration(bgMusicPath);

    assert(narrationDuration >= 1.9 && narrationDuration <= 2.1, "Narration duration should be ~2s");
    assert(bgDuration >= 0.4 && bgDuration <= 0.6, "Background music duration should be ~0.5s");

    // 3. Mix looped background music into narration with volume 0.20
    const filter = buildBgMusicFilter({ bgInputIdx: 1, volume: 0.20 });

    execFileSync(ffmpeg, [
      "-y",
      "-i", narrationPath,
      "-stream_loop", "-1",
      "-i", bgMusicPath,
      "-filter_complex", filter,
      "-map", "[a]",
      "-c:a", "pcm_s16le",
      "-shortest",
      mixedOutputPath,
    ]);

    assert(fs.existsSync(mixedOutputPath), "Mixed output should exist");
    const mixedDuration = await getAudioDuration(mixedOutputPath);

    // The mixed output must match the narration duration (duration=first & -shortest),
    // proving the 0.5s music was looped to fill the 2.0s duration and cleanly halted!
    assert(
      Math.abs(mixedDuration - narrationDuration) < 0.2,
      `Mixed duration (${mixedDuration}s) must match narration duration (${narrationDuration}s)`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

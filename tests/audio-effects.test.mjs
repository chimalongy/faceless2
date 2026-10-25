import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  AUDIO_EFFECT_PRESETS,
  buildAudioFilterString,
  applyAudioEffects,
} from "../src/lib/audio-effects.js";
import { getFfmpegPath } from "../src/lib/ffmpeg-helper.js";

test("buildAudioFilterString compiles stoic_deep preset correctly", () => {
  const filter = buildAudioFilterString({ preset: "stoic_deep" });
  assert.equal(filter, "rubberband=pitch=0.75,equalizer=f=125:t=q:w=1:g=2.5");
});

test("buildAudioFilterString respects customFilter override", () => {
  const custom = "rubberband=pitch=0.65,volume=1.5";
  const filter = buildAudioFilterString({
    preset: "custom",
    customFilter: custom,
  });
  assert.equal(filter, custom);
});

test("buildAudioFilterString compiles pitch and equalizer parameters dynamically", () => {
  const filter = buildAudioFilterString({
    pitch: 0.82,
    equalizer: {
      enabled: true,
      frequency: 140,
      width: 1.2,
      gain: 3.5,
    },
  });
  assert.equal(filter, "rubberband=pitch=0.82,equalizer=f=140:t=q:w=1.2:g=3.5");
});

test("applyAudioEffects returns untouched buffer when disabled", async () => {
  const dummyBuffer = Buffer.from("RIFFdummywaveheaderandcontent");
  const result = await applyAudioEffects(dummyBuffer, { enabled: false });
  assert.equal(result.changed, false);
  assert.equal(result.buffer, dummyBuffer);
});

test("applyAudioEffects processes audio via FFmpeg with rubberband and equalizer filter", async () => {
  const ffmpegPath = getFfmpegPath();
  const tempWav = path.join(os.tmpdir(), `test-tone-${Date.now()}.wav`);

  // Generate 0.5s test sine wave with FFmpeg
  execFileSync(ffmpegPath, [
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=0.5",
    "-c:a",
    "pcm_s16le",
    "-y",
    tempWav,
  ]);

  const rawWavBuffer = fs.readFileSync(tempWav);
  fs.unlinkSync(tempWav);

  assert.ok(rawWavBuffer.length > 0, "Input test WAV should have length > 0");

  const fxResult = await applyAudioEffects(rawWavBuffer, {
    enabled: true,
    preset: "stoic_deep",
  });

  assert.equal(fxResult.changed, true);
  assert.equal(
    fxResult.filterApplied,
    "rubberband=pitch=0.75,equalizer=f=125:t=q:w=1:g=2.5"
  );
  assert.ok(
    fxResult.buffer instanceof Buffer && fxResult.buffer.length > 0,
    "Output filtered buffer must be valid"
  );
});

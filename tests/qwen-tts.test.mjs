import test from "node:test";
import assert from "node:assert/strict";
import { QWEN_VOICES, KOKORO_VOICES, isQwenVoice } from "../src/lib/audio-generator.js";

test("QWEN_VOICES catalog includes all 9 requested speakers with native language metadata", () => {
  assert.equal(QWEN_VOICES.length, 9);

  const voiceMap = new Map(QWEN_VOICES.map((v) => [v.id, v]));

  // Verify all 9 speakers
  assert.ok(voiceMap.has("Vivian"));
  assert.equal(voiceMap.get("Vivian").lang, "Chinese");
  assert.equal(voiceMap.get("Vivian").description, "Bright, slightly edgy young female");

  assert.ok(voiceMap.has("Serena"));
  assert.equal(voiceMap.get("Serena").lang, "Chinese");
  assert.equal(voiceMap.get("Serena").description, "Warm, gentle young female");

  assert.ok(voiceMap.has("Uncle_Fu"));
  assert.equal(voiceMap.get("Uncle_Fu").lang, "Chinese");
  assert.equal(voiceMap.get("Uncle_Fu").description, "Seasoned male, low and mellow timbre");

  assert.ok(voiceMap.has("Dylan"));
  assert.equal(voiceMap.get("Dylan").lang, "Chinese (Beijing dialect)");
  assert.equal(voiceMap.get("Dylan").description, "Youthful male, clear and natural");

  assert.ok(voiceMap.has("Eric"));
  assert.equal(voiceMap.get("Eric").lang, "Chinese (Sichuan dialect)");
  assert.equal(voiceMap.get("Eric").description, "Lively male, slightly husky brightness");

  assert.ok(voiceMap.has("Ryan"));
  assert.equal(voiceMap.get("Ryan").lang, "English");
  assert.equal(voiceMap.get("Ryan").description, "Dynamic male with strong rhythmic drive");

  assert.ok(voiceMap.has("Aiden"));
  assert.equal(voiceMap.get("Aiden").lang, "English");
  assert.equal(voiceMap.get("Aiden").description, "Sunny American male, clear midrange");

  assert.ok(voiceMap.has("Ono_Anna"));
  assert.equal(voiceMap.get("Ono_Anna").lang, "Japanese");
  assert.equal(voiceMap.get("Ono_Anna").description, "Playful female, light and nimble");

  assert.ok(voiceMap.has("Sohee"));
  assert.equal(voiceMap.get("Sohee").lang, "Korean");
  assert.equal(voiceMap.get("Sohee").description, "Warm female with rich emotion");
});

test("isQwenVoice detects Qwen voices accurately and ignores Kokoro voices", () => {
  // Qwen speakers
  assert.equal(isQwenVoice("Ryan"), true);
  assert.equal(isQwenVoice("ryan"), true);
  assert.equal(isQwenVoice("Aiden"), true);
  assert.equal(isQwenVoice("Vivian"), true);
  assert.equal(isQwenVoice("Uncle_Fu"), true);
  assert.equal(isQwenVoice("Dylan"), true);
  assert.equal(isQwenVoice("Eric"), true);
  assert.equal(isQwenVoice("Ono_Anna"), true);
  assert.equal(isQwenVoice("Sohee"), true);

  // Kokoro voices
  assert.equal(isQwenVoice("af_heart"), false);
  assert.equal(isQwenVoice("am_adam"), false);
  assert.equal(isQwenVoice("bf_emma"), false);
  assert.equal(isQwenVoice("invalid_voice"), false);
  assert.equal(isQwenVoice(""), false);
  assert.equal(isQwenVoice(null), false);
});

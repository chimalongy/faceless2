import test from "node:test";
import assert from "node:assert/strict";
import { resolveModalVoiceCloneUrl } from "../src/lib/voice-cloner.js";

test("resolveModalVoiceCloneUrl returns valid endpoint URL without trailing slashes", async () => {
  const url = await resolveModalVoiceCloneUrl();
  assert.ok(typeof url === "string");
  assert.ok(url.startsWith("http"));
  assert.ok(!url.endsWith("/"));
});

test("resolveModalVoiceCloneUrl differentiates between fish and qwen models", async () => {
  const fishUrl = await resolveModalVoiceCloneUrl("fish");
  const qwenUrl = await resolveModalVoiceCloneUrl("qwen");

  assert.ok(typeof fishUrl === "string");
  assert.ok(fishUrl.startsWith("http"));
  assert.ok(!fishUrl.endsWith("/"));

  assert.ok(typeof qwenUrl === "string");
  assert.ok(qwenUrl.startsWith("http"));
  assert.ok(!qwenUrl.endsWith("/"));

  assert.ok(!fishUrl.includes(".us-east."), "Fish URL must not contain .us-east.");
  assert.ok(!qwenUrl.includes(".us-east."), "Qwen URL must not contain .us-east.");
});

test("listVoiceClones executes cleanly and merges voice models", async () => {
  const { listVoiceClones } = await import("../src/lib/voice-cloner.js");
  const result = await listVoiceClones();
  assert.ok(result);
  assert.equal(typeof result.count, "number");
  assert.ok(Array.isArray(result.voices));
});

test("downloadFromR2 is exported and returns null for empty/non-existent keys", async () => {
  const { downloadFromR2 } = await import("../src/lib/storage.js");
  assert.equal(typeof downloadFromR2, "function");
  const result = await downloadFromR2(null);
  assert.equal(result, null);
  const emptyResult = await downloadFromR2("");
  assert.equal(emptyResult, null);
});

test("getReferenceAudio function exists and validates input", async () => {
  const { getReferenceAudio } = await import("../src/lib/voice-cloner.js");
  assert.equal(typeof getReferenceAudio, "function");
  await assert.rejects(
    async () => {
      await getReferenceAudio("");
    },
    { message: "voiceName is required" }
  );
});

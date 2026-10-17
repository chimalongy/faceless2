import test from "node:test";
import assert from "node:assert/strict";
import { resolveModalVoiceCloneUrl } from "../src/lib/voice-cloner.js";

test("resolveModalVoiceCloneUrl returns valid endpoint URL without trailing slashes", async () => {
  const url = await resolveModalVoiceCloneUrl();
  assert.ok(typeof url === "string");
  assert.ok(url.startsWith("http"));
  assert.ok(!url.endsWith("/"));
});

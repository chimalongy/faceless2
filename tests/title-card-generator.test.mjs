import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { wrapTitleText, generateTitleCardPng } from "../src/lib/title-card-generator.js";

test("wrapTitleText splits long titles into balanced lines", () => {
  const shortTitle = "Top 5 AI Tools";
  const wrappedShort = wrapTitleText(shortTitle, 20);
  assert.deepEqual(wrappedShort, ["Top 5 AI Tools"]);

  const longTitle = "The Mind Bending Reality Behind Quantum Superposition and Parallel Universes in Modern Physics";
  const wrappedLong = wrapTitleText(longTitle, 24);
  assert.ok(wrappedLong.length <= 3, "Should have at most 3 lines");
  assert.ok(wrappedLong[2].endsWith("..."), "Third line should have ellipsis when truncated");
});

test("generateTitleCardPng creates a valid PNG title card sticker", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "title-card-test-"));
  const targetPng = path.join(tmpDir, "title_card.png");

  try {
    const result = await generateTitleCardPng("Secrets of Ancient Egypt", targetPng, { width: 1080 });
    assert.equal(result, targetPng);
    assert.ok(fs.existsSync(targetPng), "Output PNG must exist");
    const stat = fs.statSync(targetPng);
    assert.ok(stat.size > 500, `Output PNG should be a valid image file, got size ${stat.size}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

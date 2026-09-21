import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAssTime,
  parseAssTime,
  extractWordsFromTranscription,
  groupWordsIntoBursts,
  generateTikTokAss,
  SUBTITLE_STYLES,
} from "../src/lib/subtitle-generator.js";

test("formatAssTime formats seconds into H:MM:SS.cs", () => {
  assert.equal(formatAssTime(0), "0:00:00.00");
  assert.equal(formatAssTime(1.5), "0:00:01.50");
  assert.equal(formatAssTime(65.25), "0:01:05.25");
  assert.equal(formatAssTime(3661.12), "1:01:01.12");
});

test("parseAssTime parses H:MM:SS.cs into seconds", () => {
  assert.equal(parseAssTime("0:00:00.00"), 0);
  assert.equal(parseAssTime("0:00:01.50"), 1.5);
  assert.equal(parseAssTime("0:01:05.25"), 65.25);
  assert.equal(parseAssTime("1:01:01.12"), 3661.12);
});

test("extractWordsFromTranscription handles direct words array", () => {
  const trans = {
    words: [
      { word: "This", start: 0.1, end: 0.4 },
      { word: "is", start: 0.45, end: 0.7 },
      { word: "viral", start: 0.75, end: 1.2 },
    ],
  };
  const words = extractWordsFromTranscription(trans, 5.0);
  assert.equal(words.length, 3);
  assert.equal(words[0].word, "THIS");
  assert.equal(words[0].start, 5.1);
  assert.equal(words[2].word, "VIRAL");
});

test("extractWordsFromTranscription falls back to text and duration", () => {
  const words = extractWordsFromTranscription(null, 10.0, "The psychology of wealth", 4.0);
  assert.equal(words.length, 4);
  assert.equal(words[0].word, "THE");
  assert.equal(words[0].start, 10.0);
  assert.equal(words[3].word, "WEALTH");
  assert.equal(words[3].end, 14.0);
});

test("groupWordsIntoBursts respects 1-3 words limit", () => {
  const words = [
    { word: "ONE", start: 0, end: 0.3 },
    { word: "TWO", start: 0.3, end: 0.6 },
    { word: "THREE", start: 0.6, end: 0.9 },
    { word: "FOUR", start: 0.9, end: 1.2 },
    { word: "FIVE", start: 1.2, end: 1.5 },
  ];
  const bursts = groupWordsIntoBursts(words, 3);
  assert.equal(bursts.length, 2);
  assert.equal(bursts[0].length, 3);
  assert.equal(bursts[1].length, 2);
});

test("generateTikTokAss generates valid ASS script with PlayResX/Y and Dialogue lines", () => {
  const scenes = [
    {
      duration: 3.0,
      transcription: {
        words: [
          { word: "The", start: 0.1, end: 0.5 },
          { word: "wealth", start: 0.6, end: 1.2 },
          { word: "formula", start: 1.3, end: 2.0 },
        ],
      },
    },
  ];

  const ass = generateTikTokAss({
    scenes,
    styleKey: "yellow_highlight",
    width: 1080,
    height: 1920,
  });

  assert.ok(ass.includes("PlayResX: 1080"));
  assert.ok(ass.includes("PlayResY: 1920"));
  assert.ok(ass.includes("Style: TikTokCaption,DejaVu Sans"));
  assert.ok(ass.includes("Dialogue: 0,"));
  assert.ok(ass.includes(SUBTITLE_STYLES.yellow_highlight.activeColor));
  assert.ok(ass.includes("THE"));
  assert.ok(ass.includes("WEALTH"));
  assert.ok(ass.includes("FORMULA"));
});

test("centisecond rounding carries into the next minute", () => {
  assert.equal(formatAssTime(59.999), "0:01:00.00");
});

test("scene-local captions start from zero, clip to audio and never overlap", () => {
  const scene = { duration: 2, transcription: { words: [
    { word: "ONE", start: 0, end: 0.5 },
    { word: "TWO", start: 0.4, end: 0.9 },
    { word: "THREE", start: 1.1, end: 2.4 },
    { word: "OUTSIDE", start: 3, end: 4 },
  ] } };
  const ass = generateTikTokAss({ scenes: [scene] });
  const rows = ass.split("\n").filter(l => l.startsWith("Dialogue:")).map(l => l.split(","));
  assert.equal(rows[0][1], "0:00:00.00");
  for (let i = 0; i < rows.length; i++) {
    assert.ok(parseAssTime(rows[i][2]) <= 2);
    assert.ok(parseAssTime(rows[i][1]) < parseAssTime(rows[i][2]));
    if (i) assert.ok(parseAssTime(rows[i-1][2]) <= parseAssTime(rows[i][1]));
  }
  assert.ok(!ass.includes("OUTSIDE"));
  assert.equal(generateTikTokAss({ scenes: [scene] }), ass);
});

test("no phrase crosses a scene boundary and pauses stay uncaptioned", () => {
  const ass = generateTikTokAss({ scenes: [
    { duration: 3, transcription: { words: [{ word: "FIRST", start: 0.1, end: 0.5 }] } },
    { duration: 2, transcription: { words: [{ word: "SECOND", start: 0, end: 1 }] } },
  ] });
  const rows = ass.split("\n").filter(l => l.startsWith("Dialogue:"));
  assert.equal(rows.length, 2);
  assert.ok(rows[0].includes("0:00:00.10,0:00:00.50"));
  assert.ok(!rows[0].includes("SECOND"));
  assert.ok(rows[1].includes("0:00:03.00,0:00:04.00"));
});

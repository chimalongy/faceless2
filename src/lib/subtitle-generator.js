/**
 * TikTok-Style Subtitle Generator for 9:16 Shorts
 *
 * Formats Whisper word-level timestamps or scene transcriptions into
 * high-retention, animated ASS (Advanced SubStation Alpha) subtitles
 * with active word highlighting and safe-zone positioning.
 */

export const SUBTITLE_STYLES = {
  yellow_highlight: {
    name: "TikTok Yellow Highlight",
    primaryColor: "&H00FFFFFF", // White inactive (BGR)
    activeColor: "&H0000E6FF",  // Vibrant Yellow active (#FFE600 in BGR)
    outlineColor: "&H00000000", // Solid Black outline
    backColor: "&H80000000",    // 50% Black Shadow
  },
  cyan_highlight: {
    name: "Electric Cyan Highlight",
    primaryColor: "&H00FFFFFF",
    activeColor: "&H00FFFF00",  // Electric Cyan (#00FFFF in BGR)
    outlineColor: "&H00000000",
    backColor: "&H80000000",
  },
  green_highlight: {
    name: "Neon Green Highlight",
    primaryColor: "&H00FFFFFF",
    activeColor: "&H0032FF00",  // Neon Green (#00FF32 in BGR)
    outlineColor: "&H00000000",
    backColor: "&H80000000",
  },
  white_clean: {
    name: "Classic White",
    primaryColor: "&H00D0D0D0", // Muted white inactive
    activeColor: "&H00FFFFFF",  // Pure White active
    outlineColor: "&H00000000",
    backColor: "&H80000000",
  },
};

/**
 * Format numeric seconds (e.g. 14.35) into ASS time string H:MM:SS.cs
 */
export function formatAssTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.min(99, Math.round((safe % 1) * 100));

  return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

/**
 * Parse an ASS time string H:MM:SS.cs into numeric seconds
 */
export function parseAssTime(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return 0;

  const hrs = parts.length === 3 ? Number.parseFloat(parts[0]) || 0 : 0;
  const mins = Number.parseFloat(parts[parts.length - 2]) || 0;
  const secs = Number.parseFloat(parts[parts.length - 1]) || 0;

  return hrs * 3600 + mins * 60 + secs;
}

/**
 * Extract normalized word list [ { word, start, end } ] from various Whisper output formats
 */
export function extractWordsFromTranscription(transResult, sceneOffset = 0, fallbackText = "", sceneDuration = 0) {
  const words = [];
  if (!transResult && !fallbackText) return words;

  // 1. Check direct words array
  if (Array.isArray(transResult?.words) && transResult.words.length > 0) {
    for (const w of transResult.words) {
      const text = String(w.word || w.text || "").trim();
      if (!text) continue;
      const start = Number(w.start ?? w.start_time ?? 0) + sceneOffset;
      const end = Number(w.end ?? w.end_time ?? start + 0.3) + sceneOffset;
      words.push({
        word: text.toUpperCase(),
        start: Math.max(0, start),
        end: Math.max(start + 0.05, end),
      });
    }
    if (words.length > 0) return words;
  }

  // 2. Check segments array
  if (Array.isArray(transResult?.segments) && transResult.segments.length > 0) {
    for (const seg of transResult.segments) {
      if (Array.isArray(seg.words) && seg.words.length > 0) {
        for (const w of seg.words) {
          const text = String(w.word || w.text || "").trim();
          if (!text) continue;
          const start = Number(w.start ?? w.start_time ?? seg.start ?? 0) + sceneOffset;
          const end = Number(w.end ?? w.end_time ?? start + 0.3) + sceneOffset;
          words.push({
            word: text.toUpperCase(),
            start: Math.max(0, start),
            end: Math.max(start + 0.05, end),
          });
        }
      } else if (seg.text) {
        // Segment-level timestamps without word breakdown
        const segWords = String(seg.text).trim().split(/\s+/).filter(Boolean);
        const segStart = Number(seg.start || 0) + sceneOffset;
        const segEnd = Number(seg.end || segStart + 2) + sceneOffset;
        const perWord = (segEnd - segStart) / Math.max(1, segWords.length);
        segWords.forEach((sw, idx) => {
          words.push({
            word: sw.toUpperCase(),
            start: segStart + idx * perWord,
            end: segStart + (idx + 1) * perWord,
          });
        });
      }
    }
    if (words.length > 0) return words;
  }

  // 3. Check if raw ASS string is provided
  if (typeof transResult?.ass === "string" && transResult.ass.includes("Dialogue:")) {
    const lines = transResult.ass.split("\n");
    for (const line of lines) {
      if (!line.startsWith("Dialogue:")) continue;
      const match = line.match(/^Dialogue:\s*[^,]+,\s*([^,]+),\s*([^,]+),.*?,.*?,.*?,.*?,.*?,.*?,(.*)$/);
      if (match) {
        const startSec = parseAssTime(match[1]) + sceneOffset;
        const endSec = parseAssTime(match[2]) + sceneOffset;
        // Strip any ASS override tags
        const cleanText = match[3].replace(/\{[^}]+\}/g, "").trim();
        const lineWords = cleanText.split(/\s+/).filter(Boolean);
        if (lineWords.length > 0) {
          const perWord = (endSec - startSec) / lineWords.length;
          lineWords.forEach((lw, idx) => {
            words.push({
              word: lw.toUpperCase(),
              start: startSec + idx * perWord,
              end: startSec + (idx + 1) * perWord,
            });
          });
        }
      }
    }
    if (words.length > 0) return words;
  }

  // 4. Fallback: derive words from narration text and scene duration
  const textToSplit = fallbackText || transResult?.text || "";
  const rawWords = String(textToSplit).trim().split(/\s+/).filter(Boolean);
  if (rawWords.length > 0 && sceneDuration > 0) {
    const perWord = sceneDuration / rawWords.length;
    rawWords.forEach((rw, idx) => {
      words.push({
        word: rw.toUpperCase(),
        start: sceneOffset + idx * perWord,
        end: sceneOffset + (idx + 1) * perWord,
      });
    });
  }

  return words;
}

/**
 * Group words into punchy bursts (1 to 3 words)
 * @param {Array<{word: string, start: number, end: number}>} words
 * @param {number} maxWordsPerGroup
 * @returns {Array<Array<{word: string, start: number, end: number}>>}
 */
export function groupWordsIntoBursts(words, maxWordsPerGroup = 3) {
  if (!Array.isArray(words) || words.length === 0) return [];

  const groups = [];
  let currentGroup = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentGroup.push(w);

    const isGroupFull = currentGroup.length >= maxWordsPerGroup;
    const endsWithPunctuation = /[.!?]$/.test(w.word);
    const nextWord = words[i + 1];
    const longPauseNext = nextWord ? nextWord.start - w.end > 0.45 : false;

    if (isGroupFull || endsWithPunctuation || longPauseNext || i === words.length - 1) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }

  return groups;
}

/**
 * Generate a complete, ready-to-burn ASS subtitle file for TikTok-style Shorts
 *
 * @param {Object} options
 * @param {Array<{transcription?: any, audioText?: string, duration?: number}>} options.scenes - Scene transcription items
 * @param {string} [options.styleKey] - Key from SUBTITLE_STYLES (default: 'yellow_highlight')
 * @param {number} [options.width] - Canvas width (default: 1080)
 * @param {number} [options.height] - Canvas height (default: 1920)
 * @param {number} [options.fontSize] - Font size in pixels (default: 68)
 * @param {number} [options.marginV] - Vertical distance from bottom (default: 540)
 * @param {number} [options.wordsPerBurst] - Max words per group (default: 3)
 * @returns {string} Fully formatted .ass subtitle content
 */
export function generateTikTokAss({
  scenes = [],
  styleKey = "yellow_highlight",
  width = 1080,
  height = 1920,
  fontSize = 68,
  marginV = 540,
  wordsPerBurst = 3,
}) {
  const chosenStyle = SUBTITLE_STYLES[styleKey] || SUBTITLE_STYLES.yellow_highlight;

  // 1. Extract all words across scenes with cumulative time offsets
  let allWords = [];
  let cumulativeOffset = 0;

  for (const scn of scenes) {
    const duration = Number(scn.duration) || 0;
    const sceneWords = extractWordsFromTranscription(
      scn.transcription,
      cumulativeOffset,
      scn.audioText || scn.narration || "",
      duration
    );

    allWords = allWords.concat(sceneWords);
    cumulativeOffset += duration;
  }

  // 2. Group into punchy 1-3 word bursts
  const bursts = groupWordsIntoBursts(allWords, wordsPerBurst);

  // 3. Build ASS Dialogue Events
  const events = [];

  for (const group of bursts) {
    if (group.length === 0) continue;

    // For each word in the group, create an event where that word is highlighted
    for (let activeIdx = 0; activeIdx < group.length; activeIdx++) {
      const activeWord = group[activeIdx];
      const eventStart = formatAssTime(activeWord.start);
      // Event ends when the current word ends, or when the next word starts
      const nextWord = group[activeIdx + 1];
      const eventEnd = formatAssTime(nextWord ? nextWord.start : activeWord.end);

      // Build the text line with the active word styled
      const textParts = group.map((w, idx) => {
        if (idx === activeIdx) {
          // Highlight active word with pop scale & highlight color
          return `{\\fscx108\\fscy108\\c${chosenStyle.activeColor}}${w.word}{\\fscx100\\fscy100\\c${chosenStyle.primaryColor}}`;
        }
        return w.word;
      });

      const lineText = textParts.join(" ");
      events.push(
        `Dialogue: 0,${eventStart},${eventEnd},TikTokCaption,,0,0,0,,${lineText}`
      );
    }
  }

  // 4. Assemble the complete ASS script
  const assHeader = [
    "[Script Info]",
    "Title: Faceless TikTok Shorts Subtitles",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: TikTokCaption,Montserrat,${fontSize},${chosenStyle.primaryColor},${chosenStyle.activeColor},${chosenStyle.outlineColor},${chosenStyle.backColor},-1,0,0,0,100,100,2,0,1,5.5,3,2,60,60,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
  ].join("\n");

  return assHeader;
}

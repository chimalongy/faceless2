import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath } from "./ffmpeg-helper.js";

const execFileAsync = promisify(execFile);

/**
 * Wraps title text into 1 to 3 balanced lines.
 * @param {string} text 
 * @param {number} maxCharsPerLine 
 * @returns {string[]}
 */
export function wrapTitleText(text, maxCharsPerLine = 24, truncate = true) {
  if (!text) return [];
  const clean = String(text).trim().replace(/\s+/g, " ");
  const words = clean.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Cap at 3 lines with ellipsis if too long
  if (truncate && lines.length > 3) {
    lines[2] = lines[2].slice(0, maxCharsPerLine - 3) + "...";
    return lines.slice(0, 3);
  }

  return lines;
}

/**
 * Generate a high-resolution title card badge PNG sticker.
 * 
 * @param {string} title - The video title to display
 * @param {string} outputPngPath - Target file path for the PNG
 * @param {object} options - Sizing options
 * @returns {Promise<string|null>} Path to generated PNG, or null if failed
 */
export async function generateTitleCardPng(title, outputPngPath, options = {}) {
  try {
    const ffmpeg = getFfmpegPath();
    const width = options.width || 1080;
    const cardWidth = Math.round(width * 0.90);
    const lines = wrapTitleText(title, 26, false);
    if (!lines || lines.length === 0) return null;

    const fontSize = 48;
    const lineHeight = Math.round(fontSize * 1.35);
    const cardHeight = Math.max(140, lines.length * lineHeight + 70);

    const dir = path.dirname(outputPngPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Build FFmpeg drawtext filter chains for each line
    // Background: deep obsidian translucent 0x0F172AE8 with glowing border and amber accent bar
    const filterParts = [
      "format=rgba",
      // Outer subtle border
      `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.3:t=2`,
      // Accent top pill indicator (amber-500)
      `drawbox=x=(iw-72)/2:y=12:w=72:h=5:color=0xF59E0BE8:t=fill`,
    ];

    const startY = 38;
    lines.forEach((lineText, idx) => {
      // Text files keep user text out of shell commands and FFmpeg filter syntax.
      const textFileName = `overlay-line-${idx}.txt`;
      fs.writeFileSync(path.join(dir, textFileName), lineText, "utf8");

      const lineY = startY + idx * lineHeight;
      // Text drop shadow
      filterParts.push(
        `drawtext=textfile=${textFileName}:expansion=none:fontcolor=black@0.85:fontsize=${fontSize}:x=(w-text_w)/2+2:y=${lineY}+2`
      );
      // Crisp white text
      filterParts.push(
        `drawtext=textfile=${textFileName}:expansion=none:fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${lineY}`
      );
    });

    const vf = filterParts.join(",");

    await execFileAsync(ffmpeg, [
      "-y", "-f", "lavfi", "-i", `color=c=0x0F172AE8:s=${cardWidth}x${cardHeight}:d=1`,
      "-vf", vf, "-frames:v", "1", "-update", "1", path.resolve(outputPngPath),
    ], { cwd: dir, maxBuffer: 1024 * 1024 * 10 });

    if (fs.existsSync(outputPngPath) && fs.statSync(outputPngPath).size > 0) {
      return outputPngPath;
    }
    return null;
  } catch (error) {
    console.warn("[TitleCardGenerator] Failed to generate title card sticker:", error?.message || error);
    return null;
  }
}

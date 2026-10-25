import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { getFfmpegPath } from "./ffmpeg-helper.js";
import { AUDIO_EFFECT_PRESETS, buildAudioFilterString } from "./audio-effects-config.js";

const execFileAsync = promisify(execFile);

export { AUDIO_EFFECT_PRESETS, buildAudioFilterString };

/**
 * Applies FFmpeg audio filters (pitch shift, equalizer, etc.) to an audio WAV Buffer.
 * 
 * @param {Buffer} audioBuffer - Input audio buffer (typically WAV or PCM)
 * @param {Object} config - Channel audio_effects configuration
 * @returns {Promise<{ buffer: Buffer, filterApplied: string, changed: boolean }>}
 */
export async function applyAudioEffects(audioBuffer, config = {}) {
  if (!audioBuffer || !(audioBuffer instanceof Buffer) || audioBuffer.length === 0) {
    return { buffer: audioBuffer, filterApplied: "", changed: false };
  }

  if (!config || !config.enabled) {
    return { buffer: audioBuffer, filterApplied: "", changed: false };
  }

  const filterString = buildAudioFilterString(config);
  if (!filterString) {
    return { buffer: audioBuffer, filterApplied: "", changed: false };
  }

  const ffmpegPath = getFfmpegPath();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "faceless-audio-fx-"));
  const inputPath = path.join(tempDir, "input.wav");
  const outputPath = path.join(tempDir, "output.wav");

  try {
    fs.writeFileSync(inputPath, audioBuffer);

    console.log(`[AudioEffects] Applying FFmpeg filter: "${filterString}"`);

    const args = [
      "-y",
      "-i",
      inputPath,
      "-af",
      filterString,
      "-c:a",
      "pcm_s16le",
      outputPath,
    ];

    await execFileAsync(ffmpegPath, args, { timeout: 60000 });

    if (!fs.existsSync(outputPath)) {
      throw new Error("FFmpeg completed but output audio file was not generated.");
    }

    const processedBuffer = fs.readFileSync(outputPath);
    if (!processedBuffer || processedBuffer.length === 0) {
      throw new Error("Processed audio file is empty.");
    }

    console.log(`[AudioEffects] Successfully processed audio (${audioBuffer.length}b -> ${processedBuffer.length}b) with filter: ${filterString}`);

    return {
      buffer: processedBuffer,
      filterApplied: filterString,
      changed: true,
    };
  } catch (err) {
    console.error(`[AudioEffects] Error applying audio filter "${filterString}":`, err.message);
    throw new Error(`Failed to apply audio filter "${filterString}": ${err.message}`);
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {}
  }
}

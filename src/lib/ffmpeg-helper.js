import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

/**
 * Get executable path for FFmpeg.
 */
export function getFfmpegPath() {
  const customPath = process.env.FFMPEG_PATH;

  if (customPath && (fs.existsSync(customPath) || !path.isAbsolute(customPath))) {
    return customPath;
  }

  const binaryName =
    process.platform === "win32"
      ? "ffmpeg.exe"
      : "ffmpeg";

  const projectRootBinary = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    binaryName
  );

  if (fs.existsSync(projectRootBinary)) {
    return projectRootBinary;
  }

  const possiblePaths = [
    path.join(
      __dirname,
      "node_modules",
      "ffmpeg-static",
      binaryName
    ),

    path.join(
      __dirname,
      "..",
      "node_modules",
      "ffmpeg-static",
      binaryName
    ),

    path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "ffmpeg-static",
      binaryName
    ),

    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "node_modules",
      "ffmpeg-static",
      binaryName
    ),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  if (
    typeof ffmpegStatic === "string" &&
    fs.existsSync(ffmpegStatic)
  ) {
    return ffmpegStatic;
  }

  return "ffmpeg";
}

/**
 * Get executable path for FFprobe.
 */
export function getFfprobePath() {
  const customPath = process.env.FFPROBE_PATH;

  if (customPath && (fs.existsSync(customPath) || !path.isAbsolute(customPath))) {
    return customPath;
  }

  const binaryName =
    process.platform === "win32"
      ? "ffprobe.exe"
      : "ffprobe";

  const projectRootBinary = path.join(
    process.cwd(),
    "node_modules",
    "ffprobe-static",
    "bin",
    process.platform,
    process.arch,
    binaryName
  );

  if (fs.existsSync(projectRootBinary)) {
    return projectRootBinary;
  }

  if (
    ffprobeStatic?.path &&
    fs.existsSync(ffprobeStatic.path)
  ) {
    return ffprobeStatic.path;
  }

  return "ffprobe";
}

/**
 * Get accurate media duration.
 */
export async function getAudioDuration(audioFilePath) {
  try {
    const ffprobe = getFfprobePath();

    const command = [
      `"${ffprobe}"`,
      "-v error",
      "-show_entries format=duration",
      "-of default=noprint_wrappers=1:nokey=1",
      `"${audioFilePath}"`,
    ].join(" ");

    const { stdout } =
      await execAsync(command);

    const duration =
      parseFloat(stdout.trim());

    if (
      Number.isFinite(duration) &&
      duration > 0
    ) {
      return duration;
    }
  } catch (err) {
    console.warn(
      "ffprobe duration detection error:",
      err?.message || err
    );
  }

  /**
   * WAV fallback:
   *
   * 24kHz
   * 16-bit
   * mono
   *
   * ≈ 48,000 bytes/sec
   */
  try {
    const stats =
      fs.statSync(audioFilePath);

    const estimated =
      stats.size / 48000;

    return Math.max(
      1,
      Number(estimated.toFixed(3))
    );
  } catch {
    return 5;
  }
}

/**
 * Normalize Ken Burns direction.
 */
export function normalizeKenBurnsDirection(
  direction
) {
  const value =
    typeof direction === "string"
      ? direction.toLowerCase().trim()
      : "";

  const map = {
    in: "zoom-in",
    out: "zoom-out",

    "zoom in": "zoom-in",
    "zoom out": "zoom-out",

    left: "pan-left",
    right: "pan-right",
    up: "pan-up",
    down: "pan-down",

    "zoom-in": "zoom-in",
    "zoom-out": "zoom-out",

    "pan-left": "pan-left",
    "pan-right": "pan-right",
    "pan-up": "pan-up",
    "pan-down": "pan-down",
  };

  return map[value] || "zoom-in";
}

/**
 * Build a smooth cinematic Ken Burns filter.
 *
 * IMPORTANT:
 *
 * We render the camera movement on a
 * 4x supersampled canvas.
 *
 * Final:
 *   1280x720
 *
 * Internal:
 *   5120x2880
 *
 * This dramatically reduces visible
 * 1-pixel jumps on illustrated line art.
 */
export function buildKenBurnsFilter(
  kenBurns = {},
  fps = 60,
  totalFrames = 300,
  width = 1376,
  height = 768
) {
  const direction =
    normalizeKenBurnsDirection(
      kenBurns?.direction
    );

  const total =
    Math.max(
      2,
      Math.floor(totalFrames)
    );

  /**
   * --------------------------------------------------
   * SETTINGS
   * --------------------------------------------------
   */

  const envZoom =
    parseFloat(
      process.env.KEN_BURNS_ZOOM_AMOUNT
    );

  let zoomAmount = 0.10;

  if (
    typeof kenBurns?.intensity === "number" &&
    Number.isFinite(kenBurns.intensity)
  ) {
    zoomAmount =
      Math.max(
        0.02,
        Math.min(
          0.30,
          kenBurns.intensity
        )
      );
  } else if (
    Number.isFinite(envZoom) &&
    envZoom > 0
  ) {
    zoomAmount =
      Math.max(
        0.02,
        Math.min(
          0.30,
          envZoom
        )
      );
  }

  /**
   * Pan headroom.
   *
   * 1.10 means 10% crop.
   */
  const envPan =
    parseFloat(
      process.env.KEN_BURNS_PAN_ZOOM
    );

  const panZoom =
    Number.isFinite(envPan) &&
      envPan > 1
      ? Math.min(envPan, 1.30)
      : 1.10;

  /**
   * --------------------------------------------------
   * FRAME PROGRESS
   * --------------------------------------------------
   *
   * 0 → 1
   */
  const t =
    `(on/${total - 1})`;

  /**
   * Smoothstep:
   *
   * 0 at beginning
   * slow acceleration
   * smooth middle
   * slow deceleration
   * 1 at end
   *
   * This is much less robotic than
   * linear movement.
   */
  const smooth =
    `(${t}*${t}*(3-2*${t}))`;

  /**
   * --------------------------------------------------
   * 4X INTERNAL RESOLUTION
   * --------------------------------------------------
   */
  const internalWidth =
    width * 4;

  const internalHeight =
    height * 4;

  let z;
  let x;
  let y;

  switch (direction) {
    /**
     * ----------------------------------------------
     * ZOOM IN
     * ----------------------------------------------
     */
    case "zoom-in": {
      z =
        `(1+(${zoomAmount}*${smooth}))`;

      x =
        `(iw-iw/zoom)/2`;

      y =
        `(ih-ih/zoom)/2`;

      break;
    }

    /**
     * ----------------------------------------------
     * ZOOM OUT
     * ----------------------------------------------
     */
    case "zoom-out": {
      z =
        `(1+(${zoomAmount}*(1-${smooth})))`;

      x =
        `(iw-iw/zoom)/2`;

      y =
        `(ih-ih/zoom)/2`;

      break;
    }

    /**
     * ----------------------------------------------
     * PAN LEFT
     * ----------------------------------------------
     */
    case "pan-left": {
      z = `${panZoom}`;

      x =
        `(iw-iw/zoom)*(1-${smooth})`;

      y =
        `(ih-ih/zoom)/2`;

      break;
    }

    /**
     * ----------------------------------------------
     * PAN RIGHT
     * ----------------------------------------------
     */
    case "pan-right": {
      z = `${panZoom}`;

      x =
        `(iw-iw/zoom)*${smooth}`;

      y =
        `(ih-ih/zoom)/2`;

      break;
    }

    /**
     * ----------------------------------------------
     * PAN UP
     * ----------------------------------------------
     */
    case "pan-up": {
      z = `${panZoom}`;

      x =
        `(iw-iw/zoom)/2`;

      y =
        `(ih-ih/zoom)*(1-${smooth})`;

      break;
    }

    /**
     * ----------------------------------------------
     * PAN DOWN
     * ----------------------------------------------
     */
    case "pan-down": {
      z = `${panZoom}`;

      x =
        `(iw-iw/zoom)/2`;

      y =
        `(ih-ih/zoom)*${smooth}`;

      break;
    }

    default: {
      z =
        `(1+(${zoomAmount}*${smooth}))`;

      x =
        `(iw-iw/zoom)/2`;

      y =
        `(ih-ih/zoom)/2`;

      break;
    }
  }

  /**
   * --------------------------------------------------
   * FILTER PIPELINE
   * --------------------------------------------------
   *
   * 1. Scale image to a large working canvas.
   *
   * 2. Preserve aspect ratio.
   *
   * 3. Crop to 16:9.
   *
   * 4. zoompan at 60 FPS.
   *
   * 5. Downsample with Lanczos.
   */
  return [
    /**
     * Preserve image aspect ratio while
     * creating enough resolution for motion.
     */
    `scale=${internalWidth}:${internalHeight}:force_original_aspect_ratio=increase:flags=lanczos`,

    /**
     * Center crop to target aspect ratio.
     */
    `crop=${internalWidth}:${internalHeight}:(iw-${internalWidth})/2:(ih-${internalHeight})/2`,

    /**
     * Supersampled camera movement.
     */
    `zoompan=` +
    `z='${z}':` +
    `x='${x}':` +
    `y='${y}':` +
    `d=${total}:` +
    `s=${internalWidth}x${internalHeight}:` +
    `fps=${fps}`,

    /**
     * Final high-quality downsample.
     */
    `scale=${width}:${height}:flags=lanczos`,

    /**
     * Make the frame rate explicit.
     */
    `fps=${fps}`,

    /**
     * Correct pixel format.
     */
    `format=yuv420p`,
  ].join(",");
}

/**
 * Normalize transition.
 */
export function normalizeTransition(
  transition
) {
  const value =
    typeof transition === "string"
      ? transition.toLowerCase().trim()
      : "";

  const map = {
    fade: "fade",
    "fade-to-black": "fade",
    "fade-to-white": "fade-to-white",

    crossfade: "crossfade",

    "fade-in": "fade-in",
    "fade-out": "fade-out",

    cut: "cut",
    none: "cut",
  };

  return map[value] || "fade";
}

/**
 * Build scene transition.
 */
export function buildTransitionFilter(
  transition = "fade",
  duration = 5
) {
  const norm =
    normalizeTransition(
      transition
    );

  if (norm === "cut") {
    return "";
  }

  const safeDuration =
    Math.max(
      0.1,
      Number(duration) || 5
    );

  const fadeDuration =
    Math.min(
      0.40,
      safeDuration / 4
    );

  const fadeOutStart =
    Math.max(
      0,
      safeDuration -
      fadeDuration
    );

  switch (norm) {
    case "fade":
      return [
        `fade=t=in:st=0:d=${fadeDuration}:color=black`,
        `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}:color=black`,
      ].join(",");

    case "fade-to-white":
      return [
        `fade=t=in:st=0:d=${fadeDuration}:color=white`,
        `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}:color=white`,
      ].join(",");

    case "crossfade":
    case "fade-in":
      return `fade=t=in:st=0:d=${fadeDuration}:color=black`;

    case "fade-out":
      return `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}:color=black`;

    default:
      return "";
  }
}
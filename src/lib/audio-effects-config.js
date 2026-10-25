/**
 * Audio Effects Presets & Configuration (Client & Server Safe - No Node.js dependencies)
 */

export const AUDIO_EFFECT_PRESETS = [
  {
    id: "none",
    name: "Natural / Off",
    description: "Original raw TTS narration without post-processing.",
    filter: "",
  },
  {
    id: "stoic_deep",
    name: "Stoic / Very Deep Voice",
    description: "Pitch shifted down to 0.75x with bass boost at 125Hz (+2.5dB). Ideal for discipline, philosophy, and stoic narrations.",
    filter: "rubberband=pitch=0.75,equalizer=f=125:t=q:w=1:g=2.5",
    pitch: 0.75,
    equalizer: { frequency: 125, width: 1.0, gain: 2.5 },
  },
  {
    id: "deep_warm",
    name: "Warm Radio & Podcast",
    description: "Rich, resonant broadcaster sound. Pitch at 0.85x with low-end warmth at 100Hz (+3.0dB).",
    filter: "rubberband=pitch=0.85,equalizer=f=100:t=q:w=1.2:g=3.0",
    pitch: 0.85,
    equalizer: { frequency: 100, width: 1.2, gain: 3.0 },
  },
  {
    id: "bass_boost",
    name: "Bass Booster",
    description: "Preserves natural vocal pitch while adding heavy sub-low punch at 120Hz (+4.0dB).",
    filter: "equalizer=f=120:t=q:w=1.5:g=4.0",
    pitch: 1.0,
    equalizer: { frequency: 120, width: 1.5, gain: 4.0 },
  },
  {
    id: "cinematic_narrator",
    name: "Cinematic Narrator",
    description: "Subtle low pitch (0.80x), bass boost (110Hz, +2.0dB), and soft treble presence (3000Hz, +1.5dB).",
    filter: "rubberband=pitch=0.80,equalizer=f=110:t=q:w=1.2:g=2.0,equalizer=f=3000:t=q:w=1.0:g=1.5",
    pitch: 0.80,
    equalizer: { frequency: 110, width: 1.2, gain: 2.0 },
  },
  {
    id: "high_pitch",
    name: "Youthful / High Pitch",
    description: "Pitch shifted up to 1.25x for energetic or animated character narrations.",
    filter: "rubberband=pitch=1.25",
    pitch: 1.25,
    equalizer: null,
  },
  {
    id: "custom",
    name: "Custom FFmpeg Filter",
    description: "Custom -af filter string.",
    filter: "",
  },
];

/**
 * Builds a clean FFmpeg -af filter string from configuration object.
 */
export function buildAudioFilterString(config = {}) {
  if (!config) return "";

  // If custom filter string is explicitly provided
  if (config.customFilter && String(config.customFilter).trim()) {
    return String(config.customFilter).trim();
  }

  // If a preset filter is configured
  if (config.preset && config.preset !== "custom" && config.preset !== "none") {
    const foundPreset = AUDIO_EFFECT_PRESETS.find((p) => p.id === config.preset);
    if (foundPreset && foundPreset.filter) {
      return foundPreset.filter;
    }
  }

  // Otherwise compile from structured fields (pitch and equalizer)
  const parts = [];

  const pitchVal = Number(config.pitch);
  if (!isNaN(pitchVal) && pitchVal > 0 && Math.abs(pitchVal - 1.0) >= 0.01) {
    parts.push(`rubberband=pitch=${pitchVal.toFixed(2)}`);
  }

  if (config.equalizer && config.equalizer.enabled !== false) {
    const freq = Number(config.equalizer.frequency ?? config.equalizer.freq);
    const gain = Number(config.equalizer.gain);
    const width = Number(config.equalizer.width ?? 1.0);

    if (!isNaN(freq) && freq > 0 && !isNaN(gain) && gain !== 0) {
      parts.push(`equalizer=f=${Math.round(freq)}:t=q:w=${width.toFixed(1)}:g=${gain.toFixed(1)}`);
    }
  }

  return parts.join(",");
}

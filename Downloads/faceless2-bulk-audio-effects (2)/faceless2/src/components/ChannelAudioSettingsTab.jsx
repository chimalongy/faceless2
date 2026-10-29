"use client";

import {
  Sliders,
  Volume2,
  Sparkles,
  Play,
  RotateCcw,
  Save,
  Check,
  Loader2,
  AlertCircle,
  HelpCircle,
  Info,
  Radio,
  Music,
  Code2,
  Upload,
  Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { AUDIO_EFFECT_PRESETS, buildAudioFilterString } from "@/lib/audio-effects-config";

export default function ChannelAudioSettingsTab({ channelSlug, channelName }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [enabled, setEnabled] = useState(false);
  const [preset, setPreset] = useState("stoic_deep");
  const [pitch, setPitch] = useState(0.75);
  const [eqFreq, setEqFreq] = useState(125);
  const [eqWidth, setEqWidth] = useState(1.0);
  const [eqGain, setEqGain] = useState(2.5);
  const [customFilter, setCustomFilter] = useState("");

  // Preview State
  const [previewText, setPreviewText] = useState(
    "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity to improve our condition."
  );
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Background Music State
  const [bgMusicEnabled, setBgMusicEnabled] = useState(false);
  const [bgMusicFileUrl, setBgMusicFileUrl] = useState(null);
  const [bgMusicFileKey, setBgMusicFileKey] = useState(null);
  const [bgMusicFileName, setBgMusicFileName] = useState(null);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.15);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [deletingMusic, setDeletingMusic] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [channelSlug]);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/audio-effects`);
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        const fx = data.audioEffects || {};
        setEnabled(Boolean(fx.enabled));
        setPreset(fx.preset || (fx.enabled ? "stoic_deep" : "none"));
        setPitch(fx.pitch !== undefined ? Number(fx.pitch) : 0.75);
        if (fx.equalizer) {
          setEqFreq(fx.equalizer.frequency || 125);
          setEqWidth(fx.equalizer.width || 1.0);
          setEqGain(fx.equalizer.gain !== undefined ? Number(fx.equalizer.gain) : 2.5);
        }
        setCustomFilter(fx.customFilter || "");

        // Background Music
        const bg = data.backgroundMusic || {};
        setBgMusicEnabled(Boolean(bg.enabled));
        setBgMusicFileUrl(bg.fileUrl || null);
        setBgMusicFileKey(bg.fileKey || null);
        setBgMusicFileName(bg.fileName || null);
        setBgMusicVolume(bg.volume !== undefined ? Number(bg.volume) : 0.15);
      } else {
        toast.error(data.error || "Failed to load audio settings");
      }
    } catch (err) {
      console.error("Error loading audio settings:", err);
      toast.error(err.message || "Could not load audio settings");
    } finally {
      setLoading(false);
    }
  }

  // Upload Background Music (Direct to Cloudflare R2 via Presigned URL)
  async function handleUploadMusic(file) {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) {
      toast.error("Please select a valid audio file (.mp3, .wav, .m4a, .aac, .ogg)");
      return;
    }

    setUploadingMusic(true);
    setUploadProgress("Authorizing storage upload...");
    try {
      // Step 1: Request presigned R2 upload URL (tiny JSON, bypasses Vercel 4.5MB limit)
      const presignRes = await fetch(`/api/channels/${channelSlug}/audio-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "presign_music",
          fileName: file.name,
          mimeType: file.type || "audio/mpeg",
        }),
      });

      const presignText = await presignRes.text();
      let presignData = {};
      try {
        presignData = JSON.parse(presignText);
      } catch {
        throw new Error(presignText.slice(0, 150) || `Server returned ${presignRes.status}`);
      }

      if (!presignRes.ok || !presignData.uploadUrl) {
        throw new Error(presignData.error || "Failed to obtain storage authorization");
      }

      // Step 2: Upload audio file directly from browser to Cloudflare R2
      setUploadProgress("Uploading 0%...");
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignData.uploadUrl, true);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
            const loadedMB = (evt.loaded / 1024 / 1024).toFixed(1);
            const totalMB = (evt.total / 1024 / 1024).toFixed(1);
            setUploadProgress(`${loadedMB}MB / ${totalMB}MB (${percent}%)`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage rejected file (HTTP ${xhr.status}). Check R2 CORS settings.`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during direct storage upload."));
        };

        xhr.ontimeout = () => {
          reject(new Error("Storage upload timed out."));
        };

        xhr.send(file);
      });

      // Step 3: Update local state & auto-save to ensure track is instantly persisted
      setBgMusicFileUrl(presignData.publicUrl);
      setBgMusicFileKey(presignData.fileKey);
      setBgMusicFileName(file.name);
      setBgMusicEnabled(true);

      // Auto-save the new track so the user doesn't risk losing it
      setUploadProgress("Saving track settings...");
      await fetch(`/api/channels/${channelSlug}/audio-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          audioEffects: {
            enabled,
            preset,
            pitch,
            equalizer: {
              enabled: true,
              frequency: eqFreq,
              width: eqWidth,
              gain: eqGain,
            },
            customFilter: preset === "custom" ? customFilter : "",
          },
          backgroundMusic: {
            enabled: true,
            fileUrl: presignData.publicUrl,
            fileKey: presignData.fileKey,
            fileName: file.name,
            volume: bgMusicVolume,
          },
        }),
      });

      toast.success(`Uploaded and saved "${file.name}"!`);
    } catch (err) {
      console.error("Music upload error:", err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingMusic(false);
      setUploadProgress(null);
    }
  }

  // Delete Background Music Track
  async function handleDeleteMusic() {
    if (!confirm("Are you sure you want to remove this background music track?")) return;
    setDeletingMusic(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/audio-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_music",
          fileKey: bgMusicFileKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove background music");
      }

      setBgMusicFileUrl(null);
      setBgMusicFileKey(null);
      setBgMusicFileName(null);
      setBgMusicEnabled(false);
      toast.success("Background music track removed.");
    } catch (err) {
      console.error("Delete music error:", err);
      toast.error(err.message || "Failed to remove music track");
    } finally {
      setDeletingMusic(false);
    }
  }

  // Handle Preset Selection
  function handleSelectPreset(presetId) {
    setPreset(presetId);
    const p = AUDIO_EFFECT_PRESETS.find((item) => item.id === presetId);
    if (!p) return;

    if (presetId === "none") {
      setEnabled(false);
      setCustomFilter("");
      return;
    }

    setEnabled(true);

    if (p.pitch !== undefined) setPitch(p.pitch);
    if (p.equalizer) {
      setEqFreq(p.equalizer.frequency || 125);
      setEqWidth(p.equalizer.width || 1.0);
      setEqGain(p.equalizer.gain || 2.5);
    }
    if (presetId === "custom") {
      if (!customFilter) {
        setCustomFilter("rubberband=pitch=0.75,equalizer=f=125:t=q:w=1:g=2.5");
      }
    } else {
      setCustomFilter(p.filter || "");
    }
  }

  // Compile active filter string dynamically
  const activeFilterString =
    preset === "custom" && customFilter.trim()
      ? customFilter.trim()
      : buildAudioFilterString({
          preset,
          pitch,
          equalizer: { frequency: eqFreq, width: eqWidth, gain: eqGain },
          customFilter: preset === "custom" ? customFilter : "",
        });

  // Save Settings
  async function handleSaveSettings() {
    setSaving(true);
    try {
      const audioEffects = {
        enabled,
        preset,
        pitch,
        equalizer: {
          enabled: true,
          frequency: eqFreq,
          width: eqWidth,
          gain: eqGain,
        },
        customFilter: preset === "custom" ? customFilter : "",
      };

      const backgroundMusic = {
        enabled: bgMusicEnabled,
        fileUrl: bgMusicFileUrl,
        fileKey: bgMusicFileKey,
        fileName: bgMusicFileName,
        volume: bgMusicVolume,
      };

      const res = await fetch(`/api/channels/${channelSlug}/audio-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          audioEffects,
          backgroundMusic,
        }),
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        toast.success("Audio post-processing and background music settings saved!");
      } else {
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save audio settings");
    } finally {
      setSaving(false);
    }
  }

  // Test & Preview Filter
  async function handlePreviewFilter() {
    if (!previewText.trim()) {
      toast.error("Please enter a sample narration sentence to test.");
      return;
    }

    setPreviewing(true);
    try {
      const audioEffects = {
        enabled: true,
        preset,
        pitch,
        equalizer: {
          frequency: eqFreq,
          width: eqWidth,
          gain: eqGain,
        },
        customFilter: preset === "custom" ? customFilter : "",
      };

      const res = await fetch(`/api/channels/${channelSlug}/audio-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          text: previewText.trim(),
          audioEffects,
        }),
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Preview failed (${res.status})`);
      }

      if (res.ok && data.success) {
        setPreviewData(data);
        toast.success("Sample audio processed successfully!");
      } else {
        throw new Error(data.error || "Failed to process preview");
      }
    } catch (err) {
      console.error("Preview error:", err);
      toast.error(err.message || "Audio preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 border border-line bg-paper-card text-center space-y-3">
        <Loader2 size={24} className="animate-spin text-signal mx-auto" />
        <p className="text-xs text-ink-muted">Loading channel audio post-processing settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-signal/10 text-signal">
                <Sliders size={18} />
              </span>
              <h2 className="text-base font-display font-bold text-ink">
                Audio Post-Processing (FFmpeg Filters)
              </h2>
            </div>
            <p className="text-xs text-ink-muted max-w-2xl">
              Automatically apply FFmpeg audio filters (such as pitch shifting, deep resonant equalizer, and tone modulation) to all synthesized scene audios right after generation and before storing in the cloud.
            </p>
          </div>

          {/* Master Enable Toggle */}
          <div className="flex items-center gap-3 p-3 bg-paper border border-line shrink-0">
            <span className="text-xs font-semibold text-ink">
              {enabled ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active on Generated Audio
                </span>
              ) : (
                <span className="text-ink-muted">Bypassed (Raw TTS)</span>
              )}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-signal"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Preset Selection Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
            1. Select Tone Preset
          </h3>
          <span className="text-[11px] text-ink-muted font-mono">
            {AUDIO_EFFECT_PRESETS.length} Available Presets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AUDIO_EFFECT_PRESETS.map((p) => {
            const isSelected = preset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "border-signal bg-signal/5 ring-1 ring-signal shadow-xs"
                    : "border-line bg-paper-card hover:border-line-dark"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-ink">{p.name}</span>
                    {isSelected && (
                      <span className="p-0.5 bg-signal text-white rounded-xs">
                        <Check size={12} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{p.description}</p>
                </div>
                {p.filter && (
                  <div className="mt-3 pt-2 border-t border-line/60">
                    <code className="text-[10px] font-mono text-ink-muted block truncate bg-paper px-1.5 py-0.5">
                      {p.filter}
                    </code>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Parameter Adjustment Controls */}
      <div className="p-6 border border-line bg-paper-card space-y-6">
        <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono border-b border-line pb-2">
          2. Fine-Tune Filter Parameters
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pitch Control */}
          <div className="p-4 border border-line bg-paper space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Sliders size={14} className="text-signal" />
                <span>Pitch Shift Factor (rubberband)</span>
              </label>
              <span className="text-xs font-mono font-bold text-signal px-2 py-0.5 bg-signal/10 rounded-xs">
                {pitch.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="1.50"
              step="0.05"
              value={pitch}
              onChange={(e) => {
                setPitch(parseFloat(e.target.value));
                setPreset("custom");
                setCustomFilter("");
              }}
              className="w-full accent-signal cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-ink-muted">
              <span>0.50x (Ultra Deep)</span>
              <span>0.75x (Stoic Default)</span>
              <span>1.00x (Natural)</span>
              <span>1.50x (High)</span>
            </div>
            <p className="text-[11px] text-ink-muted">
              Adjusts fundamental pitch without changing speech tempo or audio duration.
            </p>
          </div>

          {/* Equalizer Bass Boost */}
          <div className="p-4 border border-line bg-paper space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Music size={14} className="text-signal" />
                <span>Bass Equalizer (Peak/Bell EQ)</span>
              </label>
              <span className="text-xs font-mono font-bold text-signal px-2 py-0.5 bg-signal/10 rounded-xs">
                {eqFreq}Hz @ {eqGain >= 0 ? `+${eqGain.toFixed(1)}` : eqGain.toFixed(1)}dB
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-ink-muted">Frequency (Hz)</span>
                <input
                  type="number"
                  min="50"
                  max="500"
                  value={eqFreq}
                  onChange={(e) => {
                    setEqFreq(parseInt(e.target.value, 10) || 125);
                    setPreset("custom");
                    setCustomFilter("");
                  }}
                  className="w-full p-2 border border-line bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-ink-muted">Width (Q)</span>
                <input
                  type="number"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={eqWidth}
                  onChange={(e) => {
                    setEqWidth(parseFloat(e.target.value) || 1.0);
                    setPreset("custom");
                    setCustomFilter("");
                  }}
                  className="w-full p-2 border border-line bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-ink-muted">Gain (dB)</span>
                <input
                  type="number"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={eqGain}
                  onChange={(e) => {
                    setEqGain(parseFloat(e.target.value) || 0);
                    setPreset("custom");
                    setCustomFilter("");
                  }}
                  className="w-full p-2 border border-line bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>
            </div>

            <p className="text-[11px] text-ink-muted">
              Pumps chest warmth and low-frequency resonance around {eqFreq}Hz.
            </p>
          </div>
        </div>

        {/* Raw Compiled FFmpeg Filter Command */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Code2 size={14} className="text-signal" />
              <span>FFmpeg Audio Filter (-af string)</span>
            </label>
            <span className="text-[10px] font-mono text-ink-muted">
              Executed via ffmpeg-static pcm_s16le
            </span>
          </div>
          <input
            type="text"
            value={preset === "custom" ? customFilter : activeFilterString}
            onChange={(e) => {
              setCustomFilter(e.target.value);
              setPreset("custom");
            }}
            placeholder="e.g. rubberband=pitch=0.75,equalizer=f=125:t=q:w=1:g=2.5"
            className="w-full p-2.5 border border-line bg-paper font-mono text-xs text-ink outline-none focus:border-signal"
          />
        </div>
      </div>

      {/* Interactive Preview Studio */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
            <Radio size={14} className="text-signal" />
            <span>3. Test & Preview Voice Filter</span>
          </h3>
          <span className="text-[11px] text-ink-muted font-mono">Real-time side-by-side comparison</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink">Test Narration Sentence:</label>
          <textarea
            rows={2}
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            className="w-full p-3 border border-line bg-white text-xs text-ink outline-none focus:border-signal"
            placeholder="Type a sample line to test this filter..."
          />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handlePreviewFilter}
            disabled={previewing || !previewText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
          >
            {previewing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Synthesizing & Filtering...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Generate Test Sample</span>
              </>
            )}
          </button>
        </div>

        {/* Audio Players Comparison */}
        {previewData && (
          <div className="p-4 bg-paper border border-line space-y-4 animate-in fade-in">
            <div className="text-xs font-mono text-ink-muted border-b border-line/60 pb-2 flex items-center justify-between">
              <span>Filter Applied: <strong className="text-ink">{previewData.filterApplied}</strong></span>
              <span>Voice: <strong className="text-ink">{previewData.voiceUsed}</strong></span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Processed Audio */}
              <div className="p-3 bg-white border border-signal/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-signal flex items-center gap-1.5">
                    <Sparkles size={13} />
                    <span>Processed (Filtered Audio)</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                    With Post-Processing
                  </span>
                </div>
                <audio
                  controls
                  src={previewData.processedAudioUrl}
                  className="w-full h-9"
                />
              </div>

              {/* Raw TTS Audio */}
              <div className="p-3 bg-white border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted">
                    Original (Raw TTS)
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted bg-paper px-1.5 py-0.5 rounded-xs">
                    Unmodified
                  </span>
                </div>
                <audio
                  controls
                  src={previewData.rawAudioUrl}
                  className="w-full h-9"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Background Music Settings Section */}
      <div className="p-6 border border-line bg-paper-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-signal/10 text-signal">
                <Music size={18} />
              </span>
              <h2 className="text-base font-display font-bold text-ink">
                Background Music Settings
              </h2>
            </div>
            <p className="text-xs text-ink-muted max-w-2xl">
              Add ambient background music to your channel. The audio track is automatically looped across the entire video duration and mixed with the scene voiceovers after all scenes are merged.
            </p>
          </div>

          {/* Master Toggle */}
          <div className="flex items-center gap-3 p-3 bg-paper border border-line shrink-0">
            <span className="text-xs font-semibold text-ink">
              {bgMusicEnabled ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Music Enabled
                </span>
              ) : (
                <span className="text-ink-muted">Music Disabled</span>
              )}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bgMusicEnabled}
                onChange={(e) => setBgMusicEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-signal"></div>
            </label>
          </div>
        </div>

        {bgMusicEnabled ? (
          <div className="space-y-6">
            {/* 1. Music File Upload Area */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-2">
                  <Upload size={14} className="text-signal" />
                  <span>1. Background Audio Track</span>
                </h3>
                {bgMusicFileUrl && (
                  <span className="text-[11px] font-mono text-emerald-600 flex items-center gap-1">
                    <Check size={12} />
                    <span>Track Uploaded</span>
                  </span>
                )}
              </div>

              {bgMusicFileUrl ? (
                <div className="p-4 border border-line bg-paper space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-sm bg-signal/10 text-signal flex items-center justify-center shrink-0">
                        <Music size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">
                          {bgMusicFileName || "background-music.mp3"}
                        </p>
                        <p className="text-[10px] text-ink-muted font-mono truncate">
                          Stored on Cloudflare R2 • Ready for master merge looping
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-card hover:bg-line/40 border border-line text-xs font-medium text-ink cursor-pointer transition-all">
                        <Upload size={12} />
                        <span>Replace Track</span>
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleUploadMusic(e.target.files[0]);
                          }}
                          disabled={uploadingMusic}
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleDeleteMusic}
                        disabled={deletingMusic}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium cursor-pointer transition-all disabled:opacity-50"
                      >
                        {deletingMusic ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line/60">
                    <audio
                      controls
                      src={bgMusicFileUrl}
                      className="w-full h-9"
                    />
                  </div>
                </div>
              ) : (
                <label className="block p-8 border-2 border-dashed border-line hover:border-signal/60 bg-paper transition-all cursor-pointer text-center space-y-3 group">
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadMusic(e.target.files[0]);
                    }}
                    disabled={uploadingMusic}
                    className="sr-only"
                  />
                  {uploadingMusic ? (
                    <div className="space-y-2">
                      <Loader2 size={24} className="animate-spin text-signal mx-auto" />
                      <p className="text-xs font-semibold text-ink">
                        {uploadProgress || "Uploading music track to Cloudflare R2..."}
                      </p>
                      <p className="text-[11px] text-ink-muted">Direct high-speed upload to storage (no size limit)</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-signal/10 group-hover:bg-signal/20 text-signal flex items-center justify-center mx-auto transition-colors">
                        <Upload size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink">
                          Click to upload background music track
                        </p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          Supports MP3, WAV, M4A, AAC, OGG (auto-looped during video merge)
                        </p>
                      </div>
                    </div>
                  )}
                </label>
              )}
            </div>

            {/* 2. Volume Slider Component */}
            <div className="p-4 border border-line bg-paper space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink flex items-center gap-2">
                  <Volume2 size={15} className="text-signal" />
                  <span>2. Background Music Volume</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-signal px-2 py-0.5 bg-signal/10 border border-signal/20">
                    {Math.round(bgMusicVolume * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setBgMusicVolume(0.15)}
                    title="Reset to 15% recommended volume"
                    className="p-1 hover:bg-line/40 text-ink-muted hover:text-ink transition-colors"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>

              {/* Slider Track */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0.00"
                  max="1.00"
                  step="0.01"
                  value={bgMusicVolume}
                  onChange={(e) => setBgMusicVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-signal"
                />
                <div className="flex justify-between text-[10px] text-ink-muted font-mono">
                  <span>Mute (0%)</span>
                  <span className={bgMusicVolume >= 0.10 && bgMusicVolume <= 0.25 ? "text-signal font-bold" : ""}>
                    Recommended: 15%
                  </span>
                  <span>Full (100%)</span>
                </div>
              </div>

              {/* Volume Guide */}
              <div className="text-[11px] text-ink-muted bg-paper-card p-3 border border-line flex items-start gap-2">
                <Info size={14} className="text-signal shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <p>
                    <strong>Acoustic Level Guide:</strong> 10%–20% creates a subtle, atmospheric foundation without masking the spoken narration. Higher volumes (&gt;35%) may drown out the voiceover.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-paper border border-line text-xs text-ink-muted flex items-center gap-2.5">
            <Info size={14} className="text-ink-muted shrink-0" />
            <span>Background music is turned off. Completed videos will only contain synthesized scene voiceover audio.</span>
          </div>
        )}
      </div>

      {/* Save Action Bar */}
      <div className="p-4 border border-line bg-paper-card flex items-center justify-between">
        <div className="text-xs text-ink-muted font-mono space-y-0.5">
          <div>
            {enabled ? (
              <span className="text-emerald-600 font-semibold">
                Voice filter is active.
              </span>
            ) : (
              <span>Voice post-processing is bypassed (raw TTS).</span>
            )}
          </div>
          <div>
            {bgMusicEnabled && bgMusicFileUrl ? (
              <span className="text-emerald-600 font-semibold">
                Background music enabled ({Math.round(bgMusicVolume * 100)}% vol) — will loop across merged video.
              </span>
            ) : bgMusicEnabled ? (
              <span className="text-amber-600 font-semibold">
                Background music enabled, but no track uploaded yet.
              </span>
            ) : (
              <span>Background music disabled.</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Save Audio Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

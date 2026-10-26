"use client";

import {
  Film,
  Video,
  Sliders,
  Check,
  Loader2,
  AlertCircle,
  HelpCircle,
  Info,
  Layers,
  Sparkles,
  Maximize2,
  X,
  Play,
  Pause,
  ExternalLink,
  RotateCcw,
  Smartphone,
  Monitor,
  CheckCircle2,
  SunMedium
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import toast from "react-hot-toast";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function ChannelVideoSettingsTab({ channelSlug, channelName }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [useOverlay, setUseOverlay] = useState(false);
  const [longsOverlayId, setLongsOverlayId] = useState(null);
  const [shortsOverlayId, setShortsOverlayId] = useState(null);
  const [longsOpacity, setLongsOpacity] = useState(1.0);
  const [shortsOpacity, setShortsOpacity] = useState(1.0);

  // Original saved state for dirty checking & reset
  const [savedSettings, setSavedSettings] = useState(null);

  // Library of available overlays from General Settings
  const [availableOverlays, setAvailableOverlays] = useState([]);

  // Preview lightbox modal
  const [lightboxOverlay, setLightboxOverlay] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadSettings();
  }, [channelSlug]);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/video-settings`);
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        const s = data.videoSettings || {};
        const initial = {
          useOverlay: Boolean(s.useOverlay),
          longsOverlayId: s.longsOverlayId ? Number(s.longsOverlayId) : null,
          shortsOverlayId: s.shortsOverlayId ? Number(s.shortsOverlayId) : null,
          longsOpacity: s.longsOpacity !== undefined ? Number(s.longsOpacity) : 1.0,
          shortsOpacity: s.shortsOpacity !== undefined ? Number(s.shortsOpacity) : 1.0,
        };

        setUseOverlay(initial.useOverlay);
        setLongsOverlayId(initial.longsOverlayId);
        setShortsOverlayId(initial.shortsOverlayId);
        setLongsOpacity(initial.longsOpacity);
        setShortsOpacity(initial.shortsOpacity);

        setSavedSettings(initial);
        setAvailableOverlays(data.availableOverlays || []);
      } else {
        toast.error(data.error || "Failed to load video settings");
      }
    } catch (err) {
      console.error("Error loading video settings:", err);
      toast.error(err.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  // Check if form is dirty
  const isDirty = savedSettings && (
    useOverlay !== savedSettings.useOverlay ||
    longsOverlayId !== savedSettings.longsOverlayId ||
    shortsOverlayId !== savedSettings.shortsOverlayId ||
    Math.abs(longsOpacity - savedSettings.longsOpacity) > 0.005 ||
    Math.abs(shortsOpacity - savedSettings.shortsOpacity) > 0.005
  );

  function handleReset() {
    if (!savedSettings) return;
    setUseOverlay(savedSettings.useOverlay);
    setLongsOverlayId(savedSettings.longsOverlayId);
    setShortsOverlayId(savedSettings.shortsOverlayId);
    setLongsOpacity(savedSettings.longsOpacity);
    setShortsOpacity(savedSettings.shortsOpacity);
    toast.success("Settings reset to last saved state");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        useOverlay,
        longsOverlayId: longsOverlayId ? Number(longsOverlayId) : null,
        shortsOverlayId: shortsOverlayId ? Number(shortsOverlayId) : null,
        longsOpacity: Number(longsOpacity),
        shortsOpacity: Number(shortsOpacity),
      };

      const res = await fetch(`/api/channels/${channelSlug}/video-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        toast.success("Video overlay settings saved successfully!");
        const s = data.videoSettings || payload;
        const newSaved = {
          useOverlay: Boolean(s.useOverlay),
          longsOverlayId: s.longsOverlayId ? Number(s.longsOverlayId) : null,
          shortsOverlayId: s.shortsOverlayId ? Number(s.shortsOverlayId) : null,
          longsOpacity: Number(s.longsOpacity ?? 1.0),
          shortsOpacity: Number(s.shortsOpacity ?? 1.0),
        };
        setSavedSettings(newSaved);
      } else {
        toast.error(data.error || "Failed to save video settings");
      }
    } catch (err) {
      console.error("Error saving video settings:", err);
      toast.error(err.message || "Could not save video settings");
    } finally {
      setSaving(false);
    }
  }

  // Filter overlays for longs (16:9 or all) and shorts (9:16 or all)
  const longsOverlays = availableOverlays.filter(
    (o) => o.aspectRatio === "16:9" || o.aspectRatio === "all"
  );
  const shortsOverlays = availableOverlays.filter(
    (o) => o.aspectRatio === "9:16" || o.aspectRatio === "all"
  );

  const selectedLongsOverlay = availableOverlays.find((o) => o.id === longsOverlayId);
  const selectedShortsOverlay = availableOverlays.find((o) => o.id === shortsOverlayId);

  if (loading) {
    return (
      <section className="p-12 border border-line bg-paper-card text-center space-y-3">
        <Loader2 size={24} className="animate-spin text-signal mx-auto" />
        <p className="text-xs text-ink-muted">Loading channel video settings...</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-ink pb-12">
      {/* Tab Header Banner */}
      <div className="p-5 sm:p-6 border border-line bg-paper-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-signal/10 text-signal border border-signal/20 font-semibold flex items-center gap-1">
                <Film size={11} /> Video Post-Processing
              </span>
              {useOverlay ? (
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={11} /> Overlays Active
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-paper text-ink-muted border border-line font-medium">
                  Overlays Disabled
                </span>
              )}
            </div>
            <h2 className="text-xl font-display font-bold text-ink">
              Video Settings: {channelName}
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted max-w-2xl">
              Configure video overlay layers and opacity levels for this channel. Select dedicated overlay assets from the general settings library for both long-form (16:9) and vertical shorts (9:16) documentary formats.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/settings?tab=video-overlays"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-paper text-ink-muted hover:text-ink hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
              title="Manage global video overlays library in General Settings"
            >
              <Layers size={13} className="text-signal" />
              <span>Manage Overlays Library</span>
              <ExternalLink size={12} className="opacity-70" />
            </Link>
          </div>
        </div>
      </div>

      {/* MASTER TOGGLE CARD */}
      <div className="p-5 sm:p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Film size={18} className="text-signal" />
              <h3 className="text-base font-display font-semibold text-ink">
                Use Video Overlay for Channel
              </h3>
            </div>
            <p className="text-xs text-ink-muted max-w-xl">
              When enabled, the selected video overlays will be blended onto rendered scenes and merged master videos for this channel at the configured opacity.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              id="channel-use-video-overlay-toggle"
              checked={useOverlay}
              onChange={(e) => setUseOverlay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-paper border border-line peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-ink-muted after:border-line after:border after:rounded-full after:h-4.5 after:w-5 after:transition-all peer-checked:bg-signal peer-checked:after:bg-white peer-checked:after:border-white"></div>
            <span className="ml-3 text-xs font-mono font-semibold uppercase tracking-wider text-ink">
              {useOverlay ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>

        {!useOverlay && (
          <div className="p-3.5 bg-paper border border-line text-xs text-ink-muted flex items-center gap-2">
            <Info size={14} className="text-ink-muted shrink-0" />
            <span>
              Video overlays are currently disabled for this channel. Videos will be exported without an overlay layer. Toggle the switch above to select overlay videos and adjust opacity.
            </span>
          </div>
        )}
      </div>

      {/* OVERLAY SELECTORS & OPACITY SLIDERS (ENABLED) */}
      {useOverlay && (
        <div className="space-y-6">
          {availableOverlays.length === 0 ? (
            <div className="p-8 border border-line bg-paper-card text-center space-y-3">
              <AlertCircle size={28} className="text-amber-500 mx-auto" />
              <h4 className="text-sm font-semibold text-ink">No Overlays Available in General Settings</h4>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                No video overlays have been uploaded to your global library yet. Please add overlays in General Settings to select them here.
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard/settings?tab=video-overlays"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Layers size={13} />
                  <span>Go to Video Overlays Library</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ========================================================= */}
              {/* LONGS (16:9) OVERLAY CONFIGURATION */}
              {/* ========================================================= */}
              <div className="border border-line bg-paper-card flex flex-col justify-between">
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <Monitor size={17} className="text-signal" />
                      <div>
                        <h4 className="text-sm font-display font-bold text-ink flex items-center gap-1.5">
                          <span>Longs Video Overlay</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs text-ink-muted">
                            16:9 Landscape
                          </span>
                        </h4>
                        <p className="text-[11px] text-ink-muted">
                          Overlay applied to horizontal documentary videos
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-ink flex items-center justify-between">
                      <span>Select 16:9 Overlay:</span>
                      <span className="text-[11px] font-mono text-ink-muted">
                        {longsOverlays.length} compatible in library
                      </span>
                    </label>
                    <select
                      id="longs-video-overlay-select"
                      value={longsOverlayId || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLongsOverlayId(val ? Number(val) : null);
                      }}
                      className="w-full px-3 py-2 text-xs bg-paper border border-line text-ink focus:outline-hidden focus:border-signal cursor-pointer"
                    >
                      <option value="">-- No Overlay (None) --</option>
                      {availableOverlays.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.aspectRatio.toUpperCase()})
                          {item.sizeBytes ? ` • ${formatBytes(item.sizeBytes)}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Overlay Live Preview */}
                  {selectedLongsOverlay ? (
                    <div className="p-3.5 border border-line bg-paper space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">
                            {selectedLongsOverlay.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-ink-muted">
                            <span className="px-1.5 py-0.2 bg-paper-card border border-line uppercase">
                              {selectedLongsOverlay.aspectRatio}
                            </span>
                            <span>{formatBytes(selectedLongsOverlay.sizeBytes)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setLightboxOverlay(selectedLongsOverlay)}
                            className="p-1.5 border border-line bg-paper-card hover:text-signal hover:border-signal/40 text-ink text-xs transition-colors cursor-pointer"
                            title="Fullscreen video preview"
                          >
                            <Maximize2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLongsOverlayId(null)}
                            className="p-1.5 border border-line bg-paper-card hover:text-rose-600 hover:border-rose-300 text-ink-muted text-xs transition-colors cursor-pointer"
                            title="Remove overlay"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Video Player with live opacity blending */}
                      <div className="relative aspect-video bg-linear-to-br from-slate-900 to-black overflow-hidden border border-line flex items-center justify-center shadow-inner">
                        <video
                          src={selectedLongsOverlay.fileUrl}
                          className="w-full h-full object-contain transition-opacity duration-150"
                          style={{ opacity: longsOpacity }}
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-xs text-[10px] font-mono text-white/90 border border-white/10 rounded-xs pointer-events-none">
                          Preview at {Math.round(longsOpacity * 100)}% Opacity
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 border border-dashed border-line bg-paper/50 text-center space-y-1">
                      <p className="text-xs text-ink-muted">No overlay selected for Longs</p>
                      <p className="text-[11px] text-ink-muted/80">
                        Choose an overlay above to preview it with live opacity control.
                      </p>
                    </div>
                  )}

                  {/* Dedicated 16:9 Opacity Slider Control */}
                  <div className="p-4 border border-line bg-paper space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders size={14} className="text-signal" />
                        <label className="text-xs font-semibold text-ink">
                          Longs Overlay Opacity
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-signal px-2 py-0.5 bg-signal/10 border border-signal/20">
                          {Math.round(longsOpacity * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setLongsOpacity(1.0)}
                          title="Reset to 100% full opacity"
                          className="p-1 hover:bg-line/40 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Range Input Slider */}
                    <div className="space-y-1.5">
                      <input
                        type="range"
                        id="longs-overlay-opacity-slider"
                        min="0.00"
                        max="1.00"
                        step="0.01"
                        value={longsOpacity}
                        onChange={(e) => setLongsOpacity(parseFloat(e.target.value))}
                        className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-signal"
                      />
                      <div className="flex justify-between text-[10px] text-ink-muted font-mono">
                        <span>0% (Transparent)</span>
                        <span className={longsOpacity >= 0.4 && longsOpacity <= 0.6 ? "text-signal font-semibold" : ""}>
                          50% (Subtle)
                        </span>
                        <span className={longsOpacity >= 0.95 ? "text-signal font-semibold" : ""}>
                          100% (Solid)
                        </span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-mono text-ink-muted uppercase mr-1">Presets:</span>
                      {[0.25, 0.50, 0.75, 1.0].map((presetVal) => {
                        const isPresetActive = Math.abs(longsOpacity - presetVal) < 0.02;
                        return (
                          <button
                            key={presetVal}
                            type="button"
                            onClick={() => setLongsOpacity(presetVal)}
                            className={`px-2 py-0.5 text-[10px] font-mono border transition-all cursor-pointer ${
                              isPresetActive
                                ? "bg-signal text-white border-signal font-bold shadow-xs"
                                : "bg-paper-card text-ink-muted border-line hover:text-ink hover:border-signal/40"
                            }`}
                          >
                            {Math.round(presetVal * 100)}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* SHORTS (9:16) OVERLAY CONFIGURATION */}
              {/* ========================================================= */}
              <div className="border border-line bg-paper-card flex flex-col justify-between">
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <Smartphone size={17} className="text-rose-500" />
                      <div>
                        <h4 className="text-sm font-display font-bold text-ink flex items-center gap-1.5">
                          <span>Shorts Video Overlay</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs text-ink-muted">
                            9:16 Vertical
                          </span>
                        </h4>
                        <p className="text-[11px] text-ink-muted">
                          Overlay applied to vertical shorts / reels
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-ink flex items-center justify-between">
                      <span>Select 9:16 Overlay:</span>
                      <span className="text-[11px] font-mono text-ink-muted">
                        {shortsOverlays.length} compatible in library
                      </span>
                    </label>
                    <select
                      id="shorts-video-overlay-select"
                      value={shortsOverlayId || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShortsOverlayId(val ? Number(val) : null);
                      }}
                      className="w-full px-3 py-2 text-xs bg-paper border border-line text-ink focus:outline-hidden focus:border-signal cursor-pointer"
                    >
                      <option value="">-- No Overlay (None) --</option>
                      {availableOverlays.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.aspectRatio.toUpperCase()})
                          {item.sizeBytes ? ` • ${formatBytes(item.sizeBytes)}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Overlay Live Preview */}
                  {selectedShortsOverlay ? (
                    <div className="p-3.5 border border-line bg-paper space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">
                            {selectedShortsOverlay.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-ink-muted">
                            <span className="px-1.5 py-0.2 bg-paper-card border border-line uppercase">
                              {selectedShortsOverlay.aspectRatio}
                            </span>
                            <span>{formatBytes(selectedShortsOverlay.sizeBytes)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setLightboxOverlay(selectedShortsOverlay)}
                            className="p-1.5 border border-line bg-paper-card hover:text-signal hover:border-signal/40 text-ink text-xs transition-colors cursor-pointer"
                            title="Fullscreen video preview"
                          >
                            <Maximize2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShortsOverlayId(null)}
                            className="p-1.5 border border-line bg-paper-card hover:text-rose-600 hover:border-rose-300 text-ink-muted text-xs transition-colors cursor-pointer"
                            title="Remove overlay"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Video Player (Vertical Container) with live opacity blending */}
                      <div className="relative h-56 max-w-xs mx-auto aspect-[9/16] bg-linear-to-br from-slate-900 to-black overflow-hidden border border-line flex items-center justify-center shadow-inner">
                        <video
                          src={selectedShortsOverlay.fileUrl}
                          className="w-full h-full object-contain transition-opacity duration-150"
                          style={{ opacity: shortsOpacity }}
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                        <div className="absolute bottom-2 left-2 right-2 text-center px-1.5 py-0.5 bg-black/70 backdrop-blur-xs text-[10px] font-mono text-white/90 border border-white/10 rounded-xs pointer-events-none">
                          {Math.round(shortsOpacity * 100)}% Opacity
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 border border-dashed border-line bg-paper/50 text-center space-y-1">
                      <p className="text-xs text-ink-muted">No overlay selected for Shorts</p>
                      <p className="text-[11px] text-ink-muted/80">
                        Choose an overlay above to preview it with live opacity control.
                      </p>
                    </div>
                  )}

                  {/* Dedicated 9:16 Opacity Slider Control */}
                  <div className="p-4 border border-line bg-paper space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders size={14} className="text-signal" />
                        <label className="text-xs font-semibold text-ink">
                          Shorts Overlay Opacity
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-signal px-2 py-0.5 bg-signal/10 border border-signal/20">
                          {Math.round(shortsOpacity * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setShortsOpacity(1.0)}
                          title="Reset to 100% full opacity"
                          className="p-1 hover:bg-line/40 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Range Input Slider */}
                    <div className="space-y-1.5">
                      <input
                        type="range"
                        id="shorts-overlay-opacity-slider"
                        min="0.00"
                        max="1.00"
                        step="0.01"
                        value={shortsOpacity}
                        onChange={(e) => setShortsOpacity(parseFloat(e.target.value))}
                        className="w-full h-2 bg-line rounded-lg appearance-none cursor-pointer accent-signal"
                      />
                      <div className="flex justify-between text-[10px] text-ink-muted font-mono">
                        <span>0% (Transparent)</span>
                        <span className={shortsOpacity >= 0.4 && shortsOpacity <= 0.6 ? "text-signal font-semibold" : ""}>
                          50% (Subtle)
                        </span>
                        <span className={shortsOpacity >= 0.95 ? "text-signal font-semibold" : ""}>
                          100% (Solid)
                        </span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-mono text-ink-muted uppercase mr-1">Presets:</span>
                      {[0.25, 0.50, 0.75, 1.0].map((presetVal) => {
                        const isPresetActive = Math.abs(shortsOpacity - presetVal) < 0.02;
                        return (
                          <button
                            key={presetVal}
                            type="button"
                            onClick={() => setShortsOpacity(presetVal)}
                            className={`px-2 py-0.5 text-[10px] font-mono border transition-all cursor-pointer ${
                              isPresetActive
                                ? "bg-signal text-white border-signal font-bold shadow-xs"
                                : "bg-paper-card text-ink-muted border-line hover:text-ink hover:border-signal/40"
                            }`}
                          >
                            {Math.round(presetVal * 100)}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTION SAVE / RESET BAR */}
      <div className="p-4 border border-line bg-paper-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-500/10 px-2 py-1 border border-amber-500/20 font-medium">
              <AlertCircle size={13} /> Unsaved changes pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <Check size={13} /> Settings up to date
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-paper text-ink hover:bg-ink/5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            id="save-channel-video-settings-btn"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving Settings...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Save Video Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {mounted && lightboxOverlay && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-4xl bg-paper border border-line shadow-2xl p-4 sm:p-6 space-y-4 animate-scale-in text-ink my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="space-y-0.5 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <Film size={16} className="text-signal" />
                  <h3 className="text-sm sm:text-base font-display font-bold text-ink truncate">
                    {lightboxOverlay.name}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-paper-card border border-line uppercase">
                    {lightboxOverlay.aspectRatio}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-ink-muted">
                  Size: {formatBytes(lightboxOverlay.sizeBytes)} • Mime: {lightboxOverlay.mimeType || "video/mp4"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLightboxOverlay(null)}
                className="p-1.5 border border-line text-ink-muted hover:text-ink hover:border-signal/40 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative w-full max-h-[65vh] bg-black flex items-center justify-center overflow-hidden border border-line">
              <video
                src={lightboxOverlay.fileUrl}
                className="max-h-[65vh] max-w-full object-contain"
                controls
                autoPlay
                loop
                playsInline
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-ink-muted">
                Press ESC or click the close button to exit preview.
              </span>
              <button
                type="button"
                onClick={() => setLightboxOverlay(null)}
                className="px-4 py-1.5 border border-line bg-paper-card text-ink hover:bg-ink/5 font-semibold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

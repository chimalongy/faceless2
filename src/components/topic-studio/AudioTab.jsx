"use client";

import {
  Mic,
  Play,
  Pause,
  Upload,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  Loader2,
  Gauge,
  CheckSquare,
  Square
} from "lucide-react";
import { useState, useRef } from "react";
import { KOKORO_VOICES } from "@/lib/audio-generator";
import toast from "react-hot-toast";

export default function AudioTab({
  scenesJson,
  sceneAudios = {},
  selectedVoice = "af_heart",
  setSelectedVoice,
  audioSpeed = 1.0,
  setAudioSpeed,
  bgMusic,
  setBgMusic,
  isGeneratingAllAudios = false,
  generatingSceneAudios = {},
  handleUploadSceneAudio,
  handleDeleteSceneAudio,
  handleDeleteMultipleSceneAudios,
  handleGenerateSceneAudio,
  handleGenerateAllAudios,
}) {
  const [playingSceneNum, setPlayingSceneNum] = useState(null);
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [downloadingAudios, setDownloadingAudios] = useState({});
  const [selectedScenes, setSelectedScenes] = useState(new Set());
  const audioRefs = useRef({});

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  // Count scenes with/without audio
  const scenesWithAudio = parsedScenes.filter((s) => {
    const sNum = s.scene_number;
    const a = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
    return !!a?.url;
  });

  const unsynthesizedScenes = parsedScenes.filter((s) => {
    const sNum = s.scene_number;
    const a = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
    return !a?.url;
  });

  const selectedScenesWithAudio = Array.from(selectedScenes).filter((sNum) => {
    const a = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
    return !!a?.url;
  });

  const isAllSelected = parsedScenes.length > 0 && selectedScenes.size === parsedScenes.length;
  const isAllUnsynthesizedSelected =
    unsynthesizedScenes.length > 0 &&
    selectedScenes.size === unsynthesizedScenes.length &&
    unsynthesizedScenes.every((s) => selectedScenes.has(s.scene_number));

  function toggleSelectScene(sceneNum) {
    setSelectedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneNum)) {
        next.delete(sceneNum);
      } else {
        next.add(sceneNum);
      }
      return next;
    });
  }

  function handleSelectAllScenes() {
    setSelectedScenes(new Set(parsedScenes.map((s) => s.scene_number)));
  }

  function handleDeselectAll() {
    setSelectedScenes(new Set());
  }

  function handleToggleUnsynthesizedScenes() {
    if (isAllUnsynthesizedSelected) {
      setSelectedScenes(new Set());
    } else {
      setSelectedScenes(new Set(unsynthesizedScenes.map((s) => s.scene_number)));
      if (unsynthesizedScenes.length === 0) {
        toast("All scenes already have audio narration synthesized.", { icon: "✨" });
      } else {
        toast.success(`Selected ${unsynthesizedScenes.length} unsynthesized scene(s).`);
      }
    }
  }

  function handleDeleteSelectedAudio() {
    if (selectedScenes.size === 0) return;
    if (selectedScenesWithAudio.length === 0) {
      toast("None of the selected scenes have audio generated yet.");
      return;
    }
    if (handleDeleteMultipleSceneAudios) {
      handleDeleteMultipleSceneAudios(selectedScenesWithAudio);
      setSelectedScenes(new Set());
    }
  }

  function handleDeleteAllGeneratedAudio() {
    if (scenesWithAudio.length === 0) {
      toast("No generated scene audio tracks to delete.");
      return;
    }
    const allAudioSceneNums = scenesWithAudio.map((s) => s.scene_number);
    if (handleDeleteMultipleSceneAudios) {
      handleDeleteMultipleSceneAudios(allAudioSceneNums);
      setSelectedScenes(new Set());
    }
  }

  function togglePrompt(sceneNum) {
    setExpandedPrompts((prev) => ({
      ...prev,
      [sceneNum]: !prev[sceneNum],
    }));
  }

  function togglePlay(sceneNum, audioData) {
    const audioEl = audioRefs.current[sceneNum];
    if (!audioEl) return;

    if (playingSceneNum === sceneNum) {
      audioEl.pause();
      setPlayingSceneNum(null);
    } else {
      // Pause any previous playing audio
      if (playingSceneNum && audioRefs.current[playingSceneNum]) {
        audioRefs.current[playingSceneNum].pause();
      }
      setPlayingSceneNum(sceneNum);
      audioEl.currentTime = 0;
      audioEl.play().catch((err) => {
        console.warn("Audio playback error:", err);
        setPlayingSceneNum(null);
      });
    }
  }

  async function handleDownloadAudio(sceneNum, url, audioName) {
    if (!url) return;
    setDownloadingAudios((prev) => ({ ...prev, [sceneNum]: true }));
    const filename = audioName || `scene-${sceneNum}-narration.wav`;
    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download proxy error");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      const link = document.createElement("a");
      link.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingAudios((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Voice Configuration & Ambience Studio Card */}
      <div className="p-4 sm:p-6 border border-line bg-paper-card space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Mic size={16} className="text-signal" /> Kokoro-82M Voice & Narration Engine
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Select high-fidelity AI narrator voice profiles and synthesize scene-by-scene voiceovers via Trigger.dev.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Select All Toggle */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={isAllSelected ? handleDeselectAll : handleSelectAllScenes}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                title="Select all scene narration tracks"
              >
                {isAllSelected ? (
                  <>
                    <CheckSquare size={13} className="text-signal" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={13} />
                    <span>Select All ({parsedScenes.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Select Unsynthesized */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={handleToggleUnsynthesizedScenes}
                className={`inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer ${
                  unsynthesizedScenes.length === 0 ? "opacity-60" : ""
                }`}
                title="Select only scenes that do not have audio narration yet"
              >
                {isAllUnsynthesizedSelected ? (
                  <>
                    <CheckSquare size={13} className="text-signal" />
                    <span>Deselect Unsynthesized ({unsynthesizedScenes.length})</span>
                  </>
                ) : (
                  <>
                    <VolumeX size={13} className="text-amber-600" />
                    <span>Select Unsynthesized ({unsynthesizedScenes.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Delete All Generated Audios */}
            {scenesWithAudio.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllGeneratedAudio}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-200 bg-rose-50/70 hover:bg-rose-100/80 text-xs font-semibold text-rose-700 transition-all cursor-pointer"
                title="Delete all generated scene narration audio tracks"
              >
                <Trash2 size={13} />
                <span>Delete All Audios ({scenesWithAudio.length})</span>
              </button>
            )}

            {/* Generate All Audios */}
            <button
              type="button"
              disabled={isGeneratingAllAudios || parsedScenes.length === 0 || unsynthesizedScenes.length === 0}
              onClick={handleGenerateAllAudios}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-60 shrink-0"
              title={
                unsynthesizedScenes.length > 0
                  ? `Synthesize narration for ${unsynthesizedScenes.length} remaining scene(s)`
                  : "All scenes already have narration"
              }
            >
              {isGeneratingAllAudios ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating All Audios...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Generate All Audios {unsynthesizedScenes.length > 0 ? `(${unsynthesizedScenes.length})` : ""}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Voice Selection & Speed Multiplier */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Voice Actor Selector */}
          <div className="md:col-span-2">
            <label
              className="block text-xs font-semibold text-ink/80 mb-1.5"
              htmlFor="kokoro-voice"
            >
              Kokoro AI Narrator Voice ({KOKORO_VOICES.length} Profiles Available)
            </label>
            <select
              id="kokoro-voice"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full h-10 px-3.5 border border-line bg-white text-xs text-ink outline-none focus:border-signal cursor-pointer font-sans"
            >
              <optgroup label="🇺🇸 American English (Female)">
                {KOKORO_VOICES.filter((v) => v.lang === "en-US" && v.gender === "female").map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🇺🇸 American English (Male)">
                {KOKORO_VOICES.filter((v) => v.lang === "en-US" && v.gender === "male").map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🇬🇧 British English">
                {KOKORO_VOICES.filter((v) => v.lang === "en-GB").map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🌍 International Voices (ES, FR, IT, HI, JA)">
                {KOKORO_VOICES.filter((v) => !v.lang.startsWith("en-")).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Voice Speed Multiplier */}
          <div>
            <label
              className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
              htmlFor="voice-speed"
            >
              <Gauge size={13} className="text-signal" /> Narration Speed
            </label>
            <select
              id="voice-speed"
              value={audioSpeed || 1.0}
              onChange={(e) => setAudioSpeed?.(parseFloat(e.target.value))}
              className="w-full h-10 px-3.5 border border-line bg-white text-xs text-ink outline-none focus:border-signal cursor-pointer font-sans"
            >
              <option value={0.75}>0.75x — Very Slow & Dramatic</option>
              <option value={0.85}>0.85x — Slow Storytelling</option>
              <option value={1.0}>1.00x — Standard Natural (Default)</option>
              <option value={1.2}>1.20x — Fast & Energetic</option>
              <option value={1.35}>1.35x — Quick Narrative</option>
              <option value={1.5}>1.50x — High Speed (1.5x)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Scenes Action Bar */}
      {selectedScenes.size > 0 && (
        <div className="p-3 bg-paper-dark border border-signal/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
            <span className="text-xs font-semibold text-ink font-mono">
              {selectedScenes.size} scene{selectedScenes.size > 1 ? "s" : ""} selected ({selectedScenesWithAudio.length} with audio)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Delete Selected Audio Button */}
            <button
              type="button"
              disabled={selectedScenesWithAudio.length === 0}
              onClick={handleDeleteSelectedAudio}
              className="px-3.5 py-1.5 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete audio tracks for selected scenes"
            >
              <Trash2 size={12} />
              <span>Delete Selected Audio ({selectedScenesWithAudio.length})</span>
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-[11px] font-semibold text-ink transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <span>Clear Selection</span>
            </button>
          </div>
        </div>
      )}

      {/* Scene-by-Scene Audio Track Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
            Scene Narration Tracks ({parsedScenes.length} Scenes)
          </h4>
        </div>

        {parsedScenes.length === 0 ? (
          <div className="p-6 sm:p-8 border border-line bg-paper-card text-center space-y-2 text-ink-muted">
            <AlertCircle size={32} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes defined</p>
            <p className="text-xs text-ink-muted">
              Add scenes in the "Scenes (JSON)" tab to start synthesizing narration.
            </p>
          </div>
        ) : (
          parsedScenes.map((scene) => {
            const sceneNum = scene.scene_number;
            const audioData = sceneAudios[sceneNum] || sceneAudios[String(sceneNum)] || sceneAudios[Number(sceneNum)];
            const hasAudio = !!audioData?.url;
            const isPlaying = playingSceneNum === sceneNum;
            const isGeneratingThis = !!generatingSceneAudios[sceneNum] || isGeneratingAllAudios;
            const isDownloading = !!downloadingAudios[sceneNum];
            const textToSpeak = scene.audio_text || scene.narration || scene.script || scene.text || "";

            return (
              <div
                key={sceneNum}
                className={`p-3.5 sm:p-5 border bg-paper-card space-y-4 hover:border-signal/40 transition-all overflow-hidden ${
                  selectedScenes.has(sceneNum) ? "border-signal/50 bg-signal/[0.02]" : "border-line"
                }`}
              >
                {/* Scene Header & Actions */}
                <div className="flex flex-col gap-3 border-b border-line/60 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedScenes.has(sceneNum)}
                        onChange={() => toggleSelectScene(sceneNum)}
                        className="w-4 h-4 accent-signal cursor-pointer"
                        title="Select this scene narration"
                      />
                      <span className="w-6 h-6 sm:w-7 sm:h-7 bg-ink text-white font-mono text-[11px] sm:text-xs font-bold flex items-center justify-center shrink-0">
                        {sceneNum}
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink">
                        SCENE 0{sceneNum}
                      </span>
                      {audioData?.endpointUsed && (
                        <span className="px-2 py-0.5 text-[9px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300 max-w-[150px] truncate" title={audioData.endpointUsed}>
                          Via {audioData.endpointUsed}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons wrapped cleanly on mobile */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {/* Play / Pause Toggle Button */}
                    {hasAudio && (
                      <button
                        type="button"
                        onClick={() => togglePlay(sceneNum, audioData)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                          isPlaying
                            ? "bg-signal text-white border-signal shadow-xs"
                            : "bg-white text-ink border-line hover:bg-ink/5"
                        }`}
                      >
                        {isPlaying ? <Pause size={12} /> : <Play size={12} className="fill-current" />}
                        <span>{isPlaying ? "Pause" : "Play Audio"}</span>
                      </button>
                    )}

                    {/* Upload Audio File */}
                    <label className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-[11px] sm:text-xs font-semibold text-ink transition-all cursor-pointer">
                      <Upload size={12} />
                      <span>{hasAudio ? "Replace" : "Upload"}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadSceneAudio(sceneNum, file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>

                    {/* Synthesize Button for Individual Scene */}
                    <button
                      type="button"
                      disabled={isGeneratingThis || !textToSpeak.trim()}
                      onClick={() => handleGenerateSceneAudio(sceneNum)}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-[11px] sm:text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                      title="Synthesize audio narration via Kokoro TTS"
                    >
                      {generatingSceneAudios[sceneNum] ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          <span>Synthesize</span>
                        </>
                      )}
                    </button>

                    {/* See / Hide Narration Text Toggle */}
                    <button
                      type="button"
                      onClick={() => togglePrompt(sceneNum)}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-[11px] sm:text-xs font-semibold text-ink transition-all cursor-pointer"
                    >
                      {expandedPrompts[sceneNum] ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{expandedPrompts[sceneNum] ? "Hide Text" : "Script"}</span>
                    </button>

                    {/* Download Audio */}
                    {hasAudio && (
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => handleDownloadAudio(sceneNum, audioData.url, audioData.name)}
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-ink text-[11px] sm:text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                        title="Download WAV audio"
                      >
                        {isDownloading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Download size={12} />
                        )}
                        <span>Download</span>
                      </button>
                    )}

                    {/* Delete Scene Audio */}
                    {hasAudio && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSceneAudio(sceneNum)}
                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-300 text-ink-muted hover:text-rose-600 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer ml-auto sm:ml-0"
                        title="Delete audio for this scene"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Narration Script Text Box */}
                {expandedPrompts[sceneNum] && (
                  <div className="space-y-1 animate-fade-in">
                    <span className="text-[11px] font-semibold text-ink-muted uppercase font-mono">
                      Scene Narration Script:
                    </span>
                    <p className="p-3 bg-paper-dark/60 border border-line font-mono text-xs text-ink leading-relaxed break-words">
                      {textToSpeak || "No narration script text specified for this scene."}
                    </p>
                  </div>
                )}

                {/* Audio Status & Waveform Player */}
                <div className="p-3.5 bg-paper-dark/40 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-signal/10 border border-signal/20 text-signal flex items-center justify-center shrink-0">
                      <Volume2 size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        {audioData?.name || (hasAudio ? `Scene 0${sceneNum} Audio.wav` : "No narration generated yet")}
                      </p>
                      <p className="text-[11px] text-ink-muted font-mono">
                        {hasAudio ? `Ready • Estimated ~${audioData.duration || "00:15"}` : "Click Synthesize or Generate All"}
                      </p>
                    </div>
                  </div>

                  {hasAudio && (
                    <audio
                      ref={(el) => {
                        audioRefs.current[sceneNum] = el;
                      }}
                      src={audioData.url}
                      onEnded={() => setPlayingSceneNum(null)}
                      className="w-full sm:w-60 h-8"
                      controls
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

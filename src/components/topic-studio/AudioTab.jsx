"use client";

import {
  Mic,
  Play,
  Pause,
  Upload,
  Sparkles,
  Trash2,
  Volume2,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { useState, useRef } from "react";

export default function AudioTab({
  scenesJson,
  sceneAudios,
  selectedVoice,
  setSelectedVoice,
  bgMusic,
  setBgMusic,
  handleUploadSceneAudio,
  handleDeleteSceneAudio,
  handleGenerateSceneAudio,
  handleGenerateAllAudios,
}) {
  const [playingSceneNum, setPlayingSceneNum] = useState(null);
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const audioRefs = useRef({});

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  function togglePrompt(sceneNum) {
    setExpandedPrompts((prev) => ({
      ...prev,
      [sceneNum]: !prev[sceneNum],
    }));
  }

  function togglePlay(sceneNum, audioData) {
    if (playingSceneNum === sceneNum) {
      setPlayingSceneNum(null);
      if (audioRefs.current[sceneNum]) {
        audioRefs.current[sceneNum].pause();
      }
    } else {
      // Pause any other playing audio
      if (playingSceneNum && audioRefs.current[playingSceneNum]) {
        audioRefs.current[playingSceneNum].pause();
      }
      setPlayingSceneNum(sceneNum);
      if (audioData?.url && audioRefs.current[sceneNum]) {
        audioRefs.current[sceneNum].currentTime = 0;
        audioRefs.current[sceneNum].play().catch(() => {});
      }
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Ambience & Voice Settings */}
      <div className="p-6 border border-line bg-paper-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Mic size={16} className="text-signal" /> Scene Audio & Narration Studio
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Upload custom audio or synthesize voice narration tailored to each scene.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAllAudios}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Generate All</span>
          </button>
        </div>

        {/* Voice & Soundtrack Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              className="block text-xs font-semibold text-ink/80 mb-1.5"
              htmlFor="voice-actor"
            >
              Voice Reference Profile
            </label>
            <select
              id="voice-actor"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full h-10 px-3.5 border border-line bg-white text-xs text-ink outline-none focus:border-signal cursor-pointer"
            >
              <option>Marcus - Deep Narrator (Naturalist & Biology)</option>
              <option>Seraphina - Enigmatic Scholar (History & Mystery)</option>
              <option>Evelyn - Cinematic Naturalist (Nature Ambient)</option>
              <option>Julian - Financial Analyst (Macro & Wealth)</option>
            </select>
          </div>

          <div>
            <label
              className="block text-xs font-semibold text-ink/80 mb-1.5"
              htmlFor="bg-soundtrack"
            >
              Background Ambience & Soundtrack
            </label>
            <select
              id="bg-soundtrack"
              value={bgMusic}
              onChange={(e) => setBgMusic(e.target.value)}
              className="w-full h-10 px-3.5 border border-line bg-white text-xs text-ink outline-none focus:border-signal cursor-pointer"
            >
              <option>Ethereal Sub-bass & Ambient Wind (-18dB)</option>
              <option>Dark Cinematic Strings & Cellos (-16dB)</option>
              <option>Subterranean Water Drops & Low Drone (-20dB)</option>
              <option>None (Acapella Voice Only)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scene-by-Scene Audio List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
            Scene Narration Tracks ({parsedScenes.length} Scenes)
          </h4>
        </div>

        {parsedScenes.length === 0 ? (
          <div className="p-8 border border-line bg-paper-card text-center space-y-2 text-ink-muted">
            <AlertCircle size={32} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes defined</p>
            <p className="text-xs text-ink-muted">
              Add scenes in the "Scenes (JSON)" tab to start uploading or generating scene audio.
            </p>
          </div>
        ) : (
          parsedScenes.map((scene) => {
            const sceneNum = scene.scene_number;
            const audioData = sceneAudios[sceneNum];
            const hasAudio = !!audioData?.url;
            const isPlaying = playingSceneNum === sceneNum;

            return (
              <div
                key={sceneNum}
                className="p-5 border border-line bg-paper-card space-y-4 hover:border-signal/40 transition-all"
              >
                {/* Scene Header & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 bg-ink text-white font-mono text-xs font-bold flex items-center justify-center">
                      {sceneNum}
                    </span>
                    <span className="font-mono text-xs font-semibold text-ink">
                      SCENE 0{sceneNum}
                    </span>
                  </div>

                  {/* Scene Actions: Upload Audio, Generate, Delete Audio */}
                  <div className="flex items-center gap-2">
                    {/* Upload Audio File */}
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer">
                      <Upload size={12} />
                      <span>{hasAudio ? "Replace Audio" : "Upload Audio"}</span>
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

                    {/* Generate Button for Individual Scene */}
                    <button
                      type="button"
                      onClick={() => handleGenerateSceneAudio(sceneNum)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-xs font-semibold transition-all cursor-pointer"
                      title="Generate audio for this scene"
                    >
                      <Sparkles size={12} />
                      <span>Generate</span>
                    </button>

                    {/* See / Hide Prompt Toggle */}
                    <button
                      type="button"
                      onClick={() => togglePrompt(sceneNum)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                    >
                      {expandedPrompts[sceneNum] ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{expandedPrompts[sceneNum] ? "Hide Prompt" : "See Prompt"}</span>
                    </button>

                    {/* Delete Scene Audio */}
                    {hasAudio && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSceneAudio(sceneNum)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-300 text-ink-muted hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                        title="Delete audio for this scene"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Audio Text (Narration Line - Hidden by default) */}
                {expandedPrompts[sceneNum] && (
                  <div className="space-y-1 animate-fade-in">
                    <span className="text-[11px] font-semibold text-ink-muted uppercase font-mono">
                      Audio Text (Narration):
                    </span>
                    <p className="p-3 bg-paper-dark/60 border border-line font-mono text-xs text-ink leading-relaxed italic">
                      "{scene.audio_text || "No narration text provided for this scene."}"
                    </p>
                  </div>
                )}

                {/* Media Player for Scene Audio */}
                <div className="p-3.5 bg-white border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* HTML5 audio element for playback */}
                  {hasAudio && (
                    <audio
                      ref={(el) => {
                        if (el) audioRefs.current[sceneNum] = el;
                      }}
                      src={audioData.url}
                      onEnded={() => setPlayingSceneNum(null)}
                      className="hidden"
                    />
                  )}

                  <div className="flex items-center gap-3 flex-1">
                    {/* Play/Pause Button */}
                    <button
                      type="button"
                      disabled={!hasAudio}
                      onClick={() => togglePlay(sceneNum, audioData)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        hasAudio
                          ? isPlaying
                            ? "bg-signal text-white ring-2 ring-signal/30"
                            : "bg-ink text-white hover:bg-signal"
                          : "bg-ink/10 text-ink-muted cursor-not-allowed opacity-40"
                      }`}
                      title={hasAudio ? (isPlaying ? "Pause" : "Play Scene Audio") : "Upload or generate audio first"}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                    </button>

                    {/* Waveform Track */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted">
                        <span>{hasAudio ? (isPlaying ? "Playing..." : "Audio Track Ready") : "No audio uploaded yet"}</span>
                        <span>{hasAudio ? (isPlaying ? "00:18" : "--:--") : "--:--"}</span>
                      </div>
                      <div className="h-6 flex items-center gap-0.5 bg-paper-dark p-1 border border-line/60">
                        {Array.from({ length: 32 }).map((_, i) => (
                          <div
                            key={i}
                            className={`flex-1 transition-all ${
                              hasAudio
                                ? isPlaying
                                  ? i < 14
                                    ? "bg-signal animate-pulse"
                                    : "bg-signal/40"
                                  : "bg-ink/30"
                                : "bg-ink/10"
                            }`}
                            style={{
                              height: hasAudio
                                ? `${Math.max(20, Math.sin((i + sceneNum) * 0.5) * 100 * (i % 2 === 0 ? 0.85 : 0.45))}%`
                                : "20%",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

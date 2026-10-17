"use client";

import {
  Mic,
  Plus,
  Play,
  Pause,
  Trash2,
  Volume2,
  RefreshCw,
  UploadCloud,
  FileAudio,
  Sparkles,
  Check,
  AlertCircle,
  Clock,
  Download,
  Languages,
  ArrowRight,
  ShieldAlert,
  Loader2,
  ExternalLink,
  ChevronDown,
  Info,
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

const SAMPLE_PRESETS = [
  {
    label: "Motivational Hook",
    text: "You are not behind; you are hiding. There's a specific moment today that decides who you become in five years. Most people walk right past it.",
  },
  {
    label: "Documentary Intro",
    text: "Deep in the Pacific trench, pressure exceeds one thousand atmospheres. Yet beneath the absolute blackness, life did not merely survive; it mastered the void.",
  },
  {
    label: "Cinematic Narrative",
    text: "The engine purred like a caged animal. Every meter of asphalt behind us was a memory we couldn't afford to revisit.",
  },
];

const LANGUAGES = [
  "English",
  "Chinese",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
];

export default function VoiceClonesPage() {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [endpointStatus, setEndpointStatus] = useState({ online: false, endpoint: "" });

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newRefText, setNewRefText] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Audio Playback for reference audio
  const [playingVoice, setPlayingVoice] = useState(null);
  const audioPlayerRef = useRef(null);

  // Generation Playground State
  const [selectedVoiceForGen, setSelectedVoiceForGen] = useState("");
  const [genText, setGenText] = useState(SAMPLE_PRESETS[0].text);
  const [genLanguage, setGenLanguage] = useState("English");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState(null);

  // Delete Confirmation State
  const [voiceToDelete, setVoiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load voices on mount
  useEffect(() => {
    fetchVoices();
  }, []);

  async function fetchVoices(isManualRefresh = false) {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/voice-clones");
      const data = await res.json();
      if (res.ok && data.success) {
        setVoices(data.voices || []);
        setEndpointStatus({
          online: Boolean(data.online),
          endpoint: data.endpoint || "",
        });
        if (data.voices?.length > 0 && !selectedVoiceForGen) {
          setSelectedVoiceForGen(data.voices[0].voice_name);
        }
      } else {
        setEndpointStatus({
          online: false,
          endpoint: data.endpoint || "",
          error: data.error || "Cloner service offline",
        });
      }
    } catch (err) {
      console.error("Failed to load voice clones:", err);
      setEndpointStatus({
        online: false,
        endpoint: "",
        error: err.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File is too large. Please upload an audio file under 20MB.");
      return;
    }

    setAudioFile(file);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(URL.createObjectURL(file));

    // Suggest voice name if empty
    if (!newVoiceName) {
      const suggestedName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setNewVoiceName(suggestedName);
    }
  }

  async function handleCreateVoice(e) {
    e.preventDefault();
    if (!newVoiceName.trim()) {
      toast.error("Please enter a voice name.");
      return;
    }
    if (!newRefText.trim()) {
      toast.error("Please enter the transcript of the reference audio.");
      return;
    }
    if (!audioFile) {
      toast.error("Please upload reference audio (WAV or MP3).");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Registering voice clone on Qwen3-TTS cluster...");

    try {
      const formData = new FormData();
      formData.append("voiceName", newVoiceName.trim());
      formData.append("refText", newRefText.trim());
      formData.append("audioFile", audioFile);

      const res = await fetch("/api/voice-clones", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register voice clone");
      }

      toast.success(`Voice "${newVoiceName}" registered successfully!`, { id: toastId });
      setShowCreateModal(false);
      setNewVoiceName("");
      setNewRefText("");
      setAudioFile(null);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);

      // Refresh list
      await fetchVoices();
      setSelectedVoiceForGen(newVoiceName.trim());
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteVoice() {
    if (!voiceToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting voice clone "${voiceToDelete.voice_name}"...`);

    try {
      const res = await fetch(`/api/voice-clones?name=${encodeURIComponent(voiceToDelete.voice_name)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete voice clone");
      }

      toast.success(`Voice clone "${voiceToDelete.voice_name}" removed.`, { id: toastId });
      setVoiceToDelete(null);
      if (playingVoice === voiceToDelete.voice_name) {
        stopAudioPlayback();
      }
      await fetchVoices();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleReferenceAudio(voiceName) {
    if (playingVoice === voiceName) {
      stopAudioPlayback();
      return;
    }

    stopAudioPlayback();
    const audioUrl = `/api/voice-clones/audio?name=${encodeURIComponent(voiceName)}`;
    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio;
    setPlayingVoice(voiceName);

    audio.onended = () => {
      setPlayingVoice(null);
    };
    audio.onerror = () => {
      toast.error("Could not stream reference audio.");
      setPlayingVoice(null);
    };

    audio.play().catch(() => {
      setPlayingVoice(null);
    });
  }

  function stopAudioPlayback() {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setPlayingVoice(null);
  }

  async function handleGenerateAudio(e) {
    e.preventDefault();
    if (!selectedVoiceForGen) {
      toast.error("Please select a voice clone.");
      return;
    }
    if (!genText.trim()) {
      toast.error("Please enter speech text to generate.");
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(`Synthesizing speech with "${selectedVoiceForGen}"...`);

    try {
      const res = await fetch("/api/voice-clones/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceName: selectedVoiceForGen,
          text: genText.trim(),
          language: genLanguage,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Synthesis failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
      const url = URL.createObjectURL(blob);
      setGeneratedAudioUrl(url);
      setGeneratedAudioBlob(blob);

      toast.success("Cloned audio generated successfully!", { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadGeneratedAudio() {
    if (!generatedAudioUrl) return;
    const a = document.createElement("a");
    a.href = generatedAudioUrl;
    a.download = `${selectedVoiceForGen || "cloned"}-speech.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="space-y-8 max-w-6xl animate-card-rise pb-24">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-line flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
              Qwen3-TTS 1.7B Cloner
            </span>
            <span className="text-xs font-mono text-ink-muted">/voice-clones</span>
            {endpointStatus.online ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cluster Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Standby / Deploying
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
            Voice Cloning Desk
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl leading-relaxed">
            Register custom voice clones with reference audio, review voice metadata, test neural speech synthesis, and deploy across channel topics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchVoices(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-line bg-paper-card text-ink hover:bg-ink/[0.03] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Clones"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-signal" : "text-ink-muted"} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-signal hover:bg-signal-hover text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>New Voice Clone</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Clones Library & Synthesis Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Cloned Voices Library (7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="p-1 bg-signal/10 text-signal">
                <Mic size={15} />
              </span>
              <span>Available Voice Clones</span>
              <span className="ml-1 text-xs font-mono text-ink-muted bg-ink/5 px-2 py-0.5 rounded-full">
                {voices.length}
              </span>
            </div>
            <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Persistent Storage
            </span>
          </div>

          {loading ? (
            <div className="p-12 border border-line bg-paper-card text-center flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-signal" />
              <p className="text-xs font-mono text-ink-muted">Reading registered voice profiles from volume...</p>
            </div>
          ) : voices.length === 0 ? (
            <div className="p-10 border border-dashed border-line bg-paper-card/50 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-signal/10 text-signal flex items-center justify-center">
                <Volume2 size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-ink">No Voice Clones Registered</h3>
                <p className="text-xs text-ink-muted max-w-sm">
                  Upload a 15–60 second sample audio file along with its matching transcript to create your first zero-shot voice clone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-signal text-white hover:bg-signal-hover cursor-pointer"
              >
                <Plus size={13} />
                <span>Create Voice Clone</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {voices.map((voice) => {
                const isPlaying = playingVoice === voice.voice_name;
                const isSelected = selectedVoiceForGen === voice.voice_name;

                return (
                  <div
                    key={voice.voice_name}
                    className={`p-4 border transition-all bg-paper-card flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-signal shadow-sm ring-1 ring-signal/20"
                        : "border-line hover:border-line-dark"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-ink truncate">
                            {voice.voice_name}
                          </h3>
                          <span className="px-2 py-0.5 text-[9px] font-mono uppercase font-semibold bg-signal/10 text-signal border border-signal/20">
                            Qwen3 Base
                          </span>
                          {voice.created_at && (
                            <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
                              <Clock size={11} />
                              {new Date(voice.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {voice.ref_text && (
                          <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed italic bg-paper/60 p-2 border border-line/60 rounded-xs mt-1.5">
                            "{voice.ref_text}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {voice.has_reference_audio && (
                          <button
                            type="button"
                            onClick={() => toggleReferenceAudio(voice.voice_name)}
                            className={`p-1.5 rounded-sm border transition-colors cursor-pointer ${
                              isPlaying
                                ? "bg-signal text-white border-signal"
                                : "bg-paper border-line text-ink hover:text-signal"
                            }`}
                            title={isPlaying ? "Stop Reference Audio" : "Listen to Reference Audio"}
                          >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setVoiceToDelete(voice)}
                          className="p-1.5 rounded-sm border border-line bg-paper text-ink-muted hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
                          title="Delete Voice Clone"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-line/60 pt-2.5 text-xs">
                      <span className="text-[11px] font-mono text-ink-muted">
                        {voice.reference_audio_bytes
                          ? `${(voice.reference_audio_bytes / (1024 * 1024)).toFixed(1)} MB Reference WAV`
                          : "Reference Audio OK"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedVoiceForGen(voice.voice_name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 font-semibold text-[11px] transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-signal text-white"
                            : "bg-paper text-ink border border-line hover:border-signal hover:text-signal"
                        }`}
                      >
                        <Sparkles size={12} />
                        <span>{isSelected ? "Selected for Speech" : "Use in Generator"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Audio Generation Playground (5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="p-1 bg-signal/10 text-signal">
                <Sparkles size={15} />
              </span>
              <span>Synthesis Playground</span>
            </div>
            <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Zero-Shot Test
            </span>
          </div>

          <form onSubmit={handleGenerateAudio} className="p-5 border border-line bg-paper-card space-y-4">
            {/* Voice Selection */}
            <div>
              <label className="block text-xs font-mono font-semibold uppercase text-ink-muted mb-1.5">
                Active Voice Clone
              </label>
              {voices.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedVoiceForGen}
                    onChange={(e) => setSelectedVoiceForGen(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-line bg-paper text-ink focus:border-signal outline-none appearance-none cursor-pointer"
                  >
                    {voices.map((v) => (
                      <option key={v.voice_name} value={v.voice_name}>
                        {v.voice_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-ink-muted pointer-events-none" />
                </div>
              ) : (
                <div className="text-xs text-ink-muted p-2 border border-dashed border-line bg-paper">
                  No cloned voices available. Register a voice first.
                </div>
              )}
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-xs font-mono font-semibold uppercase text-ink-muted mb-1.5">
                Target Language
              </label>
              <div className="relative">
                <select
                  value={genLanguage}
                  onChange={(e) => setGenLanguage(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 border border-line bg-paper text-ink focus:border-signal outline-none appearance-none cursor-pointer"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-ink-muted pointer-events-none" />
              </div>
            </div>

            {/* Speech Text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono font-semibold uppercase text-ink-muted">
                  Text To Synthesize
                </label>
                <span className="text-[10px] font-mono text-ink-muted">
                  {genText.length} chars
                </span>
              </div>
              <textarea
                value={genText}
                onChange={(e) => setGenText(e.target.value)}
                rows={4}
                className="w-full text-xs p-3 border border-line bg-paper text-ink focus:border-signal outline-none font-sans leading-relaxed resize-y"
                placeholder="Enter text to speak with this cloned voice..."
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] font-mono text-ink-muted uppercase">Sample:</span>
                {SAMPLE_PRESETS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setGenText(sample.text)}
                    className="text-[10px] px-2 py-0.5 border border-line bg-paper text-ink-muted hover:text-signal hover:border-signal transition-colors cursor-pointer"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGenerating || !selectedVoiceForGen || !genText.trim()}
              className="w-full py-2.5 px-4 text-xs font-bold uppercase tracking-wider bg-signal text-white hover:bg-signal-hover transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Synthesizing Audio via GPU...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Generate Cloned Speech</span>
                </>
              )}
            </button>

            {/* Audio Output Player */}
            {generatedAudioUrl && (
              <div className="p-4 border border-signal/30 bg-signal/5 space-y-3 animate-fade-in mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-signal flex items-center gap-1.5">
                    <Check size={14} className="text-signal" />
                    Audio Ready ({selectedVoiceForGen})
                  </span>
                  <button
                    type="button"
                    onClick={downloadGeneratedAudio}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-signal text-white hover:bg-signal-hover transition-colors cursor-pointer"
                  >
                    <Download size={12} />
                    <span>Download WAV</span>
                  </button>
                </div>
                <audio
                  controls
                  src={generatedAudioUrl}
                  className="w-full h-9 focus:outline-none"
                  autoPlay
                />
              </div>
            )}
          </form>

          {/* Quick Guidance Box */}
          <div className="p-4 border border-line bg-paper-card text-xs text-ink-muted space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Info size={14} className="text-signal" />
              <span>Voice Cloning Directives</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-ink-muted leading-relaxed">
              <li>Upload 15 to 60 seconds of clean, uncompressed speech without background music.</li>
              <li>Provide an exact verbatim reference transcript for optimal voice feature extraction.</li>
              <li>Once created, clones reside in persistent Modal volume storage ready for instant use.</li>
            </ul>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW VOICE CLONE */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-paper border border-line w-full max-w-lg shadow-xl animate-modal-pop overflow-hidden">
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-signal/10 text-signal">
                  <Mic size={16} />
                </span>
                <h2 className="text-base font-semibold text-ink">Register New Voice Clone</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                  setAudioPreviewUrl(null);
                }}
                className="text-ink-muted hover:text-ink cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateVoice} className="p-6 space-y-5">
              {/* Voice Name */}
              <div>
                <label className="block text-xs font-mono font-semibold uppercase text-ink-muted mb-1.5">
                  Voice Name *
                </label>
                <input
                  type="text"
                  value={newVoiceName}
                  onChange={(e) => setNewVoiceName(e.target.value)}
                  placeholder="e.g. Liam Narrator, Elena Studio, Marcus"
                  className="w-full text-xs px-3 py-2 border border-line bg-paper-card text-ink focus:border-signal outline-none"
                  required
                />
              </div>

              {/* Reference Audio Upload */}
              <div>
                <label className="block text-xs font-mono font-semibold uppercase text-ink-muted mb-1.5">
                  Reference Audio (WAV or MP3, max 20MB) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg,audio/m4a,.wav,.mp3"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {audioFile ? (
                  <div className="p-3 border border-signal/40 bg-signal/5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileAudio size={20} className="text-signal shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink truncate">{audioFile.name}</p>
                        <p className="text-[10px] font-mono text-ink-muted">
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null);
                        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                        setAudioPreviewUrl(null);
                      }}
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-line hover:border-signal bg-paper-card transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer text-ink-muted hover:text-signal"
                  >
                    <UploadCloud size={24} />
                    <span className="text-xs font-semibold text-ink">Click or drag reference audio here</span>
                    <span className="text-[10px] text-ink-muted">Clear spoken English or native speech recommended</span>
                  </button>
                )}

                {audioPreviewUrl && (
                  <div className="mt-2">
                    <audio controls src={audioPreviewUrl} className="w-full h-8" />
                  </div>
                )}
              </div>

              {/* Reference Text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-semibold uppercase text-ink-muted">
                    Reference Transcript *
                  </label>
                  <span className="text-[10px] font-mono text-ink-muted">
                    Exact transcript of the audio
                  </span>
                </div>
                <textarea
                  value={newRefText}
                  onChange={(e) => setNewRefText(e.target.value)}
                  rows={4}
                  placeholder="Paste the exact spoken words from the reference audio clip..."
                  className="w-full text-xs p-3 border border-line bg-paper-card text-ink focus:border-signal outline-none font-sans leading-relaxed resize-y"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-line bg-paper-card text-ink hover:bg-ink/[0.04] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !audioFile || !newVoiceName.trim() || !newRefText.trim()}
                  className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-signal text-white hover:bg-signal-hover transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Save Voice Clone</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {voiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-paper border border-line w-full max-w-md shadow-xl animate-modal-pop p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2 bg-rose-50 border border-rose-200">
                <ShieldAlert size={20} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">Delete Voice Clone?</h3>
                <p className="text-xs text-ink-muted">This action will remove the voice from Modal storage.</p>
              </div>
            </div>

            <p className="text-xs text-ink leading-relaxed bg-paper-card p-3 border border-line">
              Are you sure you want to delete <strong className="font-semibold text-ink">"{voiceToDelete.voice_name}"</strong>? Any channels currently using this custom voice will need to be reconfigured.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVoiceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold border border-line bg-paper-card text-ink hover:bg-ink/[0.04] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVoice}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

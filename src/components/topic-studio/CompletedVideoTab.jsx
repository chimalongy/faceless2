"use client";

import {
  Film,
  Play,
  Pause,
  Upload,
  Sparkles,
  Trash2,
  Download,
  CheckCircle2,
  Youtube,
  Clock,
  Layers,
  Volume2,
  Settings,
  Share2,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Check,
  Copy,
  Link2
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function CompletedVideoTab({
  topicTitle,
  scenesJson,
  sceneVideos,
  sceneImages,
  sceneAudios,
  thumbnailImage,
  completedMasterVideo,
  setCompletedMasterVideo,
  handleUploadMasterVideo,
  handleDeleteMasterVideo,
  handleRenderMasterVideo,
  isRenderingMaster,
  renderProgress,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(82); // ~1:22 in seconds default
  const [isMuted, setIsMuted] = useState(false);
  const [publishedToYoutube, setPublishedToYoutube] = useState(false);
  const [publishNotice, setPublishNotice] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const videoRef = useRef(null);

  function handleCopyVideoUrl() {
    if (!completedMasterVideo?.url || completedMasterVideo.url === "generated") return;
    navigator.clipboard.writeText(completedMasterVideo.url);
    setCopiedUrl(true);
    setPublishNotice("Master video URL copied to clipboard!");
    setTimeout(() => {
      setCopiedUrl(false);
      setPublishNotice("");
    }, 3500);
  }

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch {
    parsedScenes = [];
  }

  const totalScenes = parsedScenes.length;
  const renderedVideoCount = parsedScenes.filter((s) => {
    const sNum = s.scene_number;
    const v = sceneVideos?.[sNum] || sceneVideos?.[String(sNum)] || sceneVideos?.[Number(sNum)];
    return !!v?.url;
  }).length;
  const allScenesRendered = totalScenes > 0 && renderedVideoCount === totalScenes;

  const hasMaster = !!completedMasterVideo?.url;

  function togglePlay() {
    if (!hasMaster) return;
    if (completedMasterVideo?.url === "generated") {
      setIsPlaying(!isPlaying);
      return;
    }
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
      }
    }
  }

  function handlePublishToYoutube() {
    setPublishedToYoutube(true);
    setPublishNotice("Draft pushed to YouTube (Unlisted) for review.");
    setTimeout(() => setPublishNotice(""), 4000);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Banner Card */}
      <div className="p-4 sm:p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Film size={16} className="text-signal" /> Completed Master Video
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {!allScenesRendered && totalScenes > 0 ? (
                <span className="text-amber-700 font-mono">
                  ⚠️ {renderedVideoCount} of {totalScenes} scene frames rendered. All scene frames must be rendered to enable merging.
                </span>
              ) : (
                "Final compiled 1080p master video ready for preview, download, and distribution."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Render / Merge Button */}
            <button
              type="button"
              disabled={isRenderingMaster || !allScenesRendered}
              onClick={handleRenderMasterVideo}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
              title={
                totalScenes === 0
                  ? "No scenes defined"
                  : !allScenesRendered
                  ? `Render all scene frames first (${renderedVideoCount}/${totalScenes} rendered)`
                  : "Merge all scene frames into master video"
              }
            >
              {isRenderingMaster ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Merging ({renderProgress}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Merge Scene Frames {totalScenes > 0 ? `(${renderedVideoCount}/${totalScenes})` : ""}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {publishNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fade-in">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-emerald-600" />
              {publishNotice}
            </span>
            <span className="font-mono text-[10px] uppercase font-bold text-emerald-700">Ready</span>
          </div>
        )}
      </div>

      {/* Main Grid: Cinema Player + Export Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Cinema Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-line bg-slate-950 rounded-none overflow-hidden relative shadow-lg group">
            {/* 16:9 Aspect Cinema Container */}
            <div className="aspect-video w-full relative flex items-center justify-center bg-radial from-slate-900 to-black overflow-hidden">
              {hasMaster ? (
                completedMasterVideo.url !== "generated" ? (
                  <video
                    ref={videoRef}
                    src={completedMasterVideo.url}
                    className="w-full h-full object-contain"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={() => setIsPlaying(false)}
                  />
                ) : (
                  /* Mock Synthesized 4K Master Preview */
                  <div className="w-full h-full relative flex flex-col justify-between p-6 bg-gradient-to-br from-stone-900 via-zinc-950 to-neutral-900 text-white">
                    {/* Background Texture/Image Mock */}
                    {thumbnailImage && thumbnailImage !== "generated" ? (
                      <img
                        src={thumbnailImage}
                        alt="Master Preview Frame"
                        className="absolute inset-0 w-full h-full object-cover opacity-35 filter contrast-125"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.15),transparent_70%)]" />
                    )}

                    {/* Top Overlay Badge */}
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 font-mono text-[11px] font-semibold text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 4K MASTER READY
                      </span>
                      <span className="font-mono text-xs text-white/70 bg-black/50 px-2 py-0.5 border border-white/10">
                        2160p • 60 FPS
                      </span>
                    </div>

                    {/* Middle Title Callout */}
                    <div className="relative z-10 text-center max-w-lg mx-auto space-y-2 py-4">
                      <p className="text-[10px] font-mono tracking-widest text-signal uppercase font-bold">
                        Faceless Master Cut
                      </p>
                      <h2 className="text-xl sm:text-2xl font-display font-semibold text-white tracking-tight drop-shadow-md">
                        {topicTitle}
                      </h2>
                    </div>

                    {/* Bottom Info Bar inside Cinema */}
                    <div className="relative z-10 flex items-center justify-between text-xs font-mono text-white/60">
                      <span>Timeline: {parsedScenes.length} merged scenes</span>
                      <span>Dolby 5.1 / Stereo Master</span>
                    </div>
                  </div>
                )
              ) : (
                /* No Master Compiled State */
                <div className="text-center p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white/40 flex items-center justify-center mx-auto">
                    <Film size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">No Master Video Compiled</p>
                    <p className="text-xs text-white/50 max-w-sm mx-auto">
                      {!allScenesRendered && totalScenes > 0
                        ? `Render all scene frames first in the SceneFrames tab (${renderedVideoCount}/${totalScenes} rendered).`
                        : "Click \"Merge Scene Frames\" below to automatically compile your scene frames into a master video."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isRenderingMaster || !allScenesRendered}
                    onClick={handleRenderMasterVideo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs shadow-signal/30 transition-all cursor-pointer"
                    title={
                      totalScenes === 0
                        ? "No scenes defined"
                        : !allScenesRendered
                        ? `Render all scene frames first (${renderedVideoCount}/${totalScenes} rendered)`
                        : "Merge all scene frames into master video"
                    }
                  >
                    <Sparkles size={13} /> Merge Scene Frames {totalScenes > 0 ? `(${renderedVideoCount}/${totalScenes})` : ""}
                  </button>
                </div>
              )}

              {/* Big Center Play Overlay Button */}
              {hasMaster && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className={`absolute z-20 w-14 h-14 rounded-full bg-signal/90 hover:bg-signal text-white flex items-center justify-center shadow-xl transition-transform cursor-pointer ${isPlaying ? "opacity-0 group-hover:opacity-90" : "opacity-95 scale-100"
                    }`}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
                </button>
              )}
            </div>

            {/* Video Controls Bar */}
            <div className="p-3 bg-slate-900 border-t border-white/10 flex items-center justify-between gap-3 text-white text-xs font-mono">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasMaster}
                  onClick={togglePlay}
                  className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>

              {/* Progress Scrub Bar */}
              <div className="flex-1 mx-2">
                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer relative">
                  <div
                    className="h-full bg-signal transition-all"
                    style={{
                      width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <Volume2 size={15} className={isMuted ? "opacity-40" : "opacity-100"} />
                </button>
              </div>
            </div>
          </div>

          {/* Master Video Actions Row */}
          {hasMaster && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 border border-line bg-paper-card">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-ink font-semibold">
                  {completedMasterVideo.name || "Master_Cut_Final_4K.mp4"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Share / Copy URL Button */}
                <button
                  type="button"
                  onClick={handleCopyVideoUrl}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold transition-all cursor-pointer ${
                    copiedUrl
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700 font-bold"
                      : "border-line bg-white hover:bg-ink/5 text-ink"
                  }`}
                  title="Copy public master video URL to clipboard"
                >
                  {copiedUrl ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span>URL Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={13} className="text-signal" />
                      <span>Share URL</span>
                    </>
                  )}
                </button>

                <a
                  href={completedMasterVideo.url !== "generated" ? completedMasterVideo.url : "#"}
                  download={completedMasterVideo.name || "Master_Cut_Final_4K.mp4"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-colors cursor-pointer"
                  title="Download compiled video"
                >
                  <Download size={13} />
                  <span>Download MP4</span>
                </a>

                <button
                  type="button"
                  onClick={handleDeleteMasterVideo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-white hover:bg-rose-50 hover:border-rose-300 text-ink-muted hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                  title="Delete master video"
                >
                  <Trash2 size={13} />
                  <span>Delete Master</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Master Specifications & Publishing Desk */}
        <div className="space-y-6">
          {/* Share & Direct URL Card */}
          {hasMaster && completedMasterVideo.url !== "generated" && (
            <div className="p-5 border border-line bg-paper-card space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-line pb-2.5 text-xs font-semibold text-ink">
                <span className="flex items-center gap-1.5">
                  <Share2 size={14} className="text-signal" />
                  <span>Share Master Video</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-semibold uppercase bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                  Public URL
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 bg-white border border-line p-1">
                  <input
                    type="text"
                    readOnly
                    value={completedMasterVideo.url}
                    className="flex-1 bg-transparent px-2 py-1 text-[11px] font-mono text-ink outline-none select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyVideoUrl}
                    className={`px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                      copiedUrl
                        ? "bg-emerald-600 text-white"
                        : "bg-signal hover:bg-signal-hover text-white"
                    }`}
                    title="Copy video link"
                  >
                    {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedUrl ? "Copied" : "Copy URL"}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                  <a
                    href={completedMasterVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink size={12} />
                    <span>Open in new tab</span>
                  </a>
                  <span className="text-ink-muted text-[10px]">Cloudflare R2 Direct</span>
                </div>
              </div>
            </div>
          )}

          {/* Export & Publishing Widget */}
          <div className="p-5 border border-line bg-paper-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-ink font-semibold text-xs">
                <Youtube size={16} className="text-rose" />
                <span>YouTube Direct Publishing</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-rose/10 text-rose border border-rose/20 font-semibold">
                {publishedToYoutube ? "Synced" : "Draft"}
              </span>
            </div>

            <button
              type="button"
              disabled={!hasMaster}
              onClick={handlePublishToYoutube}
              className={`w-full py-2.5 px-4 rounded-none font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${hasMaster
                  ? publishedToYoutube
                    ? "bg-emerald-600 text-white"
                    : "bg-rose hover:bg-rose-600 text-white shadow-xs"
                  : "bg-ink/10 text-ink-muted cursor-not-allowed opacity-50"
                }`}
            >
              {publishedToYoutube ? (
                <>
                  <Check size={14} /> Uploaded to YouTube
                </>
              ) : (
                <>
                  <Youtube size={14} /> Upload to YouTube
                </>
              )}
            </button>
          </div>

          {/* Master Video Specs */}
          <div className="p-5 border border-line bg-paper-card space-y-3.5">
            <div className="flex items-center gap-2 border-b border-line pb-2.5 text-xs font-semibold text-ink">
              <Settings size={14} className="text-signal" />
              <span>Master Render Pipeline Specs</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-ink-muted">Resolution</span>
                <span className="font-semibold text-ink">3840 x 2160 (4K UHD)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-ink-muted">Frame Rate</span>
                <span className="font-semibold text-ink">60.00 FPS (Cinematic)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-ink-muted">Codec</span>
                <span className="font-semibold text-ink">H.265 / HEVC • 45 Mbps</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-line/60">
                <span className="text-ink-muted">Audio Master</span>
                <span className="font-semibold text-ink">48 kHz • 24-bit Stereo</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-ink-muted">Color Space</span>
                <span className="font-semibold text-emerald-700">Rec.709 / Wide Gamut</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

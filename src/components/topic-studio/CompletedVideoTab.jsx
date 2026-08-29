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
  Link2,
  AlertCircle,
  AlertTriangle,
  X,
  Send,
  Key,
  Info,
  Calendar,
  FileText,
  Save,
  RotateCcw
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

export default function CompletedVideoTab({
  topicTitle,
  topicSlug,
  channelSlug,
  channelName,
  postershiveApi,
  scriptContent,
  storyDescription,
  setStoryDescription,
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
  youtubeVideoId: initialYoutubeVideoId,
  youtubeUrl: initialYoutubeUrl,
  youtubePublishedAt: initialYoutubePublishedAt,
  onYoutubePublished,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(82); // ~1:22 in seconds default
  const [isMuted, setIsMuted] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedYoutubeUrl, setCopiedYoutubeUrl] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [publishNotice, setPublishNotice] = useState("");
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef(null);

  // Story Description editor states
  const [descText, setDescText] = useState(storyDescription || "");
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const [isGeneratingStoryDescription, setIsGeneratingStoryDescription] = useState(false);

  // YouTube publishing states
  const [youtubeVideoId, setYoutubeVideoId] = useState(initialYoutubeVideoId || null);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl || null);
  const [youtubePublishedAt, setYoutubePublishedAt] = useState(initialYoutubePublishedAt || null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");

  // YouTube modal form states
  const [customTitle, setCustomTitle] = useState(topicTitle || "");
  const [customDescription, setCustomDescription] = useState(storyDescription || "");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialYoutubeVideoId) setYoutubeVideoId(initialYoutubeVideoId);
    if (initialYoutubeUrl) setYoutubeUrl(initialYoutubeUrl);
    if (initialYoutubePublishedAt) setYoutubePublishedAt(initialYoutubePublishedAt);
  }, [initialYoutubeVideoId, initialYoutubeUrl, initialYoutubePublishedAt]);

  useEffect(() => {
    if (topicTitle && !customTitle) {
      setCustomTitle(topicTitle);
    }
  }, [topicTitle]);

  useEffect(() => {
    if (storyDescription !== undefined) {
      setDescText(storyDescription || "");
      setCustomDescription(storyDescription || "");
    }
  }, [storyDescription]);

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

  function handleCopyYoutubeLink() {
    if (!youtubeUrl) return;
    navigator.clipboard.writeText(youtubeUrl);
    setCopiedYoutubeUrl(true);
    toast.success("YouTube URL copied to clipboard!");
    setTimeout(() => {
      setCopiedYoutubeUrl(false);
    }, 3000);
  }

  function handleCopyStoryDescription() {
    if (!descText.trim()) return;
    navigator.clipboard.writeText(descText);
    setCopiedDesc(true);
    toast.success("Story description copied to clipboard!");
    setTimeout(() => {
      setCopiedDesc(false);
    }, 3000);
  }

  async function handleSaveStoryDescription() {
    setIsSavingDesc(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyDescription: descText }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save story description");
      }

      if (setStoryDescription) {
        setStoryDescription(descText);
      }
      setCustomDescription(descText);
      toast.success("Story description saved successfully!");
    } catch (err) {
      console.error("Save story description error:", err);
      toast.error(err.message || "Failed to save story description.");
    } finally {
      setIsSavingDesc(false);
    }
  }

  async function handleGenerateStoryDescription() {
    setIsGeneratingStoryDescription(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-story-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate story description");
      }

      const generated = data.storyDescription || "";
      setDescText(generated);
      setCustomDescription(generated);
      if (setStoryDescription) {
        setStoryDescription(generated);
      }
      toast.success("Story description generated with AI!");
    } catch (err) {
      console.error("Generate story description error:", err);
      toast.error(err.message || "Failed to generate story description.");
    } finally {
      setIsGeneratingStoryDescription(false);
    }
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

  const hasMaster = !!completedMasterVideo?.url && completedMasterVideo.url !== "generated";
  const hasThumbnail = !!thumbnailImage && thumbnailImage !== "generated";
  const hasPostershiveKey = !!postershiveApi && postershiveApi.trim().length > 0;

  function togglePlay() {
    if (!hasMaster) return;
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
      }
    }
  }

  function openPublishModal() {
    setPublishError("");
    setPublishSuccess("");
    if (!customTitle) setCustomTitle(topicTitle || "");
    const effectiveDesc = descText || storyDescription || "";
    setCustomDescription(effectiveDesc);
    setPublishModalOpen(true);
  }

  async function handleExecutePublish(e) {
    if (e) e.preventDefault();
    setPublishError("");
    setPublishSuccess("");

    if (!hasPostershiveKey) {
      setPublishError("PostersHive API Key is missing. Please configure it in your Channel Profile settings.");
      return;
    }

    if (!hasMaster) {
      setPublishError("No compiled master video found. Please render or upload a master video first.");
      return;
    }

    if (!hasThumbnail) {
      setPublishError("A custom thumbnail is required for YouTube upload. Please generate or upload a thumbnail in the Thumbnail tab.");
      return;
    }

    setIsPublishing(true);

    try {
      const endpoint = `/api/channels/${channelSlug}/topics/${topicSlug}/publish-youtube`;
      const payload = {
        title: customTitle.trim() || topicTitle,
        description: customDescription.trim() || descText || storyDescription || scriptContent || topicTitle,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error || data.success === false) {
        const msg = data.error || data.message || "Failed to publish video to YouTube via PostersHive.";
        setPublishError(msg);
        toast.error(msg);
        return;
      }

      // Success
      const returnedVideoId = data.postId;
      const returnedYoutubeUrl = data.youtubeUrl || `https://www.youtube.com/watch?v=${returnedVideoId}`;
      const publishedDate = new Date().toISOString();

      setYoutubeVideoId(returnedVideoId);
      setYoutubeUrl(returnedYoutubeUrl);
      setYoutubePublishedAt(publishedDate);
      setPublishSuccess("Successfully uploaded & published master video to YouTube!");
      toast.success("Successfully published to YouTube!");

      if (onYoutubePublished) {
        onYoutubePublished({
          youtubeVideoId: returnedVideoId,
          youtubeUrl: returnedYoutubeUrl,
          youtubePublishedAt: publishedDate,
        });
      }

      setTimeout(() => {
        setPublishModalOpen(false);
      }, 2000);
    } catch (err) {
      console.error("YouTube publish error:", err);
      const msg = err.message || "An unexpected network error occurred while publishing to YouTube.";
      setPublishError(msg);
      toast.error(msg);
    } finally {
      setIsPublishing(false);
    }
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
        {/* Left Column (2 Cols): Cinema Video Player + Story Description Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cinema Player Card */}
          <div className="border border-line bg-slate-950 rounded-none overflow-hidden relative shadow-lg group">
            {/* 16:9 Aspect Cinema Container */}
            <div className="aspect-video w-full relative flex items-center justify-center bg-radial from-slate-900 to-black overflow-hidden">
              {hasMaster ? (
                <video
                  ref={videoRef}
                  src={completedMasterVideo.url}
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onEnded={() => setIsPlaying(false)}
                />
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
                        : 'Click "Merge Scene Frames" above to automatically compile your scene frames into a master video.'}
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
                  className={`absolute z-20 w-14 h-14 rounded-full bg-signal/90 hover:bg-signal text-white flex items-center justify-center shadow-xl transition-transform cursor-pointer ${
                    isPlaying ? "opacity-0 group-hover:opacity-90" : "opacity-95 scale-100"
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
                  {completedMasterVideo.name || `${topicSlug}-master.mp4`}
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
                  href={completedMasterVideo.url}
                  download={completedMasterVideo.name || `${topicSlug}-master.mp4`}
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

          {/* Story Description Section (Moved Below the Master Video Actions Row) */}
          <div className="p-5 sm:p-6 border border-line bg-paper-card space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-signal/10 text-signal">
                  <FileText size={16} />
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-ink flex items-center gap-2">
                    <span>Story & Video Description</span>
                    {descText && (
                      <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200 uppercase">
                        AI Generated
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    SEO-aware YouTube video description synthesized from the script.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Generate / Regenerate Button */}
                <button
                  type="button"
                  disabled={isGeneratingStoryDescription || isSavingDesc}
                  onClick={handleGenerateStoryDescription}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-signal hover:bg-signal-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                  title="Generate high-converting YouTube story description from script with Trigger.dev AI task"
                >
                  {isGeneratingStoryDescription ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Generating Description...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>{descText ? "Regenerate Description" : "Generate Description"}</span>
                    </>
                  )}
                </button>

                {/* Copy Button */}
                {descText && (
                  <button
                    type="button"
                    onClick={handleCopyStoryDescription}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 border text-xs font-semibold transition-all cursor-pointer ${
                      copiedDesc
                        ? "bg-emerald-50 border-emerald-400 text-emerald-700 font-bold"
                        : "border-line bg-white hover:bg-ink/5 text-ink"
                    }`}
                    title="Copy story description to clipboard"
                  >
                    {copiedDesc ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copiedDesc ? "Copied!" : "Copy"}</span>
                  </button>
                )}

                {/* Save Button */}
                {descText && (
                  <button
                    type="button"
                    disabled={isSavingDesc || isGeneratingStoryDescription}
                    onClick={handleSaveStoryDescription}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-ink text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    title="Save story description changes to database"
                  >
                    {isSavingDesc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>{isSavingDesc ? "Saving..." : "Save"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Description Textarea / Empty State */}
            <div className="space-y-2">
              <textarea
                rows={9}
                value={descText}
                onChange={(e) => setDescText(e.target.value)}
                placeholder="Click 'Generate Description' above to automatically craft an SEO-optimized YouTube video description with hooks, chapter breakdown, insights, discussion prompts, and hashtags from the video script..."
                className="w-full p-3.5 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal font-sans resize-y"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted pt-0.5">
                <span>
                  {descText ? `${descText.length} characters • ~${descText.trim().split(/\s+/).filter(Boolean).length} words` : "No description generated yet"}
                </span>
                <span>Auto-synced with YouTube publishing desk</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Master Specifications & Publishing Desk */}
        <div className="space-y-6">
          {/* Share & Direct URL Card */}
          {hasMaster && (
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

          {/* YouTube Direct Publishing Widget */}
          <div className="p-5 border border-line bg-paper-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-ink font-semibold text-xs">
                <Youtube size={16} className="text-rose-600" />
                <span>YouTube Direct Publishing</span>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-mono uppercase font-semibold border ${
                  youtubeVideoId
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-rose-50 text-rose-600 border-rose-200"
                }`}
              >
                {youtubeVideoId ? "Published" : "Draft"}
              </span>
            </div>

            {/* PostHive API Key Status Indicator */}
            <div className="p-3 bg-white border border-line text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted flex items-center gap-1 font-mono text-[11px]">
                  <Key size={12} className="text-signal" />
                  <span>PostersHive Integration:</span>
                </span>
                {hasPostershiveKey ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                    <CheckCircle2 size={11} className="text-emerald-600" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 border border-amber-200">
                    <AlertTriangle size={11} className="text-amber-600" /> Missing Key
                  </span>
                )}
              </div>

              {!hasPostershiveKey && (
                <div className="pt-1">
                  <p className="text-[11px] text-amber-800 leading-tight">
                    API key not found for channel.{" "}
                    <Link
                      href={`/dashboard/channels/${channelSlug}/edit`}
                      className="text-signal hover:underline font-semibold"
                    >
                      Configure PostersHive API Key &rarr;
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* Live Published Status View */}
            {youtubeVideoId && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 space-y-2.5 text-xs animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Live on YouTube</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                    ID: {youtubeVideoId}
                  </span>
                </div>

                {youtubePublishedAt && (
                  <p className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                    <Calendar size={11} />
                    <span>Published: {new Date(youtubePublishedAt).toLocaleDateString()}</span>
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={youtubeUrl || `https://www.youtube.com/watch?v=${youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Youtube size={14} />
                    <span>Watch on YouTube</span>
                    <ExternalLink size={12} className="ml-0.5 opacity-80" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyYoutubeLink}
                    className="p-2 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer"
                    title="Copy YouTube URL"
                  >
                    {copiedYoutubeUrl ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              disabled={!hasMaster || isPublishing}
              onClick={openPublishModal}
              className={`w-full py-2.5 px-4 rounded-none font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                hasMaster
                  ? youtubeVideoId
                    ? "bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 shadow-xs"
                    : "bg-red-600 hover:bg-red-700 text-white shadow-xs"
                  : "bg-ink/10 text-ink-muted cursor-not-allowed opacity-50"
              }`}
            >
              {isPublishing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Uploading to YouTube via PostHive...</span>
                </>
              ) : youtubeVideoId ? (
                <>
                  <Youtube size={14} className="text-red-500" />
                  <span>Re-upload / Update on YouTube</span>
                </>
              ) : (
                <>
                  <Youtube size={14} />
                  <span>Upload to YouTube</span>
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

      {/* YouTube Publish Confirmation Modal */}
      {mounted && publishModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPublishing) {
              setPublishModalOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-xl bg-paper border border-line p-6 sm:p-7 shadow-2xl space-y-5 animate-scale-in text-ink my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-600 rounded">
                  <Youtube size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-display font-semibold text-ink">
                    Publish Master Video to YouTube
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Automated direct upload via PostersHive API pipeline
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setPublishModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecutePublish} className="space-y-4 flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
              {/* Media Checks Strip */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-paper-card border border-line text-xs font-mono">
                <div className="space-y-1">
                  <span className="text-ink-muted block text-[10px] uppercase">Master Video</span>
                  {hasMaster ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check size={12} /> 1080p / 4K MP4 Ready
                    </span>
                  ) : (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <X size={12} /> Missing Video
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-ink-muted block text-[10px] uppercase">Custom Thumbnail</span>
                  {hasThumbnail ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check size={12} /> Custom Cover Ready
                    </span>
                  ) : (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <X size={12} /> Missing Thumbnail
                    </span>
                  )}
                </div>
              </div>

              {/* YouTube Title */}
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1" htmlFor="yt-post-title">
                  YouTube Video Title *
                </label>
                <input
                  id="yt-post-title"
                  type="text"
                  required
                  maxLength={100}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter compelling YouTube title (max 100 chars)"
                  className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] font-mono text-ink-muted">
                    {customTitle.length}/100 characters
                  </span>
                </div>
              </div>

              {/* YouTube Description (Synced with Story Description) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-ink/80" htmlFor="yt-post-description">
                    YouTube Video Description
                  </label>
                  <span className="text-[10px] font-mono text-ink-muted">
                    {customDescription.length} chars
                  </span>
                </div>
                <textarea
                  id="yt-post-description"
                  rows={6}
                  value={customDescription}
                  onChange={(e) => {
                    setCustomDescription(e.target.value);
                    setDescText(e.target.value);
                  }}
                  placeholder="Video description to be published with YouTube video..."
                  className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal font-sans"
                />
              </div>

              {/* PostersHive Key warning if missing */}
              {!hasPostershiveKey && (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">PostersHive API Key is missing</span>
                    <p className="text-[11px] mt-0.5 text-amber-800">
                      You must add your PostersHive API Key to this channel before publishing.{" "}
                      <Link
                        href={`/dashboard/channels/${channelSlug}/edit`}
                        target="_blank"
                        className="font-semibold underline text-signal"
                      >
                        Edit Channel Profile &rarr;
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Status alerts */}
              {publishError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{publishError}</span>
                </div>
              )}

              {publishSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  <span className="font-semibold">{publishSuccess}</span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-line mt-auto">
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => setPublishModalOpen(false)}
                  className="px-4 py-2 border border-line bg-paper-card text-xs font-semibold text-ink hover:bg-ink/5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isPublishing || !hasMaster || !hasPostershiveKey || !customTitle.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs shadow-red-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Uploading to YouTube...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Dispatch to YouTube</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

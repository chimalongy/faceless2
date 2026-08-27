"use client";

import {
  Layers,
  Upload,
  Sparkles,
  Trash2,
  Video,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  Download,
  CheckCircle2,
  Clapperboard,
  Compass
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SceneFramesTab({
  scenesJson,
  sceneVideos = {},
  sceneImages = {},
  sceneAudios = {},
  isGeneratingAllVideos = false,
  generatingSceneVideos = {},
  handleUploadSceneVideo,
  handleDeleteSceneVideo,
  handleGenerateSceneVideo,
  handleGenerateAllVideos,
}) {
  const [downloadingVideos, setDownloadingVideos] = useState({});

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  async function handleDownloadVideo(sceneNum, url, videoName) {
    if (!url) return;
    setDownloadingVideos((prev) => ({ ...prev, [sceneNum]: true }));
    const filename = videoName || `scene-${sceneNum}-frame.mp4`;
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
      console.warn("Falling back to direct link:", err);
      const link = document.createElement("a");
      link.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingVideos((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  const eligibleScenesCount = parsedScenes.filter((s) => {
    const sNum = s.scene_number;
    const img = sceneImages[sNum] || sceneImages[String(sNum)] || sceneImages[Number(sNum)];
    const aud = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
    const vid = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
    return !!img?.url && !!aud?.url && !vid?.url;
  }).length;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header Card */}
      <div className="p-4 sm:p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Layers size={16} className="text-signal" /> SceneFrames Video Clips
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Shot-by-shot MP4 video reels rendered from scene images, voice narration, and smooth Ken Burns camera motion.
            </p>
          </div>

          <button
            type="button"
            disabled={isGeneratingAllVideos || parsedScenes.length === 0 || eligibleScenesCount === 0}
            onClick={handleGenerateAllVideos}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title={
              eligibleScenesCount > 0
                ? `Render remaining ${eligibleScenesCount} scene(s) with image and audio`
                : "No unrendered scenes with both image and audio ready"
            }
          >
            {isGeneratingAllVideos ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Rendering Remaining Videos...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate All Videos {eligibleScenesCount > 0 ? `(${eligibleScenesCount})` : ""}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3-Column Desktop Grid for Scene Videos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
            Scene Video Reels ({parsedScenes.length} Scenes)
          </h4>
        </div>

        {parsedScenes.length === 0 ? (
          <div className="p-8 border border-line bg-paper-card text-center space-y-2 text-ink-muted">
            <AlertCircle size={32} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes defined</p>
            <p className="text-xs text-ink-muted">
              Add scenes in the "Scenes (JSON)" tab to start creating scene videos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {parsedScenes.map((scene) => {
              const sceneNum = scene.scene_number;
              const videoData = sceneVideos[sceneNum] || sceneVideos[String(sceneNum)] || sceneVideos[Number(sceneNum)];
              const imgData = sceneImages[sceneNum] || sceneImages[String(sceneNum)] || sceneImages[Number(sceneNum)];
              const audioData = sceneAudios[sceneNum] || sceneAudios[String(sceneNum)] || sceneAudios[Number(sceneNum)];
              
              const hasVideo = !!videoData?.url;
              const hasImage = !!imgData?.url;
              const hasAudio = !!audioData?.url;

              const isGeneratingThis = !!generatingSceneVideos[sceneNum] || isGeneratingAllVideos;
              const isDownloading = !!downloadingVideos[sceneNum];

              const kb = scene.ken_burns || { direction: "zoom-in", intensity: 0.12 };

              return (
                <div
                  key={sceneNum}
                  className="border border-line bg-paper-card flex flex-col justify-between hover:border-signal/40 transition-all overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-3 border-b border-line/60 bg-paper-dark/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 bg-ink text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {sceneNum}
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink truncate">
                        SCENE 0{sceneNum}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Ken Burns Motion Badge */}
                      <span className="px-2 py-0.5 text-[9px] font-mono text-signal bg-signal/10 border border-signal/20 flex items-center gap-1" title="Ken Burns Camera Motion">
                        <Compass size={10} />
                        <span className="capitalize">{kb.direction || "zoom-in"}</span>
                      </span>

                      {/* Delete Button */}
                      {hasVideo && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSceneVideo(sceneNum)}
                          className="p-1 rounded-sm text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete video clip for this scene"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 16:9 Video Player Box */}
                  <div className="relative aspect-video w-full bg-ink text-white overflow-hidden flex items-center justify-center">
                    {generatingSceneVideos[sceneNum] || (isGeneratingAllVideos && !hasVideo) ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-slate-900 text-center p-3 space-y-1.5">
                        <div className="space-y-1.5">
                          <Loader2 size={26} className="animate-spin text-signal mx-auto" />
                          <p className="text-[11px] font-mono text-white/90 font-semibold">
                            Rendering Scene 0{sceneNum} MP4...
                          </p>
                          <p className="text-[10px] font-mono text-ink-muted">
                            Applying Ken Burns & Audio Muxing
                          </p>
                        </div>
                      </div>
                    ) : hasVideo ? (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={videoData.url}
                        className="w-full h-full object-cover"
                      />
                    ) : hasImage ? (
                      <div className="relative w-full h-full">
                        <img
                          src={imgData.url}
                          alt={`Scene ${sceneNum}`}
                          className="w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-3">
                          <Clapperboard size={22} className="text-white/80 mb-1" />
                          <p className="text-[11px] font-mono text-white/90 font-medium">
                            {hasImage && hasAudio ? "Ready to Render" : "Missing Audio"}
                          </p>
                          <p className="text-[9px] font-mono text-white/60">
                            {hasAudio ? "Image & Voice Ready" : "Voice Audio Required to Render"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-1.5 p-4 text-white/50">
                        <Video size={24} className="mx-auto opacity-40 text-white" />
                        <p className="text-[11px] font-mono text-white/70">No video or image</p>
                        <p className="text-[9px] text-white/40">Upload an image and audio first</p>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="p-2.5 bg-paper-card border-t border-line/60 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* Upload / Replace Video File */}
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-[10px] font-semibold text-ink transition-all cursor-pointer">
                        <Upload size={11} />
                        <span>{hasVideo ? "Replace" : "Upload"}</span>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && handleUploadSceneVideo) {
                              handleUploadSceneVideo(sceneNum, file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      {/* Download Scene Video Button */}
                      {hasVideo && (
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => handleDownloadVideo(sceneNum, videoData.url, videoData.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-ink text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                          title="Download scene video"
                        >
                          {isDownloading ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Download size={11} />
                          )}
                          <span>Download</span>
                        </button>
                      )}
                    </div>

                    {/* Generate Button for Individual Scene Video */}
                    <button
                      type="button"
                      disabled={isGeneratingThis || !hasImage || !hasAudio}
                      onClick={() => handleGenerateSceneVideo(sceneNum)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-sm border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        !hasImage && !hasAudio
                          ? "Generate or upload image and voice audio first"
                          : !hasImage
                          ? "Generate or upload an image first"
                          : !hasAudio
                          ? "Generate or upload voice audio first"
                          : hasVideo
                          ? "Regenerate MP4 for this scene"
                          : "Render MP4 for this scene"
                      }
                    >
                      {generatingSceneVideos[sceneNum] ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />
                          <span>Rendering...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={11} />
                          <span>{hasVideo ? "Regenerate" : "Generate"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

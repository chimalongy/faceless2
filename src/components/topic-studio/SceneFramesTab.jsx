"use client";

import {
  Layers,
  Upload,
  Sparkles,
  Trash2,
  Video,
  Play,
  Pause,
  AlertCircle
} from "lucide-react";
import { useState, useRef } from "react";

export default function SceneFramesTab({
  scenesJson,
  sceneVideos,
  sceneImages,
  sceneAudios,
  handleUploadSceneVideo,
  handleDeleteSceneVideo,
  handleGenerateSceneVideo,
  handleGenerateAllVideos,
}) {
  const [playingVideoScene, setPlayingVideoScene] = useState(null);
  const videoRefs = useRef({});

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  function togglePlayVideo(sceneNum, videoData) {
    if (playingVideoScene === sceneNum) {
      setPlayingVideoScene(null);
      if (videoRefs.current[sceneNum]) {
        videoRefs.current[sceneNum].pause();
      }
    } else {
      if (playingVideoScene && videoRefs.current[playingVideoScene]) {
        videoRefs.current[playingVideoScene].pause();
      }
      setPlayingVideoScene(sceneNum);
      if (videoData?.url && videoData.url !== "generated" && videoRefs.current[sceneNum]) {
        videoRefs.current[sceneNum].play().catch(() => {});
      }
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header Card */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Layers size={16} className="text-signal" /> SceneFrames Video Clips
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Merged shot-by-shot video compositions created from images and voice narration audio.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAllVideos}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Generate All Videos</span>
          </button>
        </div>
      </div>

      {/* Scene-by-Scene Videos */}
      <div className="space-y-6">
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
          parsedScenes.map((scene) => {
            const sceneNum = scene.scene_number;
            const videoData = sceneVideos[sceneNum];
            const hasVideo = !!videoData?.url;
            const isPlaying = playingVideoScene === sceneNum;

            return (
              <div
                key={sceneNum}
                className="p-5 border border-line bg-paper-card space-y-4 hover:border-signal/40 transition-all"
              >
                {/* Header with Scene Number & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 bg-ink text-white font-mono text-xs font-bold flex items-center justify-center">
                      {sceneNum}
                    </span>
                    <span className="font-mono text-xs font-semibold text-ink">
                      SCENE 0{sceneNum}
                    </span>
                  </div>

                  {/* Actions: Upload Video, Generate, Delete */}
                  <div className="flex items-center gap-2">
                    {/* Upload Video File */}
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer">
                      <Upload size={12} />
                      <span>{hasVideo ? "Replace Video" : "Upload Video"}</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadSceneVideo(sceneNum, file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>

                    {/* Generate Video Button */}
                    <button
                      type="button"
                      onClick={() => handleGenerateSceneVideo(sceneNum)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-xs font-semibold transition-all cursor-pointer"
                      title="Render video from image and audio"
                    >
                      <Sparkles size={12} />
                      <span>Generate</span>
                    </button>

                    {/* Delete Video Button */}
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSceneVideo(sceneNum)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-300 text-ink-muted hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                        title="Delete video for this scene"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 16:9 Video Canvas / Player */}
                <div className="relative aspect-video w-full border border-line bg-ink text-white overflow-hidden flex items-center justify-center group">
                  {videoData?.url && videoData.url !== "generated" ? (
                    <video
                      ref={(el) => {
                        if (el) videoRefs.current[sceneNum] = el;
                      }}
                      src={videoData.url}
                      controls
                      className="w-full h-full object-cover"
                      onEnded={() => setPlayingVideoScene(null)}
                    />
                  ) : videoData?.url === "generated" ? (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <div
                        className={`absolute inset-0 bg-linear-to-tr from-emerald-950 via-slate-900 to-indigo-950 transition-transform duration-1000 ${
                          isPlaying ? "scale-105" : "scale-100"
                        }`}
                      />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.25),transparent_70%)]" />

                      {/* Video Center Play/Pause Overlay */}
                      <button
                        type="button"
                        onClick={() => togglePlayVideo(sceneNum, videoData)}
                        className="relative z-10 w-14 h-14 rounded-full bg-signal/90 hover:bg-signal text-white flex items-center justify-center shadow-xl cursor-pointer hover:scale-105 transition-all"
                        title={isPlaying ? "Pause Scene Video" : "Play Scene Video"}
                      >
                        {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
                      </button>

                      {/* Video Overlay Info */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-white/80 bg-ink/60 backdrop-blur-xs px-3.5 py-2 border border-white/10">
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-emerald-400 animate-ping" : "bg-white/40"}`} />
                          <span>{isPlaying ? "PLAYING COMPOSITE VIDEO" : `SCENE 0${sceneNum} VIDEO`}</span>
                        </span>
                        <span>00:18 / 00:18</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 p-6 text-white/50">
                      <Video size={36} className="mx-auto opacity-40 text-white" />
                      <p className="text-xs font-mono text-white/70">No video clip yet</p>
                      <p className="text-[11px] text-white/40">Upload a video or click "Generate" to merge image & audio</p>
                    </div>
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

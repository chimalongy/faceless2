"use client";

import {
  Film,
  Upload,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";

export default function ImagesTab({
  scenesJson,
  sceneImages,
  handleUploadSceneImage,
  handleDeleteSceneImage,
  handleGenerateSceneImage,
  handleGenerateAllImages,
}) {
  const [expandedPrompts, setExpandedPrompts] = useState({});

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

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Header Card */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Film size={16} className="text-signal" /> Scene Visual Assets & Imagery
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Upload custom artwork or generate AI visuals for each individual scene.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAllImages}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Generate All</span>
          </button>
        </div>
      </div>

      {/* Scene-by-Scene Images List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
            Scene Visuals ({parsedScenes.length} Scenes)
          </h4>
        </div>

        {parsedScenes.length === 0 ? (
          <div className="p-8 border border-line bg-paper-card text-center space-y-2 text-ink-muted">
            <AlertCircle size={32} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes defined</p>
            <p className="text-xs text-ink-muted">
              Add scenes in the "Scenes (JSON)" tab to start managing visual assets.
            </p>
          </div>
        ) : (
          parsedScenes.map((scene) => {
            const sceneNum = scene.scene_number;
            const imgData = sceneImages[sceneNum];
            const hasImage = !!imgData?.url;

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

                  {/* Scene Actions: Upload Image, Generate, See Prompt, Delete */}
                  <div className="flex items-center gap-2">
                    {/* Upload Image File */}
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer">
                      <Upload size={12} />
                      <span>{hasImage ? "Replace Image" : "Upload Image"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadSceneImage(sceneNum, file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>

                    {/* Generate Button for Individual Scene */}
                    <button
                      type="button"
                      onClick={() => handleGenerateSceneImage(sceneNum)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-xs font-semibold transition-all cursor-pointer"
                      title="Generate image for this scene"
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

                    {/* Delete Scene Image */}
                    {hasImage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSceneImage(sceneNum)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-300 text-ink-muted hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                        title="Delete image for this scene"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Image Prompt Box (Hidden by default) */}
                {expandedPrompts[sceneNum] && (
                  <div className="space-y-1 animate-fade-in">
                    <span className="text-[11px] font-semibold text-ink-muted uppercase font-mono">
                      Image Prompt:
                    </span>
                    <p className="p-3 bg-paper-dark/60 border border-line font-mono text-xs text-ink leading-relaxed">
                      {scene.image_prompt || "No visual prompt provided for this scene."}
                    </p>
                  </div>
                )}

                {/* 16:9 Image Preview Box */}
                <div className="relative aspect-video w-full border border-line bg-ink text-white overflow-hidden flex items-center justify-center">
                  {imgData?.url === "generated" ? (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-linear-to-tr from-emerald-950 via-slate-900 to-indigo-950 opacity-95" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.3),transparent_60%)]" />
                      <div className="relative z-10 text-center space-y-2 p-6">
                        <span className="px-3 py-1 bg-signal text-white font-mono text-xs font-bold uppercase tracking-widest shadow-md inline-block">
                          16:9 SCENE 0{sceneNum}
                        </span>
                        <p className="text-xs font-mono text-white/90 max-w-lg mx-auto line-clamp-2">
                          {scene.image_prompt}
                        </p>
                        <p className="text-[10px] font-mono text-emerald-300/80">
                          AI Render • 1920 × 1080
                        </p>
                      </div>
                    </div>
                  ) : hasImage ? (
                    <img
                      src={imgData.url}
                      alt={`Scene ${sceneNum}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center space-y-2 p-6 text-white/50">
                      <ImageIcon size={32} className="mx-auto opacity-40 text-white" />
                      <p className="text-xs font-mono text-white/70">No image yet</p>
                      <p className="text-[11px] text-white/40">Upload an image or click "Generate"</p>
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

"use client";

import {
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Edit3,
  Copy,
  Check,
  Upload,
  Sparkles,
  Loader2,
  Info,
  Flame,
  Layers,
  Eye,
  Zap,
  Target
} from "lucide-react";

export default function ThumbnailTab({
  topicTitle,
  thumbnailPrompt,
  setThumbnailPrompt,
  thumbnailConcepts = [],
  selectedConceptId = 1,
  onSelectConcept,
  isEditingThumbPrompt,
  setIsEditingThumbPrompt,
  thumbPromptNotice,
  isGeneratingThumbPrompt,
  handleGenerateThumbPrompt,
  handleClearThumbPrompt,
  handleUpdateThumbPrompt,
  triggerThumbPromptNotice,
  thumbnailImage,
  isGeneratingThumbnail,
  isUploadingThumbnail,
  handleThumbnailUpload,
  handleClearThumbnail,
  handleGenerateThumbnail,
  isShort = false,
}) {
  const currentConcept = thumbnailConcepts.find((c) => c.id === selectedConceptId) || thumbnailConcepts[0] || null;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Informational Banner for Shorts */}
      {isShort && (
        <div className="flex items-center gap-2.5 p-3.5 bg-signal/5 border border-signal/20 text-xs text-ink">
          <Info size={16} className="text-signal shrink-0" />
          <span>
            <strong>Note for Shorts:</strong> Custom thumbnails are optional for YouTube Shorts. You can still generate or upload a vertical cover if desired.
          </span>
        </div>
      )}

      {/* 1. HIGH-CTR THUMBNAIL CONCEPTS STUDIO */}
      <div className="p-6 border border-line bg-paper-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm">
              <span className="p-1.5 bg-amber-500/10 text-amber-600 rounded-sm">
                <Flame size={16} />
              </span>
              <span>High-CTR Thumbnail Studio (3 Clickable Concepts)</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Every video generates 3 distinct psychological angles (Character Tension, Visual Metaphor, Split Dilemma) optimized for high mobile click-through rates.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {thumbPromptNotice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300">
                <CheckCircle2 size={12} /> {thumbPromptNotice}
              </span>
            )}

            <button
              type="button"
              onClick={handleGenerateThumbPrompt}
              disabled={isGeneratingThumbPrompt}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-50"
              title="Generate 3 High-CTR Thumbnail Concepts"
            >
              {isGeneratingThumbPrompt ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Engineering Concepts...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Generate 3 Concepts</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Concepts Selection Grid */}
        {thumbnailConcepts && thumbnailConcepts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {thumbnailConcepts.map((concept) => {
              const isSelected = selectedConceptId === concept.id;
              const angleIcon =
                concept.id === 1 ? <Eye size={13} /> : concept.id === 2 ? <Zap size={13} /> : <Target size={13} />;

              return (
                <div
                  key={concept.id}
                  onClick={() => onSelectConcept?.(concept)}
                  className={`p-3.5 border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? "border-signal bg-signal/[0.04] ring-2 ring-signal/20 shadow-xs"
                      : "border-line bg-paper/60 hover:border-signal/40 hover:bg-white"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                        {angleIcon}
                        <span>{concept.angle || `Concept ${concept.id}`}</span>
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-signal">
                          <Check size={12} /> Active
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-ink leading-snug">
                      {concept.title || `Concept #${concept.id}`}
                    </h4>

                    {concept.text_hook && (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-700">
                        Hook: &ldquo;{concept.text_hook}&rdquo;
                      </div>
                    )}

                    {concept.focal_hook && (
                      <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                        {concept.focal_hook}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 mt-2.5 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-ink-muted">
                      {isSelected ? "● Selected for Render" : "○ Click to select"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(concept.prompt);
                        triggerThumbPromptNotice?.(`Concept ${concept.id} prompt copied.`);
                      }}
                      className="p-1 hover:text-signal text-ink-muted cursor-pointer transition-all"
                      title="Copy this prompt"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 border border-dashed border-line bg-paper/40 text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-signal/10 text-signal flex items-center justify-center mx-auto">
              <Layers size={16} />
            </div>
            <p className="text-xs font-semibold text-ink">No thumbnail concepts generated yet</p>
            <p className="text-[11px] text-ink-muted max-w-md mx-auto">
              Click <strong>"Generate 3 Concepts"</strong> above to auto-engineer 3 high-CTR visual directions (Character Tension, Visual Metaphor, Split Dilemma) aligned with your channel branding.
            </p>
          </div>
        )}

        {/* Selected Concept Prompt Area */}
        <div className="space-y-2.5 pt-2 border-t border-line/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
                {currentConcept ? `Active Prompt (${currentConcept.angle}):` : "Active Thumbnail Generation Prompt:"}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 border ${
                  isEditingThumbPrompt
                    ? "bg-signal/10 text-signal border-signal/20 font-bold"
                    : "bg-ink/5 text-ink-muted border-line"
                }`}
              >
                {isEditingThumbPrompt ? "Editing" : "Diffusion Ready"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (isEditingThumbPrompt) {
                    handleUpdateThumbPrompt();
                  } else {
                    setIsEditingThumbPrompt(true);
                  }
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border text-[11px] font-semibold transition-all cursor-pointer ${
                  isEditingThumbPrompt
                    ? "bg-signal text-white border-signal"
                    : "border-line bg-paper hover:bg-ink/5 text-ink"
                }`}
                title={isEditingThumbPrompt ? "Save prompt" : "Edit prompt"}
              >
                {isEditingThumbPrompt ? <Check size={11} /> : <Edit3 size={11} />}
                <span>{isEditingThumbPrompt ? "Save" : "Edit"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (thumbnailPrompt) {
                    navigator.clipboard.writeText(thumbnailPrompt);
                  }
                  triggerThumbPromptNotice?.("Thumbnail prompt copied.");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-paper hover:bg-ink/5 text-[11px] font-semibold text-ink transition-all cursor-pointer"
                title="Copy prompt"
              >
                <Copy size={11} />
                <span>Copy</span>
              </button>

              <button
                type="button"
                onClick={handleClearThumbPrompt}
                className="p-1 hover:text-red-600 text-ink-muted cursor-pointer transition-all"
                title="Clear prompt"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {isEditingThumbPrompt ? (
            <textarea
              id="thumb-prompt"
              rows={4}
              value={thumbnailPrompt}
              onChange={(e) => setThumbnailPrompt(e.target.value)}
              placeholder="Enter thumbnail generation prompt..."
              className="w-full p-3.5 border border-line-dark bg-white font-mono text-xs text-ink leading-relaxed outline-none focus:border-signal"
            />
          ) : (
            <div className="p-3.5 border border-line bg-white/70 font-mono text-xs text-ink leading-relaxed rounded-xs">
              {thumbnailPrompt || (
                <span className="text-ink-muted italic">
                  No prompt text set. Generate concepts above or click "Edit" to type a custom prompt.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. RENDERED THUMBNAIL IMAGE (16:9) SECTION */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-signal" />
            <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
              Rendered Thumbnail Cover {isShort ? "(9:16)" : "(16:9)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload Custom Cover */}
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-line bg-paper hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer">
              <Upload size={13} />
              <span>{isUploadingThumbnail ? "Uploading..." : "Upload Cover"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailUpload}
                disabled={isUploadingThumbnail}
                className="hidden"
              />
            </label>

            {/* Clear Image */}
            {thumbnailImage && (
              <button
                type="button"
                onClick={handleClearThumbnail}
                className="p-1.5 border border-line bg-paper hover:text-red-600 text-ink-muted text-xs transition-all cursor-pointer"
                title="Remove thumbnail"
              >
                <Trash2 size={13} />
              </button>
            )}

            {/* Render with AI */}
            <button
              type="button"
              onClick={handleGenerateThumbnail}
              disabled={isGeneratingThumbnail || !thumbnailPrompt}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
              title="Render thumbnail image using active prompt"
            >
              {isGeneratingThumbnail ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Rendering...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Render Thumbnail</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thumbnail Preview Area */}
        <div className="flex justify-center p-4 bg-paper-dark/30 border border-line/60 rounded-xs">
          {thumbnailImage ? (
            <div className={`relative overflow-hidden border border-line shadow-md group ${isShort ? "w-64 aspect-[9/16]" : "w-full max-w-2xl aspect-video"}`}>
              <img
                src={thumbnailImage}
                alt={topicTitle || "Thumbnail cover"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <a
                  href={thumbnailImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-paper text-ink text-xs font-semibold shadow-md hover:bg-white"
                >
                  View Full Res
                </a>
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center border border-dashed border-line text-ink-muted space-y-2 ${isShort ? "w-64 aspect-[9/16]" : "w-full max-w-2xl aspect-video"}`}>
              <ImageIcon size={32} className="opacity-40" />
              <p className="text-xs font-medium">No thumbnail rendered yet</p>
              <p className="text-[11px] text-ink-muted text-center max-w-xs">
                Select a concept above and click "Render Thumbnail" to generate with Qwen / Nano Banana GPU.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

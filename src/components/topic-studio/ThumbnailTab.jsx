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
  Loader2
} from "lucide-react";

export default function ThumbnailTab({
  topicTitle,
  thumbnailPrompt,
  setThumbnailPrompt,
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
}) {
  return (
    <div className="space-y-6 animate-slide-in">
      {/* Thumbnail Prompt Section */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
              Thumbnail Prompt
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 border ${
                isEditingThumbPrompt
                  ? "bg-signal/10 text-signal border-signal/20 font-bold"
                  : "bg-ink/5 text-ink-muted border-line"
              }`}
            >
              {isEditingThumbPrompt ? "Editing" : "Read-Only"}
            </span>
          </div>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {thumbPromptNotice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300">
                <CheckCircle2 size={12} /> {thumbPromptNotice}
              </span>
            )}

            {/* Generate Prompt with AI */}
            <button
              type="button"
              onClick={handleGenerateThumbPrompt}
              disabled={isGeneratingThumbPrompt}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-50"
              title="Generate thumbnail prompt using channel thumbnail theme"
            >
              {isGeneratingThumbPrompt ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              <span>{isGeneratingThumbPrompt ? "Generating..." : "Generate Prompt"}</span>
            </button>

            {/* Clear Prompt Pill */}
            <button
              type="button"
              onClick={handleClearThumbPrompt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-paper-card hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-ink-muted transition-all cursor-pointer"
              title="Delete and clear thumbnail prompt"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>

            {/* Edit / Read Mode Pill */}
            <button
              type="button"
              onClick={() => {
                if (isEditingThumbPrompt) {
                  handleUpdateThumbPrompt();
                } else {
                  setIsEditingThumbPrompt(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                isEditingThumbPrompt
                  ? "bg-signal text-white border-signal shadow-xs shadow-signal/20"
                  : "border-line bg-paper-card hover:bg-ink/5 text-ink"
              }`}
              title={isEditingThumbPrompt ? "Save & update prompt" : "Edit prompt"}
            >
              {isEditingThumbPrompt ? <Check size={13} /> : <Edit3 size={13} />}
              <span>{isEditingThumbPrompt ? "Update" : "Edit"}</span>
            </button>

            {/* Copy Prompt Pill */}
            <button
              type="button"
              onClick={() => {
                if (thumbnailPrompt) {
                  navigator.clipboard.writeText(thumbnailPrompt);
                }
                triggerThumbPromptNotice?.("Thumbnail prompt copied.");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
              title="Copy prompt"
            >
              <Copy size={13} />
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* Prompt View / Edit Area */}
        {isEditingThumbPrompt ? (
          <textarea
            id="thumb-prompt"
            rows={4}
            value={thumbnailPrompt}
            onChange={(e) => setThumbnailPrompt(e.target.value)}
            placeholder="Enter thumbnail generation prompt..."
            className="w-full p-4 border border-line bg-white font-mono text-xs text-ink leading-relaxed outline-none focus:border-signal"
          />
        ) : (
          <div className="p-4 border border-line bg-white font-mono text-xs text-ink leading-relaxed">
            {thumbnailPrompt || (
              <span className="text-ink-muted italic">
                No prompt text set. Click "Edit Prompt" to enter one.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Image Section */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-signal" />
            <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
              16:9 Thumbnail Image
            </span>
          </div>

          {/* Actions: Upload Image, Clear Image, Generate with AI */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Image */}
            <label className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer ${
              isUploadingThumbnail ? "opacity-60 pointer-events-none" : ""
            }`}>
              {isUploadingThumbnail ? (
                <Loader2 size={13} className="animate-spin text-signal" />
              ) : (
                <Upload size={13} />
              )}
              <span>{isUploadingThumbnail ? "Uploading..." : "Upload Image"}</span>
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingThumbnail}
                onChange={handleThumbnailUpload}
                className="hidden"
              />
            </label>

            {/* Clear Image */}
            {thumbnailImage && (
              <button
                type="button"
                onClick={handleClearThumbnail}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-paper-card hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-ink-muted transition-all cursor-pointer"
                title="Clear thumbnail image"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}

            {/* Generate with AI */}
            <button
              type="button"
              onClick={handleGenerateThumbnail}
              disabled={isGeneratingThumbnail}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-50"
              title="Generate thumbnail with AI"
            >
              <Sparkles size={13} />
              <span>{isGeneratingThumbnail ? "Generating..." : "Generate with AI"}</span>
            </button>
          </div>
        </div>

        {/* Image Preview Canvas */}
        <div className="relative aspect-video w-full border border-line bg-ink text-white overflow-hidden flex items-center justify-center">
          {thumbnailImage === "generated" ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-tr from-emerald-950 via-slate-900 to-indigo-950 opacity-95" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.35),transparent_60%)]" />
              <div className="relative z-10 text-center space-y-2 p-6">
                <span className="px-3 py-1 bg-signal text-white font-mono text-xs font-bold uppercase tracking-widest shadow-md inline-block">
                  16:9 MASTER THUMBNAIL
                </span>
                <p className="text-sm font-display text-white/90 font-bold max-w-md mx-auto">
                  {topicTitle}
                </p>
                <p className="text-[11px] font-mono text-emerald-300/80">
                  Generated from prompt • 1920 × 1080
                </p>
              </div>
            </div>
          ) : thumbnailImage ? (
            <img
              src={thumbnailImage}
              alt="Thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center space-y-2 p-8 text-ink-muted">
              <ImageIcon size={36} className="mx-auto opacity-40 text-white" />
              <p className="text-xs font-mono text-white/70">No thumbnail image yet</p>
              <p className="text-[11px] text-white/40">Upload an image from your computer or click "Generate with AI"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

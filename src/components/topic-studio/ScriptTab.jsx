"use client";

import {
  FileText,
  CheckCircle2,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Check,
  Sparkles
} from "lucide-react";

export default function ScriptTab({
  scriptContent,
  setScriptContent,
  isEditingScript,
  setIsEditingScript,
  scriptNotice,
  handleClearScript,
  handleUpdateScript,
  handleGenerateScript,
  triggerScriptNotice,
}) {
  return (
    <div className="space-y-6 animate-slide-in">
      {/* Script Action Pills Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pb-3 border-b border-line">
        {/* Action Pills for Script */}
        <div className="flex flex-wrap items-center gap-2">
          {scriptNotice && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300">
              <CheckCircle2 size={12} /> {scriptNotice}
            </span>
          )}

          {/* Clear / Delete Script Pill */}
          <button
            type="button"
            onClick={handleClearScript}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-paper-card hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-ink-muted transition-all cursor-pointer"
            title="Delete and clear script text"
          >
            <Trash2 size={13} />
            <span>Delete Script</span>
          </button>

          {/* Edit / Preview Toggle Pill */}
          <button
            type="button"
            onClick={() => setIsEditingScript(!isEditingScript)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
              isEditingScript
                ? "bg-ink/10 border-ink/20 text-ink"
                : "border-line bg-paper-card hover:bg-ink/5 text-ink-muted"
            }`}
            title="Toggle edit / read mode"
          >
            {isEditingScript ? <Eye size={13} /> : <Edit3 size={13} />}
            <span>{isEditingScript ? "Reader Mode" : "Edit Script"}</span>
          </button>

          {/* Copy Script Pill */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(scriptContent);
              triggerScriptNotice("Script copied to clipboard.");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
            title="Copy script text"
          >
            <Copy size={13} />
            <span>Copy</span>
          </button>

          {/* Update / Save Pill */}
          <button
            type="button"
            onClick={handleUpdateScript}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 text-xs font-semibold transition-all cursor-pointer"
            title="Save script changes"
          >
            <Check size={13} />
            <span>Update</span>
          </button>

          {/* Autogenerate Script Pill */}
          <button
            type="button"
            onClick={handleGenerateScript}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            title="AI autogenerate full teleprompter script"
          >
            <Sparkles size={13} />
            <span>Autogenerate Script</span>
          </button>
        </div>
      </div>

      {/* Editor & Reader Container */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-signal" />
            <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
              {isEditingScript ? "Script Editor" : "Script Teleprompter"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-ink-muted">
            <span>{scriptContent.split(/\s+/).filter(Boolean).length} words</span>
            <span>•</span>
            <span>
              ~{Math.max(1, Math.round(scriptContent.split(/\s+/).filter(Boolean).length / 130))} min read
            </span>
          </div>
        </div>

        {isEditingScript ? (
          <textarea
            rows={18}
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            placeholder="Write, paste, or autogenerate the full narration script..."
            className="w-full h-[520px] max-h-[700px] overflow-y-auto p-5 border border-line bg-white font-sans text-sm text-ink leading-relaxed outline-none focus:border-signal resize-y"
          />
        ) : (
          <div className="h-[520px] max-h-[700px] overflow-y-auto p-6 border border-line bg-white space-y-4 text-sm text-ink leading-relaxed whitespace-pre-line font-sans">
            {scriptContent || (
              <span className="text-ink-muted italic">
                No script content yet. Click "Autogenerate Script" or "Edit Script" to write one.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

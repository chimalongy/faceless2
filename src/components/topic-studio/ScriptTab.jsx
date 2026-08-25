"use client";

import {
  FileText,
  CheckCircle2,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Check,
  Sparkles,
  ClipboardPaste,
  Loader2,
  X,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

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
  isGeneratingScript = false,
  isUpdatingScript = false,
}) {
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedText(text);
        setPasteError("");
      }
    } catch {}
  }

  function handleApplyPastedScript(e) {
    if (e) e.preventDefault();
    setPasteError("");

    if (!pastedText.trim()) {
      setPasteError("Please paste your script text or JSON before applying.");
      return;
    }

    let raw = pastedText.trim();
    // Check if pasted content is a JSON object or array
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") {
          raw = parsed;
        } else if (parsed && typeof parsed === "object") {
          if (typeof parsed.script === "string") {
            raw = parsed.script;
          } else if (typeof parsed.narration === "string") {
            raw = parsed.narration;
          } else if (typeof parsed.audio_text === "string") {
            raw = parsed.audio_text;
          } else if (typeof parsed.content === "string") {
            raw = parsed.content;
          } else if (typeof parsed.text === "string") {
            raw = parsed.text;
          } else if (Array.isArray(parsed.scenes)) {
            raw = parsed.scenes.map((s, i) => `[Scene ${s.scene_number || i + 1}]\n${s.audio_text || s.narration || ""}`).join("\n\n");
          } else if (Array.isArray(parsed)) {
            raw = parsed.map((s, i) => `[Scene ${s.scene_number || i + 1}]\n${s.audio_text || s.narration || ""}`).join("\n\n");
          }
        }
      } catch (err) {
        // Not valid JSON, keep as raw text
      }
    }

    if (typeof setScriptContent === "function") {
      setScriptContent(raw);
    }
    setPasteModalOpen(false);
    setPastedText("");
    if (typeof triggerScriptNotice === "function") {
      triggerScriptNotice("Script successfully loaded.");
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Script Action Pills Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pb-3 border-b border-line">
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

          {/* Paste Script / JSON Pill */}
          <button
            type="button"
            onClick={() => {
              setPasteError("");
              setPasteModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
            title="Paste script or JSON"
          >
            <ClipboardPaste size={13} />
            <span>Paste Script</span>
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
              if (typeof triggerScriptNotice === "function") {
                triggerScriptNotice("Script copied to clipboard.");
              }
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
            disabled={isUpdatingScript}
            onClick={handleUpdateScript}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
            title="Save script changes"
          >
            {isUpdatingScript ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>Update</span>
              </>
            )}
          </button>

          {/* Autogenerate Script Pill */}
          <button
            type="button"
            disabled={isGeneratingScript}
            onClick={handleGenerateScript}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-60"
            title="AI autogenerate full teleprompter script"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Autogenerate Script</span>
              </>
            )}
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
                No script content yet. Click "Autogenerate Script", "Paste Script", or "Edit Script" to write one.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Paste Script / JSON Modal */}
      {mounted && pasteModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasteModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-signal/10 text-signal flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-base font-display font-semibold text-ink">
                    Paste Script / JSON
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Paste your raw narration text or script JSON payload to instantly load it into the script editor.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPastedScript} className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <label htmlFor="paste-script-textarea" className="font-semibold text-ink/80">
                    Script Content or JSON *
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="text-signal hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <ClipboardPaste size={12} /> Paste from clipboard
                  </button>
                </div>
                <textarea
                  id="paste-script-textarea"
                  required
                  rows={14}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (pasteError) setPasteError("");
                  }}
                  placeholder="Paste script text or JSON here..."
                  className="w-full flex-1 min-h-[220px] p-3.5 border border-line-dark bg-white text-ink font-sans text-xs leading-relaxed outline-none focus:border-signal"
                />
              </div>

              {pasteError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{pasteError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setPastedText("");
                    setPasteError("");
                  }}
                  className="text-xs text-ink-muted hover:text-ink cursor-pointer"
                >
                  Clear input
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPasteModalOpen(false)}
                    className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-signal hover:bg-signal-hover active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Apply Script
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

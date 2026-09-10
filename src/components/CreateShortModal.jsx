"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  Smartphone,
  Scissors,
  Plus,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CreateShortModal({
  isOpen,
  onClose,
  channelSlug,
  pillars = [],
  longformTopics = [],
  onCreated,
}) {
  const router = useRouter();
  const [mode, setMode] = useState("standalone"); // "standalone" | "extract"
  
  // Standalone fields
  const [title, setTitle] = useState("");
  const [selectedPillarSlug, setSelectedPillarSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Extract fields
  const [selectedParentSlug, setSelectedParentSlug] = useState(
    longformTopics.length > 0 ? longformTopics[0].slug : ""
  );
  const [isExtracting, setIsExtracting] = useState(false);

  if (!isOpen) return null;

  async function handleCreateStandalone(e) {
    if (e) e.preventDefault();
    setErrorMsg("");

    if (!title.trim()) {
      setErrorMsg("Please enter a title for the Short.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          pillarSlug: selectedPillarSlug || undefined,
          videoType: "short",
          aspectRatio: "9:16",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create Short");
      }

      toast.success("Short created successfully!");
      if (typeof onCreated === "function") {
        onCreated(data.topic);
      }
      onClose();

      const newSlug = data.topic?.slug;
      if (newSlug) {
        router.push(`/dashboard/channels/${channelSlug}/topic/${newSlug}`);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExtractFromLongform(e) {
    if (e) e.preventDefault();
    setErrorMsg("");

    if (!selectedParentSlug) {
      setErrorMsg("Please select a source long-form video.");
      return;
    }

    setIsExtracting(true);
    try {
      const res = await fetch(
        `/api/channels/${channelSlug}/topics/${selectedParentSlug}/extract-short`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to extract Short");
      }

      toast.success("Short extracted from script!");
      if (typeof onCreated === "function") {
        onCreated(data.shortTopic);
      }
      onClose();

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsExtracting(false);
    }
  }

  const parentTopic = longformTopics.find((t) => t.slug === selectedParentSlug);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-paper-card border border-line shadow-2xl overflow-hidden flex flex-col text-ink">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-signal/10 border border-signal/20 text-signal">
              <Smartphone size={16} />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-ink">
                Create 9:16 Short
              </h3>
              <p className="text-[11px] text-ink-muted">
                Create a high-retention vertical video for YouTube Shorts & Reels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper border border-transparent hover:border-line transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 border-b border-line bg-paper/50 p-1.5 gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("standalone");
              setErrorMsg("");
            }}
            className={`py-2 px-3 flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              mode === "standalone"
                ? "bg-paper-card border-line text-signal font-bold shadow-xs"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Plus size={13} />
            <span>Standalone Short</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("extract");
              setErrorMsg("");
            }}
            className={`py-2 px-3 flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              mode === "extract"
                ? "bg-paper-card border-line text-signal font-bold shadow-xs"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Scissors size={13} />
            <span>Extract from Topic</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === "standalone" ? (
            <form onSubmit={handleCreateStandalone} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Short Title <span className="text-signal">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., The 1 Rule That Millionaires Follow"
                  className="w-full px-3 py-2 text-xs border border-line bg-paper text-ink focus:outline-hidden focus:border-signal focus:ring-1 focus:ring-signal/30 font-medium"
                  autoFocus
                />
                <p className="text-[10px] text-ink-muted mt-1">
                  Keep titles under 60 characters for optimal display on mobile feeds.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Assign Content Pillar (Optional)
                </label>
                <select
                  value={selectedPillarSlug}
                  onChange={(e) => setSelectedPillarSlug(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-line bg-paper text-ink focus:outline-hidden focus:border-signal"
                >
                  <option value="">-- No specific pillar --</option>
                  {pillars.map((p) => (
                    <option key={p.id || p.slug} value={p.slug}>
                      {p.name} {p.tag ? `(${p.tag})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-paper border border-line text-[11px] text-ink-muted space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <Smartphone size={12} className="text-signal" />
                  <span>Configured for 9:16 Shorts format:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                  <li>Script target: 85–135 words (35–50s spoken)</li>
                  <li>Fast visual scene rhythm: cuts every 2–4 seconds</li>
                  <li>Full 1080x1920 HD vertical rendering</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs border border-line text-ink-muted hover:text-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="px-4 py-2 text-xs bg-signal hover:bg-signal-hover text-white font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      <span>Create Short</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleExtractFromLongform} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Select Source Long-form Video <span className="text-signal">*</span>
                </label>
                {longformTopics.length === 0 ? (
                  <div className="p-3 border border-line bg-paper text-xs text-ink-muted">
                    No long-form topics found with scripts to extract from. Please create a regular topic first.
                  </div>
                ) : (
                  <select
                    value={selectedParentSlug}
                    onChange={(e) => setSelectedParentSlug(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-line bg-paper text-ink focus:outline-hidden focus:border-signal"
                  >
                    {longformTopics.map((t) => (
                      <option key={t.id || t.slug} value={t.slug}>
                        {t.title} {t.scriptContent ? "✓ (Has Script)" : "(No Script)"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {parentTopic && (
                <div className="p-3 border border-line bg-paper space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink truncate">
                      {parentTopic.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-paper-card border border-line">
                      {parentTopic.pillarName || "No Pillar"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted line-clamp-3 italic">
                    {parentTopic.scriptContent
                      ? `"${parentTopic.scriptContent.slice(0, 160)}..."`
                      : "Warning: This topic has no script. Short extraction requires an existing script."}
                  </p>
                </div>
              )}

              <div className="p-3 bg-paper border border-line text-[11px] text-ink-muted space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <Sparkles size={12} className="text-signal" />
                  <span>How extraction works:</span>
                </div>
                <p className="text-[10px]">
                  AI scans the full documentary script, identifies the single most viral hook and insight, and condenses it into a 45-second high-energy Short script with a seamless loop.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs border border-line text-ink-muted hover:text-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isExtracting ||
                    !selectedParentSlug ||
                    !parentTopic?.scriptContent
                  }
                  className="px-4 py-2 text-xs bg-signal hover:bg-signal-hover text-white font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Extracting Short with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Extract Short</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

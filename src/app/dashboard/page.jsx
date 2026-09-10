"use client";

import {
  Plus,
  Video,
  Sparkles,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  Layers,
  Edit3,
  Copy,
  Check,
  Loader2,
  Tv,
  Code2,
  FileCode,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_SCRIPT_STRUCTURE,
  SCRIPT_STRUCTURE_PRESETS
} from "@/lib/defaultScriptStructure";

const STORAGE_KEY = "faceless_channels";

function initials(name) {
  if (!name) return "CH";
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getStatusBadge(status = "Active") {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "paused":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    default:
      return "bg-ink/5 text-ink-muted border-line";
  }
}

export default function OverviewPage() {
  const [openComposer, setOpenComposer] = useState(false);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [name, setName] = useState("");
  const [scriptStructureText, setScriptStructureText] = useState(
    JSON.stringify(DEFAULT_SCRIPT_STRUCTURE, null, 2)
  );
  const [structureError, setStructureError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("engaging_storytelling");
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch channels from Neon DB API (falls back to local storage if DB is unconfigured)
  async function loadChannels() {
    setLoading(true);
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.channels)) {
          setChannels(data.channels);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.channels));
          } catch {
            // Ignore
          }
          setLoading(false);
          return;
        }
      }
    } catch {
      // Ignore network errors, check localStorage
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setChannels(parsed);
        }
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  }

  useEffect(() => {
    loadChannels();
  }, []);

  function handleCopyChannelJson(channel, e) {
    e.stopPropagation();
    e.preventDefault();
    const nestedData = {
      channel: {
        name: channel.name,
        slug: channel.slug,
        handle: channel.handle || `@${channel.slug}`,
        channel_url: channel.channelUrl || `https://youtube.com/@${channel.slug}`,
        tagline: channel.tagline || "",
        description: channel.description || "",
        status: channel.status || "Active",
        videos: channel.videos || 0,
      },
      niche_and_audience: {
        niche: channel.niche || "Documentaries",
        sub_niche: channel.subNiche || "",
        content_category: channel.contentCategory || "Education & Documentaries",
        target_audience: channel.targetAudience || "",
      },
      brand_strategy: {
        mission: channel.mission || "",
        value_proposition: channel.valueProposition || "",
        personality: channel.personality || "",
        brand_positioning: channel.brandPositioning || "",
        brand_promise: channel.brandPromise || "",
      },
      creative_themes: {
        image_theme: channel.imageTheme || "",
        thumbnail_theme: channel.thumbnailTheme || "",
        audio_theme: channel.audioTheme || "",
      },
      script_structure: channel.scriptStructure || null,
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(nestedData, null, 2));
      setCopiedSlug(channel.slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // Fallback
    }
  }

  function handleApplyPreset(presetId) {
    setSelectedPreset(presetId);
    const found = SCRIPT_STRUCTURE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setScriptStructureText(JSON.stringify(found.structure, null, 2));
      setStructureError("");
    }
  }

  function handlePrettifyJson() {
    try {
      const parsed = JSON.parse(scriptStructureText);
      setScriptStructureText(JSON.stringify(parsed, null, 2));
      setStructureError("");
    } catch (err) {
      setStructureError(`JSON syntax error: ${err.message}`);
    }
  }

  async function submitChannel(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    let parsedStructure = null;
    if (scriptStructureText.trim()) {
      try {
        parsedStructure = JSON.parse(scriptStructureText.trim());
        setStructureError("");
      } catch (err) {
        setStructureError(`Invalid JSON in Script Structure: ${err.message}`);
        return;
      }
    }

    setCreating(true);
    const cleanSlug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const cleanHandle = `@${cleanSlug.replace(/-/g, "")}`;

    const newChannelPayload = {
      name: trimmed,
      slug: cleanSlug,
      handle: cleanHandle,
      channelUrl: `https://youtube.com/${cleanHandle}`,
      description: "",
      tagline: "",
      niche: "",
      subNiche: "",
      contentCategory: "",
      targetAudience: "",
      mission: "",
      valueProposition: "",
      personality: "",
      brandPositioning: "",
      brandPromise: "",
      imageTheme: "",
      thumbnailTheme: "",
      audioTheme: "",
      scriptStructure: parsedStructure,
      status: "Active",
    };

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChannelPayload),
      });

      if (res.ok) {
        await loadChannels();
      } else {
        // Fallback local update
        const updated = [newChannelPayload, ...channels];
        setChannels(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      const updated = [newChannelPayload, ...channels];
      setChannels(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } finally {
      setName("");
      setScriptStructureText(JSON.stringify(DEFAULT_SCRIPT_STRUCTURE, null, 2));
      setStructureError("");
      setCreating(false);
      setOpenComposer(false);
    }
  }

  async function handleConfirmDelete() {
    if (!channelToDelete) return;
    const targetSlug = channelToDelete.slug;

    try {
      await fetch(`/api/channels/${targetSlug}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore network errors
    }

    const updated = channels.filter((c) => c.slug !== targetSlug);
    setChannels(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    setChannelToDelete(null);
  }

  return (
    <div className="space-y-10 animate-card-rise">
      {/* Header Banner */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
            Your channels
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1">
            Manage your automated YouTube channels, story systems, and scheduled rendering desks.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-signal hover:bg-signal-hover active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer shrink-0"
          type="button"
          onClick={() => setOpenComposer(true)}
        >
          Create a channel <Plus size={16} />
        </button>
      </section>

      {/* Grid of Channels */}
      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading channels from database...</p>
        </section>
      ) : channels.length === 0 ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-4 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-signal/10 text-signal flex items-center justify-center mx-auto">
            <Tv size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink">No channels created yet</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Get started by creating your first automated channel to connect pillars, script engines, and video renders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenComposer(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-signal hover:bg-signal-hover text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus size={15} /> Create a channel
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {channels.map((channel) => (
            <div
              key={channel.slug}
              className="group block p-5 border border-line bg-paper-card hover:border-signal/40 hover:shadow-md hover:shadow-signal/5 hover:-translate-y-0.5 transition-all relative"
            >
              <div className="flex items-start justify-between mb-4">
                <Link
                  href={`/dashboard/channels/${channel.slug}`}
                  className="w-10 h-10 bg-signal/10 text-signal font-bold text-xs font-mono flex items-center justify-center group-hover:bg-signal group-hover:text-white transition-colors cursor-pointer"
                >
                  {initials(channel.name)}
                </Link>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleCopyChannelJson(channel, e)}
                    className="p-1.5 rounded-md text-ink-muted/60 hover:text-signal hover:bg-signal/5 transition-colors cursor-pointer"
                    title={`Copy JSON for "${channel.name}"`}
                    aria-label={`Copy JSON for ${channel.name}`}
                  >
                    {copiedSlug === channel.slug ? (
                      <Check size={15} className="text-emerald-600" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <Link
                    href={`/dashboard/channels/${channel.slug}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-ink-muted/60 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                    title={`Edit channel "${channel.name}"`}
                    aria-label={`Edit channel ${channel.name}`}
                  >
                    <Edit3 size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setChannelToDelete(channel);
                    }}
                    className="p-1.5 rounded-md text-ink-muted/60 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title={`Delete channel "${channel.name}"`}
                    aria-label={`Delete channel ${channel.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                  <Link
                    href={`/dashboard/channels/${channel.slug}`}
                    className="p-1.5 text-ink-muted/50 group-hover:text-signal transition-colors cursor-pointer"
                    title="Open channel workspace"
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </div>

              <Link href={`/dashboard/channels/${channel.slug}`} className="block">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
                    {channel.name}
                  </h3>
                  {channel.handle && (
                    <span className="font-mono text-[11px] text-ink-muted/80">
                      {channel.handle}
                    </span>
                  )}
                </div>
                <p className="text-xs text-signal font-medium mt-0.5">
                  {channel.niche} {channel.subNiche ? `• ${channel.subNiche}` : ""}
                </p>
                <p className="text-xs text-ink-muted mt-2 mb-4 line-clamp-2 leading-relaxed">
                  {channel.tagline || channel.description || "Automated production engine desk."}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-line/60 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <Video size={13} /> {channel.videos || 0} videos
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${getStatusBadge(
                      channel.status
                    )}`}
                  >
                    {channel.status || "Active"}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* Delete Channel Confirmation Modal */}
      {mounted && channelToDelete && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChannelToDelete(null);
          }}
        >
          <div className="relative w-full max-w-md bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2 border border-rose-200">
              <Trash2 size={20} />
            </div>

            <div>
              <h2 id="delete-dialog-title" className="text-xl font-display font-semibold text-ink tracking-tight">
                Delete {channelToDelete.name}?
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                Are you sure you want to delete this channel? All associated content pillars, story topics, and settings will be permanently removed from the database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                onClick={() => setChannelToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} /> Delete Channel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create Channel Modal */}
      {mounted && openComposer && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="composer-title"
        >
          <form
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto"
            onSubmit={submitChannel}
          >
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-semibold tracking-wider uppercase mb-1">
              <Sparkles size={13} /> NEW ENGINE DESK
            </div>

            <div>
              <h2 id="composer-title" className="text-2xl font-display font-semibold text-ink tracking-tight">
                Create Channel
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1">
                Establish your channel identity and define its script structure blueprint to guide AI scriptwriters.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="channel-name">
                  Channel name *
                </label>
                <input
                  id="channel-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. The Quiet Ledger"
                  autoFocus
                  required
                  className="w-full h-11 px-3.5 border border-line-dark bg-white text-sm text-ink outline-none focus:border-signal"
                />
              </div>

              {/* Script Structure JSON Section */}
              <div className="pt-2 border-t border-line space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink/90 flex items-center gap-1.5" htmlFor="script-structure-json">
                      <Code2 size={14} className="text-signal" /> Script Structure (JSON)
                    </label>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      Blueprint telling any LLM how to pace, structure acts, hook viewers, and avoid boring tropes.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Preset Picker */}
                    <select
                      value={selectedPreset}
                      onChange={(e) => handleApplyPreset(e.target.value)}
                      className="text-[11px] font-medium border border-line bg-white px-2 py-1 text-ink outline-none focus:border-signal cursor-pointer"
                      title="Load a pre-engineered retention structure preset"
                    >
                      {SCRIPT_STRUCTURE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handlePrettifyJson}
                      className="px-2 py-1 text-[11px] font-medium border border-line bg-paper-card hover:bg-ink/5 text-ink transition-colors cursor-pointer"
                      title="Format and validate JSON"
                    >
                      Prettify JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(selectedPreset)}
                      className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                      title="Reset to selected preset template"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    id="script-structure-json"
                    rows={12}
                    value={scriptStructureText}
                    onChange={(e) => {
                      setScriptStructureText(e.target.value);
                      if (structureError) {
                        try {
                          JSON.parse(e.target.value.trim());
                          setStructureError("");
                        } catch {}
                      }
                    }}
                    placeholder="Enter script structure JSON..."
                    spellCheck={false}
                    className={`w-full font-mono text-xs p-3 border bg-slate-950 text-emerald-400 leading-relaxed outline-none transition-colors ${
                      structureError
                        ? "border-rose-500 focus:border-rose-600"
                        : "border-line-dark focus:border-signal"
                    }`}
                  />
                  <div className="absolute bottom-2.5 right-3 pointer-events-none">
                    {structureError ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 border border-rose-800">
                        <AlertCircle size={11} /> Invalid JSON
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 border border-emerald-800">
                        <CheckCircle2 size={11} /> Valid JSON
                      </span>
                    )}
                  </div>
                </div>

                {structureError && (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1 font-mono">
                    <AlertCircle size={12} /> {structureError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                className="px-4 py-2.5 border border-line bg-paper-card text-xs font-semibold text-ink/70 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                onClick={() => {
                  setName("");
                  setStructureError("");
                  setOpenComposer(false);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>{creating ? "Creating..." : "Create Channel"}</span>
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}

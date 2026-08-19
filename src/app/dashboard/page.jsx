"use client";

import { Plus, X, Video, Sparkles, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

// Dummy data — replace with real channel records once the backend exists.
const dummyChannels = [
  { name: "The Quiet Ledger", slug: "the-quiet-ledger", niche: "Personal finance", videos: 24, status: "Active" },
  { name: "Stoic Signal", slug: "stoic-signal", niche: "Applied philosophy", videos: 41, status: "Active" },
  { name: "Late Byte", slug: "late-byte", niche: "Tech explainers", videos: 12, status: "Draft" },
  { name: "Field Notes", slug: "field-notes", niche: "Nature & science", videos: 8, status: "Active" },
  { name: "Cold Open", slug: "cold-open", niche: "True crime", videos: 33, status: "Paused" },
  { name: "Low Light", slug: "low-light", niche: "Sleep & ambience", videos: 19, status: "Active" },
];

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getStatusBadge(status) {
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
  const [channels, setChannels] = useState(dummyChannels);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");

  // Dismiss composer on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpenComposer(false);
    }
    if (openComposer) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [openComposer]);

  function submitChannel(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setChannels((prev) => [
      ...prev,
      {
        name: trimmed,
        slug: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        niche: niche.trim() || "Unassigned",
        videos: 0,
        status: "Draft",
      },
    ]);
    setName("");
    setNiche("");
    setOpenComposer(false);
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
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
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map((channel) => (
          <Link
            key={channel.slug}
            href={`/dashboard/channels/${channel.slug}`}
            className="group block p-5  border border-line bg-paper-card hover:border-signal/40 hover:shadow-md hover:shadow-signal/5 hover:-translate-y-0.5 transition-all relative"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="w-10 h-10 bg-signal/10 text-signal font-bold text-xs font-mono flex items-center justify-center group-hover:bg-signal group-hover:text-white transition-colors">
                {initials(channel.name)}
              </span>
              <span className="text-ink-muted/50 group-hover:text-signal transition-colors">
                <ArrowUpRight size={18} />
              </span>
            </div>

            <h3 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
              {channel.name}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 mb-5 font-medium">
              {channel.niche}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-line/60 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <Video size={13} /> {channel.videos} videos
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${getStatusBadge(
                  channel.status
                )}`}
              >
                {channel.status}
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Channel Composer Modal */}
      {openComposer && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 animate-card-rise"
          role="dialog"
          aria-modal="true"
          aria-labelledby="composer-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenComposer(false);
          }}
        >
          <form
            className="w-full max-w-md bg-paper-card p-6 sm:p-8 rounded-2xl border border-white/80 shadow-2xl relative animate-modal-pop"
            onSubmit={submitChannel}
          >
            <button
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors"
              aria-label="Close"
              onClick={() => setOpenComposer(false)}
            >
              <X size={18} />
            </button>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-semibold tracking-wider uppercase mb-3">
              <Sparkles size={13} /> NEW ENGINE DESK
            </div>

            <h2 id="composer-title" className="text-2xl font-display font-semibold text-ink tracking-tight">
              Name the channel
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 mb-6">
              Establish a dedicated production engine and brief system.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="channel-name">
                  Channel name
                </label>
                <input
                  id="channel-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. The Quiet Ledger"
                  autoFocus
                  required
                  className="w-full h-11 px-3.5 rounded-lg border border-line-dark bg-white text-sm text-ink outline-none focus:border-signal focus:ring-3 focus:ring-signal/15 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="channel-niche">
                  Channel niche / topic
                </label>
                <input
                  id="channel-niche"
                  value={niche}
                  onChange={(event) => setNiche(event.target.value)}
                  placeholder="e.g. Financial Documentaries"
                  className="w-full h-11 px-3.5 rounded-lg border border-line-dark bg-white text-sm text-ink outline-none focus:border-signal focus:ring-3 focus:ring-signal/15 transition-all"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg border border-line text-xs font-semibold text-ink/70 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                onClick={() => setOpenComposer(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
              >
                Create Channel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

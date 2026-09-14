"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Smartphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Youtube,
  Trash2,
  Film,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
  Scissors,
  Sparkles,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import CreateShortModal from "./CreateShortModal";

export default function ChannelShortsView({
  channelSlug,
  channelTitle,
  topics = [],
  pillars = [],
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "uncompleted" | "completed" | "posted"
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [shortToDelete, setShortToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteShort() {
    if (!shortToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting "${shortToDelete.title}" and cleaning up R2 media...`);

    try {
      const res = await fetch(
        `/api/channels/${channelSlug}/topics/${shortToDelete.slug}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete short");
      }

      toast.success(
        `Deleted "${shortToDelete.title}" and cleaned up R2 media files.`,
        { id: toastId }
      );
      setShortToDelete(null);
      if (typeof onRefresh === "function") {
        await onRefresh();
      }
    } catch (err) {
      console.error("Error deleting short:", err);
      toast.error(err.message || "Failed to delete short", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }

  // Filter shorts topics
  const shorts = useMemo(() => {
    return topics.filter((t) => t.videoType === "short");
  }, [topics]);

  const longformTopics = useMemo(() => {
    return topics.filter((t) => t.videoType !== "short");
  }, [topics]);

  // Compute status counts for shorts
  const postedShorts = useMemo(() => {
    return shorts.filter((t) => Boolean(t.youtubeUrl || t.youtubeVideoId));
  }, [shorts]);

  const completedShorts = useMemo(() => {
    return shorts.filter((t) => {
      const hasMaster = Boolean(t.masterVideoUrl && t.masterVideoUrl !== "generated");
      const isPosted = Boolean(t.youtubeUrl || t.youtubeVideoId);
      return hasMaster && !isPosted;
    });
  }, [shorts]);

  const uncompletedShorts = useMemo(() => {
    return shorts.filter((t) => {
      const hasMaster = Boolean(t.masterVideoUrl && t.masterVideoUrl !== "generated");
      return !hasMaster && !t.youtubeUrl && !t.youtubeVideoId;
    });
  }, [shorts]);

  // Filter based on search and status filter
  const filteredShorts = useMemo(() => {
    return shorts.filter((short) => {
      // Status filter
      if (statusFilter === "posted") {
        if (!short.youtubeUrl && !short.youtubeVideoId) return false;
      } else if (statusFilter === "completed") {
        const hasMaster = Boolean(short.masterVideoUrl && short.masterVideoUrl !== "generated");
        const isPosted = Boolean(short.youtubeUrl || short.youtubeVideoId);
        if (!hasMaster || isPosted) return false;
      } else if (statusFilter === "uncompleted") {
        const hasMaster = Boolean(short.masterVideoUrl && short.masterVideoUrl !== "generated");
        if (hasMaster || short.youtubeUrl || short.youtubeVideoId) return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        short.title?.toLowerCase().includes(q) ||
        short.pillarName?.toLowerCase().includes(q)
      );
    });
  }, [shorts, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in text-ink">
      {/* Top Banner / Stats Header */}
      <div className="p-4 sm:p-5 border border-line bg-paper-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold flex items-center gap-1">
              <Smartphone size={11} /> 9:16 Shorts
            </span>
            <span className="text-xs font-mono text-ink-muted">
              {shorts.length} short{shorts.length === 1 ? "" : "s"} total
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-ink">
            Channel Shorts Desk
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Create high-retention 30–60 second vertical videos for YouTube Shorts, Reels, and TikTok.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs transition-all cursor-pointer w-full sm:w-auto"
          >
            <Plus size={14} />
            <span>Create Short</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
              statusFilter === "all"
                ? "bg-signal text-white border-signal shadow-xs"
                : "bg-paper-card border-line text-ink-muted hover:text-ink"
            }`}
          >
            All Shorts ({shorts.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("uncompleted")}
            className={`px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === "uncompleted"
                ? "bg-signal text-white border-signal shadow-xs"
                : "bg-paper-card border-line text-ink-muted hover:text-ink"
            }`}
          >
            <Clock size={12} />
            <span>In Progress ({uncompletedShorts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === "completed"
                ? "bg-signal text-white border-signal shadow-xs"
                : "bg-paper-card border-line text-ink-muted hover:text-ink"
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Completed ({completedShorts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("posted")}
            className={`px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === "posted"
                ? "bg-signal text-white border-signal shadow-xs"
                : "bg-paper-card border-line text-ink-muted hover:text-ink"
            }`}
          >
            <Youtube size={12} className="text-rose-600" />
            <span>Posted ({postedShorts.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shorts..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-line bg-paper-card text-ink focus:outline-hidden focus:border-signal"
          />
        </div>
      </div>

      {/* Grid of Shorts Cards */}
      {filteredShorts.length === 0 ? (
        <div className="p-12 border border-line bg-paper-card text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-paper border border-line flex items-center justify-center text-ink-muted">
            <Smartphone size={24} />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-display font-semibold text-ink">
              {searchQuery ? "No shorts match your search" : "No Shorts created yet"}
            </h3>
            <p className="text-xs text-ink-muted">
              {searchQuery
                ? "Try adjusting your search query or clear the filter."
                : "Create standalone 9:16 Shorts or extract viral 45s clips from your existing long-form documentaries."}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>Create Your First Short</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredShorts.map((short) => {
            const hasScript = Boolean(short.scriptContent && short.scriptContent.trim());
            const sceneCount = Array.isArray(short.scenesJson)
              ? short.scenesJson.length
              : 0;
            const hasMaster = Boolean(short.masterVideoUrl && short.masterVideoUrl !== "generated");
            const isPosted = Boolean(short.youtubeUrl || short.youtubeVideoId);

            return (
              <div
                key={short.id || short.slug}
                className="group border border-line bg-paper-card hover:border-signal/50 transition-all flex flex-col justify-between overflow-hidden shadow-2xs"
              >
                <div>
                  {/* Top Preview Frame (Vertical 9:16 aspect ratio box) */}
                  <div className="relative aspect-[9/12] bg-paper overflow-hidden border-b border-line flex items-center justify-center">
                    {short.masterVideoUrl && short.masterVideoUrl !== "generated" ? (
                      <video
                        src={short.masterVideoUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        onMouseEnter={(e) => e.target.play().catch(() => {})}
                        onMouseLeave={(e) => e.target.pause()}
                      />
                    ) : short.thumbnailUrl && short.thumbnailUrl !== "generated" ? (
                      <img
                        src={short.thumbnailUrl}
                        alt={short.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="p-4 text-center space-y-2 text-ink-muted">
                        <Smartphone size={32} className="mx-auto text-signal/40" />
                        <span className="text-[10px] font-mono block">
                          9:16 Vertical Short
                        </span>
                      </div>
                    )}

                    {/* Format Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-black/80 text-white backdrop-blur-xs border border-white/20">
                        9:16 SHORT
                      </span>
                      {short.parentTopicId && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-signal/90 text-white backdrop-blur-xs"
                          title="Extracted from long-form topic"
                        >
                          EXTRACTED
                        </span>
                      )}
                    </div>

                    {/* Status Badge & Delete Action */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {isPosted ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-600 text-white shadow-xs">
                          POSTED
                        </span>
                      ) : hasMaster ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-signal text-white shadow-xs">
                          READY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-600 text-white shadow-xs">
                          DRAFT
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setShortToDelete(short);
                        }}
                        className="p-1 bg-black/60 hover:bg-rose-600 text-white/80 hover:text-white backdrop-blur-xs border border-white/20 transition-all cursor-pointer shadow-xs"
                        title="Delete Short & remove files from R2"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 space-y-2.5">
                    {short.pillarName && (
                      <span className="text-[10px] font-mono text-signal uppercase tracking-wider block font-semibold truncate">
                        {short.pillarName}
                      </span>
                    )}

                    <h3 className="text-xs font-display font-bold text-ink group-hover:text-signal transition-colors line-clamp-2">
                      <Link
                        href={`/dashboard/channels/${channelSlug}/topic/${short.slug}`}
                      >
                        {short.title}
                      </Link>
                    </h3>

                    {/* Step progress pills */}
                    <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono text-center">
                      <span
                        className={`py-1 border ${
                          hasScript
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold"
                            : "bg-paper border-line text-ink-muted"
                        }`}
                      >
                        {hasScript ? "Script ✓" : "No Script"}
                      </span>
                      <span
                        className={`py-1 border ${
                          sceneCount > 0
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold"
                            : "bg-paper border-line text-ink-muted"
                        }`}
                      >
                        {sceneCount > 0 ? `${sceneCount} Scn` : "0 Scn"}
                      </span>
                      <span
                        className={`py-1 border ${
                          hasMaster
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-semibold"
                            : "bg-paper border-line text-ink-muted"
                        }`}
                      >
                        {hasMaster ? "Video ✓" : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-3.5 py-2.5 border-t border-line bg-paper/50 flex items-center justify-between">
                  <Link
                    href={`/dashboard/channels/${channelSlug}/topic/${short.slug}`}
                    className="text-xs font-semibold text-signal hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open Studio</span>
                    <ArrowRight size={12} />
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {short.youtubeUrl && (
                      <a
                        href={short.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded transition-colors inline-flex items-center"
                        title="View on YouTube"
                      >
                        <Youtube size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShortToDelete(short);
                      }}
                      className="p-1.5 text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded transition-all cursor-pointer"
                      title="Delete Short & remove files from R2"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Short Confirmation Modal */}
      {shortToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-paper-card border border-line shadow-2xl overflow-hidden text-ink">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="p-1.5 bg-rose-500/10 border border-rose-500/20">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-ink">
                    Delete Short &amp; Media
                  </h3>
                  <p className="text-[11px] text-ink-muted">
                    Permanently delete from Database &amp; Cloudflare R2
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setShortToDelete(null)}
                disabled={isDeleting}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper border border-transparent hover:border-line transition-all disabled:opacity-50 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-ink leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-ink font-display">
                  &ldquo;{shortToDelete.title}&rdquo;
                </span>
                ?
              </p>

              <div className="p-3 bg-rose-500/5 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-400 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Trash2 size={13} />
                  <span>Cloudflare R2 Storage Cleanup:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[10.5px] opacity-90">
                  <li>All generated scene images and frame assets</li>
                  <li>All AI voiceover narration audio files</li>
                  <li>All individual scene frame videos</li>
                  <li>Final master 9:16 video cut &amp; thumbnails</li>
                  <li>
                    Directory{" "}
                    <code className="font-mono text-[10px] bg-rose-500/10 px-1 py-0.5">
                      channels/{channelSlug}/topics/{shortToDelete.slug}/
                    </code>
                  </li>
                </ul>
              </div>

              <p className="text-[11px] text-ink-muted">
                This action is permanent and cannot be undone.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-line bg-paper/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShortToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-semibold border border-line bg-paper hover:bg-paper-card text-ink transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteShort}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete Short &amp; Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for creating a new Short */}
      <CreateShortModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        channelSlug={channelSlug}
        pillars={pillars}
        longformTopics={longformTopics}
        onCreated={() => {
          if (typeof onRefresh === "function") {
            onRefresh();
          }
        }}
      />
    </div>
  );
}

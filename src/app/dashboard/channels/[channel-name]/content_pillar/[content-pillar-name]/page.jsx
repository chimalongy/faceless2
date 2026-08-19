"use client";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Clock,
  Layers,
  Film,
  Play,
  X,
  Target,
  ChevronRight,
  RefreshCw,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

function toTopicSlug(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ContentPillarDetail() {
  const params = useParams();
  const rawChannelSlug = params?.["channel-name"] || "";
  const rawPillarSlug = params?.["content-pillar-name"] || "";

  const channelSlug = Array.isArray(rawChannelSlug) ? rawChannelSlug[0] : rawChannelSlug;
  const pillarSlug = Array.isArray(rawPillarSlug) ? rawPillarSlug[0] : rawPillarSlug;

  const [loading, setLoading] = useState(true);
  const [pillar, setPillar] = useState(null);
  const [topics, setTopics] = useState([]);
  const [activeTab, setActiveTab] = useState("topics");
  const [mounted, setMounted] = useState(false);

  // Modals / forms
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicTitles, setTopicTitles] = useState("");
  const [creatingTopics, setCreatingTopics] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch pillar info
      const pRes = await fetch(`/api/channels/${channelSlug}/pillars/${pillarSlug}`);
      if (pRes.ok) {
        const data = await pRes.json();
        if (data.pillar) setPillar(data.pillar);
      }

      // 2. Fetch topics under this pillar
      const tRes = await fetch(`/api/channels/${channelSlug}/topics?pillar=${pillarSlug}`);
      if (tRes.ok) {
        const data = await tRes.json();
        if (Array.isArray(data.topics)) setTopics(data.topics);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [channelSlug, pillarSlug]);

  function handleOpenCreateTopic() {
    setTopicTitles("");
    setTopicModalOpen(true);
  }

  async function handleSaveTopic(e) {
    e.preventDefault();
    const lines = topicTitles
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    setCreatingTopics(true);

    const payload = {
      titles: lines,
      pillarSlug: pillarSlug,
    };

    try {
      await fetch(`/api/channels/${channelSlug}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadData();
    } catch {
      // Ignore
    } finally {
      setCreatingTopics(false);
      setTopicModalOpen(false);
    }
  }

  async function handleDeleteTopic(topicSlugToDelete, e) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await fetch(`/api/channels/${channelSlug}/topics/${topicSlugToDelete}`, {
        method: "DELETE",
      });
      await loadData();
    } catch {
      // Ignore
    }
  }

  const completedVideos = topics.filter((t) => t.stage === "Completed" || t.masterVideoUrl);

  const pillarName = pillar?.name || pillarSlug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

  return (
    <div className="space-y-8 animate-card-rise pb-20">
      {/* Back Link */}
      <div>
        <Link
          href={`/dashboard/channels/${channelSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to Channel Desk
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                {pillar?.tag || "Content Pillar"}
              </span>
              <span className="text-xs font-mono text-ink-muted">/{pillarSlug}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              {pillarName}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
              {pillar?.description || "Curated editorial pillar and thesis cluster for this channel."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateTopic}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              <Plus size={15} /> New Content Topic
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl">
          <RefreshCw size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading pillar intelligence...</p>
        </section>
      ) : (
        <>
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-line">
            <button
              type="button"
              onClick={() => setActiveTab("topics")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "topics"
                  ? "border-signal text-signal"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              Story Topics ({topics.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "completed"
                  ? "border-signal text-signal"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              Master Render Archive ({completedVideos.length})
            </button>
          </div>

          {/* TAB 1: TOPICS LIST */}
          {activeTab === "topics" && (
            <div className="space-y-4">
              {topics.length === 0 ? (
                <div className="p-12 border border-line bg-paper-card text-center space-y-3">
                  <Film size={28} className="text-signal/60 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-ink">No story topics under this pillar yet</h3>
                    <p className="text-xs text-ink-muted max-w-sm mx-auto">
                      Add your first content topic to start scripting scenes and rendering master videos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCreateTopic}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus size={14} /> New Content Topic
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line border border-line bg-paper-card">
                  {topics.map((topic) => (
                    <div
                      key={topic.slug}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink/[0.015] transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <Link
                          href={`/dashboard/channels/${channelSlug}/topic/${topic.slug}`}
                          className="text-sm sm:text-base font-semibold text-ink hover:text-signal transition-colors block"
                        >
                          {topic.title}
                        </Link>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Link
                          href={`/dashboard/channels/${channelSlug}/topic/${topic.slug}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          Open Studio <ChevronRight size={13} />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTopic(topic.slug, e)}
                          className="p-1.5 text-ink-muted/50 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete topic"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPLETED VIDEOS */}
          {activeTab === "completed" && (
            <div>
              {completedVideos.length === 0 ? (
                <div className="p-12 border border-line bg-paper-card text-center space-y-2">
                  <Video size={28} className="text-signal/60 mx-auto" />
                  <p className="text-xs text-ink-muted">
                    No completed master video cuts rendered yet for this pillar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {completedVideos.map((video) => (
                    <div
                      key={video.slug}
                      className="border border-line bg-paper-card overflow-hidden hover:border-signal/40 transition-all flex flex-col justify-between"
                    >
                      <div className="p-4 space-y-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase">
                          Master Ready
                        </span>
                        <h4 className="text-sm font-semibold text-ink line-clamp-2">
                          {video.title}
                        </h4>
                      </div>

                      <div className="p-3 border-t border-line flex items-center justify-between text-xs bg-paper">
                        <span className="text-ink-muted font-mono text-[11px]">
                          Master Cut
                        </span>
                        <Link
                          href={`/dashboard/channels/${channelSlug}/topic/${video.slug}`}
                          className="text-signal hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          Play / Export <Play size={12} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* CREATE TOPIC MODAL */}
      {mounted && topicModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-lg bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Film size={18} className="text-signal" />
                <h3 className="text-lg font-display font-semibold text-ink">
                  New Content Topic
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTopicModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="pt-titles">
                  Topic Name(s) *
                </label>
                <p className="text-[11px] text-ink-muted mb-2">
                  Enter one or multiple topic names (one per line) to upload multiple topics under this pillar at once.
                </p>
                <textarea
                  id="pt-titles"
                  required
                  rows={4}
                  value={topicTitles}
                  onChange={(e) => setTopicTitles(e.target.value)}
                  placeholder={`e.g.\nSlime Molds Solving Tokyo's Railway Network\nMycelium Communication Networks\nDeep Biosphere Extremophiles`}
                  className="w-full p-3 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setTopicModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTopics}
                  className="px-5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  {creatingTopics ? <RefreshCw size={14} className="animate-spin" /> : null}
                  <span>
                    {creatingTopics
                      ? "Creating Topics..."
                      : topicTitles.trim().split(/\r?\n/).filter(Boolean).length > 1
                      ? `Create ${topicTitles.trim().split(/\r?\n/).filter(Boolean).length} Topics`
                      : "Create Topic"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

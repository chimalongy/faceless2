"use client";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  Film,
  Play,
  X,
  Check,
  Wand2,
  Lightbulb,
  TrendingUp,
  Target,
  ChevronRight
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

// Mock pillar descriptions & data
const pillarProfiles = {
  "deep-wilderness-and-flora": {
    name: "Deep Wilderness & Flora",
    tag: "Nature & Botany",
    description:
      "Exploration of rare biomes, untamed botanical marvels, ancient primeval forests, and extreme botanical adaptations across unexplored regions.",
    hookStrategy: "Focus on age, isolation, and sensory descriptions of silence or forgotten landscapes.",
    targetAudience: "Curious nature enthusiasts, ambient documentarians, biology students.",
  },
  "microbial-and-fungal-networks": {
    name: "Microbial & Fungal Networks",
    tag: "Biology & Mycology",
    description:
      "Invisible ecosystems underground, mycorrhizal intelligence, fungal bio-computing, and subterranean spore distribution networks.",
    hookStrategy: "Highlight the planetary scale of invisible organisms and their collective problem-solving.",
    targetAudience: "Science nerds, speculative thinkers, ecology researchers.",
  },
  "atmospheric-and-geological-wonders": {
    name: "Atmospheric & Geological Wonders",
    tag: "Earth Science",
    description:
      "Severe meteorological anomalies, volcanic cycles, rare cloud formations, and planetary tectonic dynamics.",
    hookStrategy: "Open with high-stakes meteorological events and physics-defying atmospheric measurements.",
    targetAudience: "Weather enthusiasts, geologists, high-retention documentary viewers.",
  },
  "monetary-history-and-crises": {
    name: "Monetary History & Crises",
    tag: "Macroeconomics",
    description:
      "Deep historical breakdowns of sovereign debt defaults, hyperinflation collapses, central bank architectures, and historical currency resets.",
    hookStrategy: "Start with a specific date and the exact moment liquidity vanished.",
    targetAudience: "Macro investors, financial history buffs, sovereign wealth analysts.",
  },
};

const initialPillarTopics = [
  {
    id: "pt-1",
    title: "How Ancient Mycelium Shaped Earth's First Soil",
  },
  {
    id: "pt-2",
    title: "Bioluminescence In Deep Subterranean Caves",
  },
  {
    id: "pt-3",
    title: "Fungal Spores That Trigger Atmospheric Cloud Condensation",
  },
];

const initialPillarCompleted = [
  {
    id: "pcomp-1",
    title: "Slime Molds Solving Tokyo's Railway Network",
    duration: "13:48",
    publishedDate: "Jul 21, 2026",
    views: "520,400",
    status: "Published",
    retention: "68.9%",
  },
  {
    id: "pcomp-2",
    title: "The Humongous Fungus: Earth's Largest Living Organism",
    duration: "18:22",
    publishedDate: "Jun 14, 2026",
    views: "894,100",
    status: "Published",
    retention: "73.4%",
  },
];

export default function ContentPillarDetail() {
  const params = useParams();
  const rawChannelSlug = params?.["channel-name"] || "field-notes";
  const rawPillarSlug = params?.["content-pillar-name"] || "deep-wilderness-and-flora";

  const channelSlug = Array.isArray(rawChannelSlug) ? rawChannelSlug[0] : rawChannelSlug;
  const pillarSlug = Array.isArray(rawPillarSlug) ? rawPillarSlug[0] : rawPillarSlug;

  const channelTitle = channelSlug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  const profile = pillarProfiles[pillarSlug] || {
    name: pillarSlug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" "),
    tag: "Core Theme",
    description: "Curated content pillar and focused thematic editorial cluster for this channel.",
    hookStrategy: "Focus on clarity, curiosity gap, and authoritative narration.",
    targetAudience: "Channel core subscriber base.",
  };

  const [topics, setTopics] = useState(initialPillarTopics);
  const [completedVideos, setCompletedVideos] = useState(initialPillarCompleted);
  const [activeTab, setActiveTab] = useState("topics");
  const [mounted, setMounted] = useState(false);

  // Modals / forms
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [topicForm, setTopicForm] = useState({
    title: "",
    bulkTitles: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (topicModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [topicModalOpen]);

  function handleOpenCreateTopic() {
    setEditingTopic(null);
    setTopicForm({
      title: "",
      bulkTitles: "",
    });
    setTopicModalOpen(true);
  }

  function handleOpenEditTopic(topic) {
    setEditingTopic(topic);
    setTopicForm({
      title: topic.title,
      bulkTitles: "",
    });
    setTopicModalOpen(true);
  }

  function handleSaveTopic(e) {
    e.preventDefault();

    if (editingTopic) {
      if (!topicForm.title.trim()) return;
      setTopics((prev) =>
        prev.map((t) =>
          t.id === editingTopic.id
            ? { ...t, title: topicForm.title.trim() }
            : t
        )
      );
    } else {
      // Bulk addition: parse each line as a topic
      const lines = topicForm.bulkTitles
        .split("\n")
        .map((line) => line.replace(/^[\s•\-\d.)\]]+/, "").trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) return;

      const newTopics = lines.map((title, idx) => ({
        id: `pt-${Date.now()}-${idx}`,
        title,
      }));

      setTopics((prev) => [...newTopics, ...prev]);
    }

    setTopicModalOpen(false);
  }

  function handleDeleteTopic(id) {
    setTopics((prev) => prev.filter((t) => t.id !== id));
  }

  function handleDeleteCompleted(id) {
    setCompletedVideos((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="space-y-10 animate-card-rise">
      {/* Top Header & Breadcrumb */}
      <div>
        <Link
          href={`/dashboard/channels/${channelSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to {channelTitle}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                Pillar Directive
              </span>
            </div>
            <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
              {profile.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Horizontal Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-line overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("topics")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "topics"
              ? "border-signal text-signal bg-signal/5"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/5"
          }`}
        >
          <Sparkles size={15} />
          <span>Content Topics</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              activeTab === "topics"
                ? "bg-signal text-white"
                : "bg-ink/5 text-ink-muted"
            }`}
          >
            {topics.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("published")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "published"
              ? "border-signal text-signal bg-signal/5"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/5"
          }`}
        >
          <Film size={15} />
          <span>Published in this Pillar</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              activeTab === "published"
                ? "bg-signal text-white"
                : "bg-ink/5 text-ink-muted"
            }`}
          >
            {completedVideos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blueprint")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "blueprint"
              ? "border-signal text-signal bg-signal/5"
              : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/5"
          }`}
        >
          <Layers size={15} />
          <span>Editorial Blueprint</span>
        </button>
      </div>

      {/* TAB 1: CONTENT TOPICS */}
      {activeTab === "topics" && (
        <section className="space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold text-ink flex items-center gap-2">
                <Sparkles size={18} className="text-signal" /> Content Topics
              </h2>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateTopic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              <Plus size={14} /> Add Content Topics
            </button>
          </div>

          {topics.length === 0 ? (
            <div className="p-10 border border-dashed border-line bg-paper-card text-center space-y-3">
              <Sparkles size={28} className="mx-auto text-ink-muted/50" />
              <h4 className="text-sm font-semibold text-ink">No active content topics in this pillar</h4>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                Add one or multiple topics below to begin producing scripts, thumbnails, scenes, and narration.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateTopic}
                className="inline-flex items-center gap-2 px-4 py-2 bg-signal text-white text-xs font-semibold shadow-xs shadow-signal/20 hover:bg-signal-hover transition-all cursor-pointer"
              >
                <Plus size={14} /> Add Topics
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topics.map((topic) => {
                const topicSlug = toTopicSlug(topic.title);
                return (
                  <div
                    key={topic.id}
                    className="p-4 border border-line bg-paper-card hover:border-signal/40 transition-all flex items-center justify-between gap-4 group"
                  >
                    <Link
                      href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}/topic/${topicSlug}`}
                      className="block flex-1 min-w-0"
                    >
                      <h3 className="text-sm font-semibold text-ink leading-snug group-hover:text-signal transition-colors flex items-center gap-2">
                        <span className="truncate">{topic.title}</span>
                        <ChevronRight size={15} className="text-ink-muted/40 group-hover:text-signal group-hover:translate-x-0.5 transition-all shrink-0" />
                      </h3>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditTopic(topic);
                        }}
                        className="p-2 border border-line hover:bg-ink/5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        title="Modify topic title"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTopic(topic.id);
                        }}
                        className="p-2 border border-line hover:bg-rose-50 text-ink-muted hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete topic"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: PUBLISHED IN THIS PILLAR */}
      {activeTab === "published" && (
        <section className="space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold text-ink flex items-center gap-2">
                <Film size={18} className="text-emerald-700" /> Published in this Pillar
              </h2>
            </div>
          </div>

          {completedVideos.length === 0 ? (
            <div className="p-8 border border-line bg-paper-card text-center text-xs text-ink-muted">
              No published videos in this pillar yet. Complete topics to archive them here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedVideos.map((video) => (
                <div
                  key={video.id}
                  className="p-5 border border-line bg-paper-card flex flex-col justify-between group hover:border-line-dark transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                        <CheckCircle2 size={11} /> {video.status}
                      </span>
                      <span className="text-[11px] font-mono text-ink-muted">
                        {video.publishedDate}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-ink leading-snug">
                      {video.title}
                    </h3>
                  </div>

                  <div className="pt-4 mt-4 border-t border-line/60 flex items-center justify-between text-xs">
                    <div className="space-y-0.5 font-mono text-[11px] text-ink-muted">
                      <span>{video.duration} duration</span>
                      <span className="block text-ink font-semibold">{video.views} views • {video.retention} avg retention</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteCompleted(video.id)}
                        className="p-1.5 text-ink-muted hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove from archive"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 border border-line hover:bg-ink/5 text-ink transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-mono font-semibold"
                      >
                        <Play size={11} className="text-signal" /> Preview
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: STRATEGIC DIRECTIVE / EDITORIAL BLUEPRINT */}
      {activeTab === "blueprint" && (
        <section className="p-6 border border-line bg-paper-card space-y-5 animate-slide-in">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-signal" />
              <h2 className="text-sm font-semibold text-ink">Editorial Blueprint</h2>
            </div>
            <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-semibold bg-ink/5 text-ink-muted border border-line">
              {profile.tag}
            </span>
          </div>

          <p className="text-sm text-ink-muted leading-relaxed">
            {profile.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border border-line bg-paper-dark/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Lightbulb size={14} className="text-amber-600" /> Retention Hook Strategy
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {profile.hookStrategy}
              </p>
            </div>

            <div className="p-4 border border-line bg-paper-dark/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Target size={14} className="text-signal" /> Target Persona
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {profile.targetAudience}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* TOPIC MODAL VIA REACT PORTAL (FULL SCREEN COVERAGE) */}
      {mounted &&
        topicModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
            style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          >
            <div className="relative w-full max-w-lg bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h3 className="text-lg font-display font-semibold text-ink">
                    {editingTopic ? "Edit Topic Title" : `Add Content Topics`}
                  </h3>
                  {!editingTopic && (
                    <p className="text-xs text-ink-muted mt-0.5">
                      Pillar: <span className="font-semibold text-ink">{profile.name}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTopicModalOpen(false)}
                  className="p-1.5 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveTopic} className="space-y-4">
                {editingTopic ? (
                  <div>
                    <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="pillar-topic-title">
                      Topic Title *
                    </label>
                    <input
                      id="pillar-topic-title"
                      type="text"
                      required
                      placeholder="e.g., The Secret Network Beneath the Redwood Forest"
                      value={topicForm.title}
                      onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                      className="w-full h-11 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-ink/80" htmlFor="pillar-bulk-topics">
                        Content Topic(s) *
                      </label>
                      <span className="text-[11px] font-mono text-signal bg-signal/10 px-2 py-0.5 border border-signal/20 font-medium">
                        {topicForm.bulkTitles
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean).length > 0
                          ? `${
                              topicForm.bulkTitles
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean).length
                            } topic(s) ready`
                          : "1 topic per line"}
                      </span>
                    </div>

                    <textarea
                      id="pillar-bulk-topics"
                      rows={6}
                      required
                      placeholder={"How Ancient Mycelium Shaped Earth's First Soil\nBioluminescence In Deep Subterranean Caves\nFungal Spores That Trigger Atmospheric Condensation"}
                      value={topicForm.bulkTitles}
                      onChange={(e) => setTopicForm({ ...topicForm, bulkTitles: e.target.value })}
                      className="w-full p-3.5 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal resize-y"
                    />

                    <p className="text-[11px] text-ink-muted leading-normal">
                      Paste or type multiple topics above. Each line will create a separate content topic under this pillar.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setTopicModalOpen(false)}
                    className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                  >
                    {editingTopic
                      ? "Save Changes"
                      : topicForm.bulkTitles
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean).length > 1
                      ? `Add ${
                          topicForm.bulkTitles
                            .split("\n")
                            .map((l) => l.trim())
                            .filter(Boolean).length
                        } Topics`
                      : "Add Topic"}
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

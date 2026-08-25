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
  Search,
  Film,
  Video,
  Play,
  X,
  ChevronRight,
  Globe,
  Copy,
  Check,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

function toPillarSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toTopicSlug(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getStageBadge(stage) {
  switch (stage?.toLowerCase()) {
    case "master ready":
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "rendering":
      return "bg-purple-500/10 text-purple-700 border-purple-500/20";
    case "scene frames":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "audio":
    case "voice synthesis":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "scripting":
      return "bg-cyan-500/10 text-cyan-700 border-cyan-500/20";
    default:
      return "bg-ink/5 text-ink-muted border-line";
  }
}

export default function ChannelWorkspace() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.["channel-name"] || "";
  const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [loading, setLoading] = useState(true);
  const [channelProfile, setChannelProfile] = useState(null);
  const [pillars, setPillars] = useState([]);
  const [topics, setTopics] = useState([]);
  const [copiedJson, setCopiedJson] = useState(false);

  // Filters & State
  const [selectedPillarFilter, setSelectedPillarFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createTopicModalOpen, setCreateTopicModalOpen] = useState(false);
  const [createPillarModalOpen, setCreatePillarModalOpen] = useState(false);
  const [deleteChannelModalOpen, setDeleteChannelModalOpen] = useState(false);

  // Pillar Form State
  const [pillarName, setPillarName] = useState("");
  const [pillarTag, setPillarTag] = useState("");
  const [pillarDescription, setPillarDescription] = useState("");
  const [editingPillarSlug, setEditingPillarSlug] = useState(null);

  // Topic Form State
  const [topicTitles, setTopicTitles] = useState("");
  const [topicPillar, setTopicPillar] = useState("");
  const [creatingTopics, setCreatingTopics] = useState(false);

  // Portal mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadWorkspaceData() {
    setLoading(true);
    try {
      // 1. Fetch channel profile
      const channelRes = await fetch(`/api/channels/${channelSlug}`);
      if (channelRes.ok) {
        const data = await channelRes.json();
        if (data.channel) setChannelProfile(data.channel);
      }

      // 2. Fetch content pillars
      const pillarsRes = await fetch(`/api/channels/${channelSlug}/pillars`);
      if (pillarsRes.ok) {
        const data = await pillarsRes.json();
        if (Array.isArray(data.pillars)) setPillars(data.pillars);
      }

      // 3. Fetch topics
      const topicsRes = await fetch(`/api/channels/${channelSlug}/topics`);
      if (topicsRes.ok) {
        const data = await topicsRes.json();
        if (Array.isArray(data.topics)) setTopics(data.topics);
      }
    } catch (err) {
      console.warn("Could not load workspace data from API:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaceData();
  }, [channelSlug]);

  function handleCopyJson() {
    const cp = channelProfile || {};
    const nestedData = {
      channel: {
        name: cp.name || channelSlug,
        slug: cp.slug || channelSlug,
        handle: cp.handle || `@${channelSlug}`,
        channel_url: cp.channelUrl || `https://youtube.com/@${channelSlug}`,
        tagline: cp.tagline || "",
        description: cp.description || "",
        status: cp.status || "Active",
        videos: topics.filter((t) => t.masterVideoUrl).length,
      },
      niche_and_audience: {
        niche: cp.niche || "Documentaries",
        sub_niche: cp.subNiche || "",
        content_category: cp.contentCategory || "Education & Documentaries",
        target_audience: cp.targetAudience || "",
      },
      brand_strategy: {
        mission: cp.mission || "",
        value_proposition: cp.valueProposition || "",
        personality: cp.personality || "",
        brand_positioning: cp.brandPositioning || "",
        brand_promise: cp.brandPromise || "",
      },
      creative_themes: {
        image_theme: cp.imageTheme || "",
        thumbnail_theme: cp.thumbnailTheme || "",
        audio_theme: cp.audioTheme || "",
      },
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(nestedData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleDeleteChannel() {
    try {
      await fetch(`/api/channels/${channelSlug}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore
    }
    router.push("/dashboard");
  }

  // Pillar Creation / Update
  function handleOpenCreatePillar() {
    setEditingPillarSlug(null);
    setPillarName("");
    setPillarTag("");
    setPillarDescription("");
    setCreatePillarModalOpen(true);
  }

  function handleOpenEditPillar(pillar, e) {
    e.stopPropagation();
    e.preventDefault();
    setEditingPillarSlug(pillar.slug);
    setPillarName(pillar.name);
    setPillarTag(pillar.tag || "");
    setPillarDescription(pillar.description || "");
    setCreatePillarModalOpen(true);
  }

  async function handleSavePillar(e) {
    e.preventDefault();
    const trimmed = pillarName.trim();
    if (!trimmed) return;

    const payload = {
      name: trimmed,
      tag: pillarTag.trim(),
      description: pillarDescription.trim(),
    };

    try {
      if (editingPillarSlug) {
        await fetch(`/api/channels/${channelSlug}/pillars/${editingPillarSlug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/channels/${channelSlug}/pillars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await loadWorkspaceData();
    } catch {
      // Fallback
    } finally {
      setCreatePillarModalOpen(false);
    }
  }

  async function handleDeletePillar(slugToDelete, e) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await fetch(`/api/channels/${channelSlug}/pillars/${slugToDelete}`, {
        method: "DELETE",
      });
      await loadWorkspaceData();
    } catch {
      // Ignore
    }
  }

  // Topic Creation
  function handleOpenCreateTopic() {
    setTopicTitles("");
    setTopicPillar(pillars[0]?.slug || "");
    setCreateTopicModalOpen(true);
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
      pillarSlug: topicPillar || null,
    };

    try {
      await fetch(`/api/channels/${channelSlug}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadWorkspaceData();
    } catch {
      // Ignore
    } finally {
      setCreatingTopics(false);
      setCreateTopicModalOpen(false);
    }
  }

  const channelTitle = channelProfile?.name || channelSlug;
  const filteredTopics = topics.filter((t) => {
    const matchesPillar =
      selectedPillarFilter === "All" ||
      t.pillarSlug === selectedPillarFilter ||
      t.pillar === selectedPillarFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.hook && t.hook.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPillar && matchesSearch;
  });

  const completedVideos = topics.filter((t) => t.stage === "Completed" || t.masterVideoUrl);

  return (
    <div className="space-y-10 animate-card-rise pb-20">
      {/* TOP BAR & BREADCRUMBS */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to Channels Overview
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                {channelProfile?.niche || "Production Desk"}
              </span>
              <span className="text-xs font-mono text-ink-muted">/{channelSlug}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              {channelTitle}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
              {channelProfile?.tagline || channelProfile?.description || "Automated long-form documentary production desk."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
              title="Copy full nested JSON schema of channel brand architecture"
            >
              {copiedJson ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
            {channelProfile?.channelUrl && (
              <a
                href={channelProfile.channelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-paper-card text-ink-muted hover:text-ink text-xs font-semibold transition-all flex-1 sm:flex-initial"
                title="View Channel URL"
              >
                <Globe size={14} /> URL
              </a>
            )}
            <Link
              href={`/dashboard/channels/${channelSlug}/edit`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
              title="Edit channel settings & brand fields"
            >
              <Edit3 size={14} /> Edit
            </Link>
            <button
              type="button"
              onClick={() => setDeleteChannelModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-paper-card text-ink-muted hover:text-rose-600 hover:border-rose-300 text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-initial"
              title="Delete this channel"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              type="button"
              onClick={handleOpenCreatePillar}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer w-full sm:w-auto"
            >
              <Plus size={14} /> Add Pillar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading workspace metadata...</p>
        </section>
      ) : (
        <>
          {/* SECTION 1: CONTENT PILLARS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-signal" />
                <h2 className="text-lg font-display font-semibold text-ink">
                  Content Pillars
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-muted">
                {pillars.length} Registered
              </span>
            </div>

            {pillars.length === 0 ? (
              <div className="p-8 border border-line bg-paper-card text-center space-y-3">
                <p className="text-xs text-ink-muted">
                  No content pillars established yet for this channel.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreatePillar}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-signal text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus size={14} /> Establish First Pillar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.slug}
                    className="p-5 border border-line bg-paper-card hover:border-signal/40 transition-all relative flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-line bg-paper font-semibold text-ink-muted">
                          {pillar.tag || "Pillar"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditPillar(pillar, e)}
                            className="p-1 text-ink-muted hover:text-signal transition-colors cursor-pointer"
                            title="Edit pillar"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeletePillar(pillar.slug, e)}
                            className="p-1 text-ink-muted hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete pillar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/channels/${channelSlug}/content_pillar/${pillar.slug}`}
                        className="block group"
                      >
                        <h3 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
                          {pillar.name}
                        </h3>
                        <p className="text-xs text-ink-muted mt-2 line-clamp-2 leading-relaxed">
                          {pillar.description || "Content pillar guidelines and angle directives."}
                        </p>
                      </Link>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
                      <span className="text-ink-muted font-mono text-[11px]">
                        {topics.filter((t) => t.pillarSlug === pillar.slug || t.pillar === pillar.name).length} Topics
                      </span>
                      <Link
                        href={`/dashboard/channels/${channelSlug}/content_pillar/${pillar.slug}`}
                        className="text-signal hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        View Pillar <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 2: PRODUCTION TOPICS */}
          <section className="space-y-4 pt-6 border-t border-line">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Film size={18} className="text-signal shrink-0" />
                <h2 className="text-lg font-display font-semibold text-ink">
                  Story Topics & Studio Episodes
                </h2>
                <span className="text-xs font-mono text-ink-muted ml-1 sm:ml-2 shrink-0">
                  ({filteredTopics.length})
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <Search size={14} className="absolute left-3 top-2.5 text-ink-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics..."
                    className="h-9 sm:h-8 w-full pl-8 pr-3 text-xs border border-line bg-paper-card text-ink outline-none focus:border-signal"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateTopic}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-signal hover:bg-signal-hover active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer w-full sm:w-auto shrink-0"
                >
                  <Plus size={14} /> New Content Topic
                </button>
              </div>
            </div>

            {/* Pillar Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedPillarFilter("All")}
                className={`px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${selectedPillarFilter === "All"
                  ? "bg-signal text-white border-signal"
                  : "bg-paper-card text-ink-muted border-line hover:text-ink"
                  }`}
              >
                All Pillars ({topics.length})
              </button>
              {pillars.map((pillar) => (
                <button
                  key={pillar.slug}
                  type="button"
                  onClick={() => setSelectedPillarFilter(pillar.slug)}
                  className={`px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${selectedPillarFilter === pillar.slug
                    ? "bg-signal text-white border-signal"
                    : "bg-paper-card text-ink-muted border-line hover:text-ink"
                    }`}
                >
                  {pillar.name}
                </button>
              ))}
            </div>

            {/* Topic List */}
            {filteredTopics.length === 0 ? (
              <div className="p-8 border border-line bg-paper-card text-center space-y-3">
                <p className="text-xs text-ink-muted">No topic episodes found in this filter.</p>
                <button
                  type="button"
                  onClick={handleOpenCreateTopic}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-signal text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus size={14} /> New Content Topic
                </button>
              </div>
            ) : (
              <div className="divide-y divide-line border border-line bg-paper-card">
                {filteredTopics.map((topic) => (
                  <div
                    key={topic.slug}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-ink/[0.015] transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {topic.pillarName && (
                        <span className="inline-block text-[11px] font-mono text-signal/80 bg-signal/5 px-2 py-0.5 border border-signal/10">
                          {topic.pillarName}
                        </span>
                      )}

                      <Link
                        href={`/dashboard/channels/${channelSlug}/topic/${topic.slug}`}
                        className="text-sm sm:text-base font-semibold text-ink hover:text-signal transition-colors block break-words"
                      >
                        {topic.title}
                      </Link>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                      <Link
                        href={`/dashboard/channels/${channelSlug}/topic/${topic.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold transition-all cursor-pointer w-full sm:w-auto"
                      >
                        Open Studio <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 3: COMPLETED VIDEOS ARCHIVE */}
          <section className="space-y-4 pt-6 border-t border-line">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-signal" />
                <h2 className="text-lg font-display font-semibold text-ink">
                  Rendered & Mastered Videos
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-muted">
                {completedVideos.length} Master Cuts
              </span>
            </div>

            {completedVideos.length === 0 ? (
              <div className="p-8 border border-line bg-paper-card text-center space-y-2">
                <p className="text-xs text-ink-muted">
                  No completed master video cuts rendered yet for this channel.
                </p>
                <p className="text-[11px] text-ink-muted/80">
                  Assemble scene frames and master cuts inside the Topic Studio to populate this archive.
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
          </section>
        </>
      )}

      {/* CREATE / EDIT PILLAR MODAL */}
      {mounted && createPillarModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-lg bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-signal" />
                <h3 className="text-lg font-display font-semibold text-ink">
                  {editingPillarSlug ? "Edit Content Pillar" : "Establish Content Pillar"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatePillarModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePillar} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-name">
                  Pillar Name *
                </label>
                <input
                  id="p-name"
                  required
                  type="text"
                  value={pillarName}
                  onChange={(e) => setPillarName(e.target.value)}
                  placeholder="e.g. Monetary History & Crises"
                  className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-tag">
                  Category Tag
                </label>
                <input
                  id="p-tag"
                  type="text"
                  value={pillarTag}
                  onChange={(e) => setPillarTag(e.target.value)}
                  placeholder="e.g. Macroeconomics, Deep Botany"
                  className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-desc">
                  Strategic Description
                </label>
                <textarea
                  id="p-desc"
                  rows={3}
                  value={pillarDescription}
                  onChange={(e) => setPillarDescription(e.target.value)}
                  placeholder="The thematic boundary, core premise, and perspective of this pillar..."
                  className="w-full p-2.5 border border-line-dark bg-white text-ink outline-none focus:border-signal leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreatePillarModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-signal hover:bg-signal-hover text-white font-semibold transition-all cursor-pointer"
                >
                  {editingPillarSlug ? "Save Changes" : "Create Pillar"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE TOPIC MODAL */}
      {mounted && createTopicModalOpen && createPortal(
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
                onClick={() => setCreateTopicModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="t-titles">
                  Topic Name(s) *
                </label>
                <p className="text-[11px] text-ink-muted mb-2">
                  Enter one or multiple topic names (one per line) to upload multiple topics at once.
                </p>
                <textarea
                  id="t-titles"
                  required
                  rows={4}
                  value={topicTitles}
                  onChange={(e) => setTopicTitles(e.target.value)}
                  placeholder={`e.g.\nThe 1971 Gold Window Default That Changed Global Trade\nHow Central Banks Manage Shadow Liquidity Flows\nThe Anatomy of a Sovereign Debt Spiral`}
                  className="w-full p-3 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal"
                />
              </div>

              {pillars.length > 0 && (
                <div>
                  <label className="block font-semibold text-ink/80 mb-1" htmlFor="t-pillar">
                    Assign Content Pillar (Optional)
                  </label>
                  <select
                    id="t-pillar"
                    value={topicPillar}
                    onChange={(e) => setTopicPillar(e.target.value)}
                    className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal cursor-pointer"
                  >
                    <option value="">-- No Content Pillar (Unassigned) --</option>
                    {pillars.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreateTopicModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTopics}
                  className="px-5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  {creatingTopics ? <Loader2 size={14} className="animate-spin" /> : null}
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

      {/* DELETE CHANNEL MODAL */}
      {mounted && deleteChannelModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-md bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2 border border-rose-200">
              <Trash2 size={20} />
            </div>

            <div>
              <h3 className="text-xl font-display font-semibold text-ink tracking-tight">
                Delete {channelTitle}?
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                Are you sure you want to delete this channel? All associated content pillars, story topics, and settings will be permanently removed from the database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteChannelModalOpen(false)}
                className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteChannel}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete Channel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

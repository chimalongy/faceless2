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
  Filter,
  Film,
  Video,
  Play,
  MoreVertical,
  X,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Compass,
  Check,
  Eye,
  Volume2,
  Globe,
  Shield,
  Image as ImageIcon,
  Copy
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

// Default content pillars categorized by channel niche
const defaultPillarsBySlug = {
  "field-notes": [
    {
      id: "p-1",
      name: "Deep Wilderness & Flora",
      slug: "deep-wilderness-and-flora",
      description: "Exploration of rare biomes, untamed botanical marvels, and forgotten forests.",
      color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800",
      accent: "bg-emerald-600",
      tag: "Nature & Botany",
    },
    {
      id: "p-2",
      name: "Microbial & Fungal Networks",
      slug: "microbial-and-fungal-networks",
      description: "Invisible ecosystems underground, mycorrhizal networks, and fungal intelligence.",
      color: "border-amber-500/30 bg-amber-500/5 text-amber-800",
      accent: "bg-amber-600",
      tag: "Biology",
    },
    {
      id: "p-3",
      name: "Atmospheric & Geological Wonders",
      slug: "atmospheric-and-geological-wonders",
      description: "Severe meteorological events, volcanic cycles, and deep planetary dynamics.",
      color: "border-sky-500/30 bg-sky-500/5 text-sky-800",
      accent: "bg-sky-600",
      tag: "Earth Science",
    },
  ],
  "the-quiet-ledger": [
    {
      id: "p-1",
      name: "Monetary History & Crises",
      slug: "monetary-history-and-crises",
      description: "Deep historical breakdowns of financial collapses, hyperinflation, and banking.",
      color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-800",
      accent: "bg-indigo-600",
      tag: "Macroeconomics",
    },
    {
      id: "p-2",
      name: "Asymmetric Wealth Strategies",
      slug: "asymmetric-wealth-strategies",
      description: "How ultra-wealthy dynasties preserve and quietly compound sovereign assets.",
      color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800",
      accent: "bg-emerald-600",
      tag: "Capital Preservation",
    },
    {
      id: "p-3",
      name: "Shadow Banking & Liquidity",
      slug: "shadow-banking-and-liquidity",
      description: "Repo markets, central bank currency swaps, and unseen systemic flows.",
      color: "border-amber-500/30 bg-amber-500/5 text-amber-800",
      accent: "bg-amber-600",
      tag: "Liquidity",
    },
  ],
};

const genericPillars = [
  {
    id: "p-1",
    name: "Foundational Deep Dives",
    description: "Core explanations breaking down complex topics for first-time viewers.",
    color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-800",
    accent: "bg-indigo-600",
    tag: "Core Thesis",
  },
  {
    id: "p-2",
    name: "Historical Case Studies",
    description: "Chronological retrospectives and cautionary lessons from pivotal historical events.",
    color: "border-amber-500/30 bg-amber-500/5 text-amber-800",
    accent: "bg-amber-600",
    tag: "History",
  },
  {
    id: "p-3",
    name: "Emerging Trends & Analysis",
    description: "Investigative projections and future paradigms shaping the upcoming decade.",
    color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800",
    accent: "bg-emerald-600",
    tag: "Future Outlook",
  },
];

const initialTopicsBySlug = {
  "field-notes": [
    {
      id: "top-1",
      title: "How Ancient Mycelium Shaped Earth's First Soil",
      pillar: "Microbial & Fungal Networks",
      stage: "Scripting",
      duration: "16:40",
      scheduledFor: "Aug 26, 2026",
      hook: "400 million years ago, Earth had no soil until a silent network emerged.",
    },
    {
      id: "top-2",
      title: "The Ghost Forests of the Pacific Northwest",
      pillar: "Deep Wilderness & Flora",
      stage: "Voice Synthesis",
      duration: "14:15",
      scheduledFor: "Aug 29, 2026",
      hook: "Drowned by tsunami tides in 1700, their cedar trunks remain petrified in silence.",
    },
    {
      id: "top-3",
      title: "Supercell Anatomy: The Mechanics of Atmospheric Inversions",
      pillar: "Atmospheric & Geological Wonders",
      stage: "Ideation",
      duration: "18:00",
      scheduledFor: "Draft",
      hook: "Inside the rotating updraft that defies conventional thermodynamic models.",
    },
    {
      id: "top-4",
      title: "Bioluminescence In Deep Subterranean Caves",
      pillar: "Microbial & Fungal Networks",
      stage: "Rendering",
      duration: "12:50",
      scheduledFor: "Tomorrow, 7:00 PM",
      hook: "Creatures surviving miles beneath sunlight with their own chemical lanterns.",
    },
  ],
};

const initialCompletedVideos = [
  {
    id: "comp-1",
    title: "Why The Oldest Trees Don't Die of Old Age",
    pillar: "Deep Wilderness & Flora",
    duration: "15:24",
    publishedDate: "Aug 12, 2026",
    views: "148,200",
    status: "Published",
    retention: "64.2%",
  },
  {
    id: "comp-2",
    title: "The 1816 Year Without A Summer: Volcanic Winter",
    pillar: "Atmospheric & Geological Wonders",
    duration: "21:05",
    publishedDate: "Aug 02, 2026",
    views: "312,900",
    status: "Published",
    retention: "71.8%",
  },
  {
    id: "comp-3",
    title: "Slime Molds Solving Tokyo's Railway Network",
    pillar: "Microbial & Fungal Networks",
    duration: "13:48",
    publishedDate: "Jul 21, 2026",
    views: "520,400",
    status: "Published",
    retention: "68.9%",
  },
];

export default function ChannelWorkspace() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.["channel-name"] || "field-notes";
  const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const channelTitle = channelSlug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  // Content Pillars state
  const [pillars, setPillars] = useState(
    defaultPillarsBySlug[channelSlug] || genericPillars
  );
  const [selectedPillarFilter, setSelectedPillarFilter] = useState("All");

  // Topics / In-progress list state
  const [topics, setTopics] = useState(
    initialTopicsBySlug[channelSlug] || [
      {
        id: "top-1",
        title: "The Anatomy of Sovereign Wealth Funds",
        pillar: "Monetary History & Crises",
        stage: "Scripting",
        duration: "15:30",
        scheduledFor: "Aug 28, 2026",
        hook: "How state-backed trillions quietly influence global tech infrastructure.",
      },
    ]
  );

  // Completed videos state
  const [completedVideos, setCompletedVideos] = useState(initialCompletedVideos);

  // Modals / forms state
  const [pillarModalOpen, setPillarModalOpen] = useState(false);
  const [deleteChannelModalOpen, setDeleteChannelModalOpen] = useState(false);
  const [editingPillar, setEditingPillar] = useState(null);
  const [pillarForm, setPillarForm] = useState({
    name: "",
    tag: "",
    description: "",
  });

  const [channelProfile, setChannelProfile] = useState(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("faceless_channels");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const found = parsed.find((c) => c.slug === channelSlug);
          if (found) setChannelProfile(found);
        }
      }
    } catch {
      // Ignore
    }
  }, [channelSlug]);

  function handleCopyJson() {
    const cp = channelProfile || {};
    const nestedData = {
      channel: {
        name: cp.name || channelTitle,
        slug: cp.slug || channelSlug,
        handle: cp.handle || `@${channelSlug}`,
        channel_url: cp.channelUrl || `https://youtube.com/@${channelSlug}`,
        tagline: cp.tagline || "",
        description: cp.description || "",
        status: cp.status || "Active",
        videos: cp.videos || completedVideos.length || 0
      },
      niche_and_audience: {
        niche: cp.niche || "Documentaries",
        sub_niche: cp.subNiche || "",
        content_category: cp.contentCategory || "Education & Documentaries",
        target_audience: cp.targetAudience || ""
      },
      brand_strategy: {
        mission: cp.mission || "",
        value_proposition: cp.valueProposition || "",
        personality: cp.personality || "",
        brand_positioning: cp.brandPositioning || "",
        brand_promise: cp.brandPromise || ""
      },
      creative_themes: {
        image_theme: cp.imageTheme || "",
        thumbnail_theme: cp.thumbnailTheme || "",
        audio_theme: cp.audioTheme || ""
      }
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(nestedData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleDeleteChannel() {
    try {
      const stored = localStorage.getItem("faceless_channels");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((c) => c.slug !== channelSlug);
          localStorage.setItem("faceless_channels", JSON.stringify(filtered));
        }
      }
    } catch {
      // Ignore errors
    }
    router.push("/dashboard");
  }

  useEffect(() => {
    if (pillarModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [pillarModalOpen]);

  // Mark topic as completed
  function handleMarkAsCompleted(topic) {
    handleDeleteTopic(topic.id);
    const newCompleted = {
      id: `comp-${Date.now()}`,
      title: topic.title,
      pillar: topic.pillar,
      duration: topic.duration,
      publishedDate: "Just now",
      views: "1,200",
      status: "Master Ready",
      retention: "65.0%",
    };
    setCompletedVideos((prev) => [newCompleted, ...prev]);
  }

  // Open Create Pillar Modal
  function handleOpenCreatePillar() {
    setEditingPillar(null);
    setPillarForm({ name: "", tag: "", description: "" });
    setPillarModalOpen(true);
  }

  // Open Edit Pillar Modal
  function handleOpenEditPillar(pillar) {
    setEditingPillar(pillar);
    setPillarForm({
      name: pillar.name,
      tag: pillar.tag,
      description: pillar.description,
    });
    setPillarModalOpen(true);
  }

  // Save Pillar Form
  function handleSavePillar(e) {
    e.preventDefault();
    if (!pillarForm.name.trim()) return;

    if (editingPillar) {
      setPillars((prev) =>
        prev.map((p) =>
          p.id === editingPillar.id
            ? {
                ...p,
                name: pillarForm.name.trim(),
                tag: pillarForm.tag.trim() || "General",
                description: pillarForm.description.trim(),
              }
            : p
        )
      );
    } else {
      const colors = [
        "border-emerald-500/30 bg-emerald-500/5 text-emerald-800",
        "border-amber-500/30 bg-amber-500/5 text-amber-800",
        "border-sky-500/30 bg-sky-500/5 text-sky-800",
        "border-rose/30 bg-rose/5 text-rose",
        "border-indigo-500/30 bg-indigo-500/5 text-indigo-800",
      ];
      const selectedColor = colors[pillars.length % colors.length];

      const newPillar = {
        id: `p-${Date.now()}`,
        name: pillarForm.name.trim(),
        tag: pillarForm.tag.trim() || "Strategy",
        description: pillarForm.description.trim(),
        color: selectedColor,
        accent: "bg-signal",
      };
      setPillars((prev) => [...prev, newPillar]);
    }
    setPillarModalOpen(false);
  }

  // Delete Pillar
  function handleDeletePillar(pillarId, pillarName) {
    setPillars((prev) => prev.filter((p) => p.id !== pillarId));
    if (selectedPillarFilter === pillarName) {
      setSelectedPillarFilter("All");
    }
  }

  // Delete Completed Video
  function handleDeleteCompleted(id) {
    setCompletedVideos((prev) => prev.filter((v) => v.id !== id));
  }

  // Filter topics
  const filteredTopics = topics.filter((t) => {
    if (selectedPillarFilter === "All") return true;
    return t.pillar === selectedPillarFilter;
  });

  return (
    <div className="space-y-10 animate-card-rise">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to channels
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                Channel Operations
              </span>
              <span className="text-xs font-mono text-ink-muted">
                {channelProfile?.handle || `/@${channelSlug}`}
              </span>
              {channelProfile?.status && (
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-signal/10 text-signal border border-signal/20 font-semibold">
                  {channelProfile.status}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-display font-semibold text-ink tracking-tight">
              {channelProfile?.name || channelTitle}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
              {channelProfile?.tagline || channelProfile?.description || "Automated long-form documentary production desk."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
              title="Copy full nested JSON schema of channel brand architecture"
            >
              {copiedJson ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-700">Copied JSON!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
            {channelProfile?.channelUrl && (
              <a
                href={channelProfile.channelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-line bg-paper-card text-ink-muted hover:text-ink text-xs font-semibold transition-all"
                title="View Channel URL"
              >
                <Globe size={14} /> URL
              </a>
            )}
            <Link
              href={`/dashboard/channels/${channelSlug}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
              title="Edit channel settings & 16 brand fields"
            >
              <Edit3 size={14} /> Edit Channel
            </Link>
            <button
              type="button"
              onClick={() => setDeleteChannelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-line bg-paper-card text-ink-muted hover:text-rose-600 hover:border-rose-300 text-xs font-semibold transition-all cursor-pointer"
              title="Delete this channel"
            >
              <Trash2 size={14} /> Delete Channel
            </button>
            <button
              type="button"
              onClick={handleOpenCreatePillar}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              <Plus size={15} /> Add Pillar
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: CONTENT PILLARS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-signal" />
            <h2 className="text-lg font-display font-semibold text-ink">
              Content Pillars
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pillars.map((pillar) => {
            const pillarSlug = pillar.slug || toPillarSlug(pillar.name);
            const count = topics.filter((t) => t.pillar === pillar.name).length;
            const completedCount = completedVideos.filter((v) => v.pillar === pillar.name).length;

            return (
              <div
                key={pillar.id}
                className="p-5 border border-line bg-paper-card hover:border-signal/40 hover:shadow-xs transition-all flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-semibold tracking-wider bg-ink/5 text-ink-muted border border-line">
                      {pillar.tag || "Pillar"}
                    </span>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleOpenEditPillar(pillar);
                        }}
                        className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                        title="Edit pillar"
                        aria-label="Edit pillar"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeletePillar(pillar.id, pillar.name);
                        }}
                        className="p-1.5 rounded-md text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete pillar"
                        aria-label="Delete pillar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}`}
                    className="block group-hover:text-signal transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
                        {pillar.name}
                      </h3>
                      <ChevronRight size={15} className="text-ink-muted/40 group-hover:text-signal group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-xs text-ink-muted mt-2 leading-relaxed line-clamp-2">
                      {pillar.description}
                    </p>
                  </Link>
                </div>

                <Link
                  href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}`}
                  className="pt-4 mt-4 border-t border-line/60 flex items-center justify-between text-xs font-mono text-ink-muted group-hover:text-ink transition-colors"
                >
                  <span>{count} active topics</span>
                  <span>{completedCount} published →</span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: COMPLETED VIDEOS */}
      <section className="space-y-4 pt-4 border-t border-line">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Film size={18} className="text-emerald-700" />
              <h2 className="text-lg font-display font-semibold text-ink">
                Completed Videos
              </h2>
              <span className="text-xs font-mono text-ink-muted">
                ({completedVideos.length} masters archived)
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Rendered master videos, published releases, and catalog performance metrics.
            </p>
          </div>
        </div>

        {completedVideos.length === 0 ? (
          <div className="p-8 border border-line bg-paper-card text-center text-xs text-ink-muted">
            No completed videos yet. Mark an active topic as completed to catalog it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  <h3 className="text-sm font-semibold text-ink leading-snug line-clamp-2">
                    {video.title}
                  </h3>

                  <p className="text-xs font-mono text-ink-muted mt-1.5">
                    Pillar: {video.pillar}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-line/60 flex items-center justify-between text-xs">
                  <div className="space-y-0.5 font-mono text-[11px] text-ink-muted">
                    <span>{video.duration} duration</span>
                    <span className="block text-ink font-semibold">{video.views} views</span>
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
                      title="Play master render preview"
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


      {/* PILLAR MODAL VIA REACT PORTAL (FULL SCREEN) */}
      {mounted &&
        pillarModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
            style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          >
            <div className="relative w-full max-w-md bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-lg font-display font-semibold text-ink">
                  {editingPillar ? "Edit Content Pillar" : "Add Content Pillar"}
                </h3>
                <button
                  type="button"
                  onClick={() => setPillarModalOpen(false)}
                  className="p-1.5 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePillar} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="pillar-name">
                    Pillar Name *
                  </label>
                  <input
                    id="pillar-name"
                    type="text"
                    required
                    placeholder="e.g., Deep Geological Wonders"
                    value={pillarForm.name}
                    onChange={(e) => setPillarForm({ ...pillarForm, name: e.target.value })}
                    className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="pillar-tag">
                    Category Tag
                  </label>
                  <input
                    id="pillar-tag"
                    type="text"
                    placeholder="e.g., Earth Science, Finance, History"
                    value={pillarForm.tag}
                    onChange={(e) => setPillarForm({ ...pillarForm, tag: e.target.value })}
                    className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="pillar-desc">
                    Strategic Description
                  </label>
                  <textarea
                    id="pillar-desc"
                    rows={3}
                    placeholder="Explain what topics fit into this pillar and why it appeals to your audience..."
                    value={pillarForm.description}
                    onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })}
                    className="w-full p-3 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setPillarModalOpen(false)}
                    className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                  >
                    {editingPillar ? "Save Pillar" : "Create Pillar"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* DELETE CHANNEL CONFIRMATION MODAL */}
      {mounted &&
        deleteChannelModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
            style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteChannelModalOpen(false);
            }}
          >
            <div className="relative w-full max-w-md bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
              <button
                type="button"
                className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                aria-label="Close"
                onClick={() => setDeleteChannelModalOpen(false)}
              >
                <X size={18} />
              </button>

              <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2 border border-rose-200">
                <Trash2 size={20} />
              </div>

              <div>
                <h3 className="text-xl font-display font-semibold text-ink tracking-tight">
                  Delete {channelTitle}?
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                  Are you sure you want to delete this channel? All associated content pillars, story topics, and settings will be permanently removed from your workspace.
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


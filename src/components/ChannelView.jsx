"use client";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ChevronRight,
  Globe,
  Copy,
  Check,
  Loader2,
  ClipboardPaste,
  Film,
  Video,
  FileText,
  Image as ImageIcon,
  Youtube,
  X,
  Sparkles,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

function toPillarSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractPillarFromJson(item) {
  if (!item || typeof item !== "object") return null;

  const target = item.content_pillar || item.pillar || item;

  const name =
    target.name ||
    target.pillar_name ||
    target.title ||
    target.pillarName ||
    target.pillarTitle ||
    "";

  if (!name || typeof name !== "string") return null;

  const tag = target.tag || target.category || target.category_tag || target.categoryTag || "";
  const description =
    target.description ||
    target.strategic_description ||
    target.strategicDescription ||
    target.summary ||
    "";
  const tone =
    target.tone ||
    target.narrative_tone ||
    target.voice_tone ||
    target.narrativeTone ||
    target.voiceTone ||
    "";
  const contentLength =
    target.content_length ||
    target.contentLength ||
    target.length ||
    target.target_length ||
    target.targetLength ||
    target.target_content_length ||
    target.targetContentLength ||
    "";
  const contentWordsCount =
    target.content_words_count ||
    target.contentWordsCount ||
    target.words_count ||
    target.word_count ||
    target.wordsCount ||
    target.wordCount ||
    target.target_word_count ||
    target.targetWordsCount ||
    target.target_words_count ||
    "";
  const useMainCharacter = Boolean(
    target.use_main_character ??
    target.useMainCharacter ??
    target.has_main_character ??
    target.hasMainCharacter ??
    target.main_character_active ??
    (target.main_character_description || target.mainCharacterDescription)
  );
  const mainCharacterDescription =
    target.main_character_description ||
    target.mainCharacterDescription ||
    target.character_description ||
    target.characterDescription ||
    target.character ||
    "";

  return {
    name: String(name).trim(),
    tag: String(tag).trim(),
    description: String(description).trim(),
    tone: String(tone).trim(),
    contentLength: String(contentLength).trim(),
    contentWordsCount: String(contentWordsCount).trim(),
    useMainCharacter,
    mainCharacterDescription: String(mainCharacterDescription).trim(),
  };
}

function parsePillarsJsonText(rawText) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return { success: false, error: "Please enter valid JSON." };
  }

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    let extracted = [];

    if (Array.isArray(parsed)) {
      extracted = parsed.map(extractPillarFromJson).filter(Boolean);
    } else if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed.content_pillars)) {
        extracted = parsed.content_pillars.map(extractPillarFromJson).filter(Boolean);
      } else if (Array.isArray(parsed.pillars)) {
        extracted = parsed.pillars.map(extractPillarFromJson).filter(Boolean);
      } else {
        const single = extractPillarFromJson(parsed);
        if (single) extracted = [single];
      }
    }

    if (extracted.length === 0) {
      return {
        success: false,
        error: "Could not find valid content pillars in the provided JSON.",
      };
    }

    return { success: true, pillars: extracted };
  } catch (err) {
    return { success: false, error: "JSON parse error: " + err.message };
  }
}

export function isTopicPosted(topic) {
  if (!topic) return false;
  return Boolean(
    (topic.youtubeUrl && topic.youtubeUrl.trim() !== "") ||
    (topic.youtubeVideoId && topic.youtubeVideoId.trim() !== "")
  );
}

export function isTopicCompleted(topic) {
  if (!topic) return false;
  const hasThumb = Boolean(topic.thumbnailUrl && topic.thumbnailUrl.trim() !== "" && topic.thumbnailUrl !== "generated");
  const hasDesc = Boolean(topic.storyDescription && topic.storyDescription.trim() !== "");
  const hasMaster = Boolean(topic.masterVideoUrl && topic.masterVideoUrl.trim() !== "" && topic.masterVideoUrl !== "generated");
  const isComplete = hasThumb && hasDesc && hasMaster;
  const isPosted = isTopicPosted(topic);
  return isComplete && !isPosted;
}

export function isTopicUncompleted(topic) {
  if (!topic) return true;
  const hasThumb = Boolean(topic.thumbnailUrl && topic.thumbnailUrl.trim() !== "" && topic.thumbnailUrl !== "generated");
  const hasDesc = Boolean(topic.storyDescription && topic.storyDescription.trim() !== "");
  const hasMaster = Boolean(topic.masterVideoUrl && topic.masterVideoUrl.trim() !== "" && topic.masterVideoUrl !== "generated");
  const isComplete = hasThumb && hasDesc && hasMaster;
  return !isComplete;
}

export default function ChannelView({ activeTab = "content-pillars" }) {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.["channel-name"] || "";
  const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channelProfile, setChannelProfile] = useState(null);
  const [pillars, setPillars] = useState([]);
  const [topics, setTopics] = useState([]);

  // UI States
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedPillarsJson, setCopiedPillarsJson] = useState(false);
  const [copiedSinglePillarSlug, setCopiedSinglePillarSlug] = useState(null);
  const [pillarSuccessNotice, setPillarSuccessNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPillarFilter, setSelectedPillarFilter] = useState("All");

  // Modals
  const [createPillarModalOpen, setCreatePillarModalOpen] = useState(false);
  const [editingPillarSlug, setEditingPillarSlug] = useState(null);
  const [pastePillarModalOpen, setPastePillarModalOpen] = useState(false);
  const [pastedPillarsJson, setPastedPillarsJson] = useState("");
  const [pastePillarError, setPastePillarError] = useState("");
  const [isSavingPillars, setIsSavingPillars] = useState(false);
  const [deleteChannelModalOpen, setDeleteChannelModalOpen] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  // Form states for single pillar creation/editing
  const [pillarName, setPillarName] = useState("");
  const [pillarTag, setPillarTag] = useState("");
  const [pillarDescription, setPillarDescription] = useState("");
  const [pillarTone, setPillarTone] = useState("");
  const [pillarContentLength, setPillarContentLength] = useState("");
  const [pillarContentWordsCount, setPillarContentWordsCount] = useState("");
  const [pillarUseMainChar, setPillarUseMainChar] = useState(false);
  const [pillarMainCharDesc, setPillarMainCharDesc] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadWorkspaceData() {
    if (!channelSlug) return;
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

  // Topic groupings
  const postedTopics = useMemo(() => {
    return topics.filter(isTopicPosted);
  }, [topics]);

  const completedTopics = useMemo(() => {
    return topics.filter(isTopicCompleted);
  }, [topics]);

  const uncompletedTopics = useMemo(() => {
    return topics.filter(isTopicUncompleted);
  }, [topics]);

  // Filter topics based on active tab search and pillar
  const displayedTopics = useMemo(() => {
    let list = [];
    if (activeTab === "posted") {
      list = postedTopics;
    } else if (activeTab === "completed") {
      list = completedTopics;
    } else {
      list = uncompletedTopics;
    }

    return list.filter((t) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.pillarName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPillar =
        selectedPillarFilter === "All" ||
        t.pillarSlug === selectedPillarFilter ||
        t.pillarName === selectedPillarFilter;

      return matchesSearch && matchesPillar;
    });
  }, [activeTab, postedTopics, completedTopics, uncompletedTopics, searchQuery, selectedPillarFilter]);

  function handleCopyJson() {
    const nestedData = {
      channel: {
        name: channelProfile?.name || channelSlug,
        slug: channelSlug,
        handle: channelProfile?.handle || `@${channelSlug}`,
        channel_url: channelProfile?.channelUrl || `https://youtube.com/@${channelSlug}`,
        tagline: channelProfile?.tagline || "",
        description: channelProfile?.description || "",
        default_voice: channelProfile?.defaultVoice || "af_heart",
        status: channelProfile?.status || "Active",
      },
      niche_and_audience: {
        niche: channelProfile?.niche || "",
        sub_niche: channelProfile?.subNiche || "",
        content_category: channelProfile?.contentCategory || "",
        target_audience: channelProfile?.targetAudience || "",
      },
      brand_strategy: {
        mission: channelProfile?.mission || "",
        value_proposition: channelProfile?.valueProposition || "",
        personality: channelProfile?.personality || "",
        brand_positioning: channelProfile?.brandPositioning || "",
        brand_promise: channelProfile?.brandPromise || "",
      },
      creative_themes: {
        image_theme: channelProfile?.imageTheme || "",
        thumbnail_theme: channelProfile?.thumbnailTheme || "",
        audio_theme: channelProfile?.audioTheme || "",
      },
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(nestedData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {}
  }

  function handleCopyAllPillarsJson() {
    const data = pillars.map((p) => ({
      name: p.name,
      slug: p.slug,
      tag: p.tag || "",
      description: p.description || "",
      tone: p.tone || "",
      content_length: p.contentLength || p.content_length || "15-20 minutes (~2500 words)",
      content_words_count: p.contentWordsCount || p.content_words_count || "2,500 - 3,500 words",
      use_main_character: Boolean(p.useMainCharacter ?? p.use_main_character),
      main_character_description: p.mainCharacterDescription || p.main_character_description || "",
    }));

    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedPillarsJson(true);
      setTimeout(() => setCopiedPillarsJson(false), 2000);
    } catch {}
  }

  function handleCopySinglePillarJson(pillar, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const data = {
      name: pillar.name,
      slug: pillar.slug,
      tag: pillar.tag || "",
      description: pillar.description || "",
      tone: pillar.tone || "",
      content_length: pillar.contentLength || pillar.content_length || "15-20 minutes (~2500 words)",
      content_words_count: pillar.contentWordsCount || pillar.content_words_count || "2,500 - 3,500 words",
      use_main_character: Boolean(pillar.useMainCharacter ?? pillar.use_main_character),
      main_character_description: pillar.mainCharacterDescription || pillar.main_character_description || "",
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedSinglePillarSlug(pillar.slug);
      setTimeout(() => setCopiedSinglePillarSlug(null), 2000);
    } catch {}
  }

  async function handleDeleteChannel() {
    try {
      setIsDeletingChannel(true);
      const res = await fetch(`/api/channels/${channelSlug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete channel:", err);
    } finally {
      setIsDeletingChannel(false);
      setDeleteChannelModalOpen(false);
    }
  }

  function handleOpenCreatePillar() {
    setEditingPillarSlug(null);
    setPillarName("");
    setPillarTag("");
    setPillarDescription("");
    setPillarTone("");
    setPillarContentLength("15-20 minutes (~2500 words)");
    setPillarContentWordsCount("2,500 - 3,500 words");
    setPillarUseMainChar(false);
    setPillarMainCharDesc("");
    setCreatePillarModalOpen(true);
  }

  function handleOpenEditPillar(pillar, e) {
    if (e) e.stopPropagation();
    setEditingPillarSlug(pillar.slug);
    setPillarName(pillar.name);
    setPillarTag(pillar.tag || "");
    setPillarDescription(pillar.description || "");
    setPillarTone(pillar.tone || "");
    setPillarContentLength(pillar.contentLength || pillar.content_length || "15-20 minutes (~2500 words)");
    setPillarContentWordsCount(pillar.contentWordsCount || pillar.content_words_count || "2,500 - 3,500 words");
    setPillarUseMainChar(Boolean(pillar.useMainCharacter ?? pillar.use_main_character));
    setPillarMainCharDesc(pillar.mainCharacterDescription || pillar.main_character_description || "");
    setCreatePillarModalOpen(true);
  }

  async function handleDeletePillar(slug, e) {
    if (e) e.stopPropagation();
    if (!confirm(`Are you sure you want to delete pillar "${slug}"?`)) return;

    try {
      const res = await fetch(`/api/channels/${channelSlug}/pillars/${slug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPillars((prev) => prev.filter((p) => p.slug !== slug));
        setPillarSuccessNotice("Content pillar deleted successfully.");
        setTimeout(() => setPillarSuccessNotice(""), 4000);
      }
    } catch (err) {
      console.error("Failed to delete pillar:", err);
    }
  }

  async function handleSavePillar(e) {
    e.preventDefault();
    if (!pillarName.trim()) return;

    const slug = editingPillarSlug || toPillarSlug(pillarName);
    const payload = {
      name: pillarName.trim(),
      slug,
      tag: pillarTag.trim(),
      description: pillarDescription.trim(),
      tone: pillarTone.trim(),
      contentLength: pillarContentLength.trim(),
      contentWordsCount: pillarContentWordsCount.trim(),
      useMainCharacter: pillarUseMainChar,
      mainCharacterDescription: pillarMainCharDesc.trim(),
    };

    try {
      const res = await fetch(`/api/channels/${channelSlug}/pillars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCreatePillarModalOpen(false);
        loadWorkspaceData();
        setPillarSuccessNotice(
          editingPillarSlug
            ? `Pillar "${payload.name}" updated successfully.`
            : `Pillar "${payload.name}" created successfully.`
        );
        setTimeout(() => setPillarSuccessNotice(""), 4000);
      }
    } catch (err) {
      console.error("Failed to save pillar:", err);
    }
  }

  function handleOpenPastePillarModal() {
    setPastedPillarsJson("");
    setPastePillarError("");
    setPastePillarModalOpen(true);
  }

  async function handleImportPastedPillars(e) {
    e.preventDefault();
    setPastePillarError("");

    const parsedResult = parsePillarsJsonText(pastedPillarsJson);
    if (!parsedResult.success) {
      setPastePillarError(parsedResult.error);
      return;
    }

    setIsSavingPillars(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/pillars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedResult.pillars),
      });

      if (res.ok) {
        setPastePillarModalOpen(false);
        loadWorkspaceData();
        setPillarSuccessNotice(
          `Successfully saved ${parsedResult.pillars.length} content pillar${
            parsedResult.pillars.length === 1 ? "" : "s"
          }.`
        );
        setTimeout(() => setPillarSuccessNotice(""), 5000);
      } else {
        const data = await res.json();
        setPastePillarError(data.error || "Failed to save pillars.");
      }
    } catch (err) {
      setPastePillarError("Error connecting to server: " + err.message);
    } finally {
      setIsSavingPillars(false);
    }
  }

  async function handleQuickFillPillarFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const result = parsePillarsJsonText(text);
      if (result.success && result.pillars.length > 0) {
        const p = result.pillars[0];
        setPillarName(p.name);
        setPillarTag(p.tag || "");
        setPillarDescription(p.description || "");
        setPillarTone(p.tone || "");
        setPillarContentLength(p.contentLength || "15-20 minutes (~2500 words)");
        setPillarContentWordsCount(p.contentWordsCount || "2,500 - 3,500 words");
        setPillarUseMainChar(Boolean(p.useMainCharacter));
        setPillarMainCharDesc(p.mainCharacterDescription || "");
      }
    } catch {}
  }

  const channelTitle = channelProfile?.name || channelSlug;

  return (
    <div className="space-y-6 animate-fade-in text-ink">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Link
          href="/dashboard"
          className="hover:text-ink inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Channels</span>
        </Link>
        <span>/</span>
        <span className="text-ink font-semibold">{channelTitle}</span>
      </div>

      {/* Channel Header Banner */}
      <div className="p-4 sm:p-6 border border-line bg-paper-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-signal/10 text-signal border border-signal/20 font-semibold">
                {channelProfile?.niche || "Documentary"}
              </span>
              <span className="text-xs font-mono text-ink-muted">
                {channelProfile?.handle || `@${channelSlug}`}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-ink">
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

      {/* Tabs Navigation Bar */}
      <div className="border-b border-line bg-paper-card px-2 pt-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 sm:gap-2 min-w-max">
          <Link
            href={`/dashboard/channels/${channelSlug}/content-pillars`}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "content-pillars"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <Layers size={14} />
            <span>Content Pillars</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
              {pillars.length}
            </span>
          </Link>

          <Link
            href={`/dashboard/channels/${channelSlug}/uncompleted`}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "uncompleted"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <Clock size={14} />
            <span>Uncompleted</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
              {uncompletedTopics.length}
            </span>
          </Link>

          <Link
            href={`/dashboard/channels/${channelSlug}/completed`}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "completed"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Completed</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
              {completedTopics.length}
            </span>
          </Link>

          <Link
            href={`/dashboard/channels/${channelSlug}/posted`}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "posted"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <Youtube size={14} className="text-rose-600" />
            <span>Posted</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
              {postedTopics.length}
            </span>
          </Link>
        </div>
      </div>

      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading workspace metadata...</p>
        </section>
      ) : (
        <>
          {/* TAB 1: CONTENT PILLARS */}
          {activeTab === "content-pillars" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-signal" />
                  <h2 className="text-lg font-display font-semibold text-ink">
                    Content Pillars
                  </h2>
                  <span className="text-xs font-mono text-ink-muted">
                    ({pillars.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {pillars.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyAllPillarsJson}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
                      title="Copy all content pillars as JSON array"
                    >
                      {copiedPillarsJson ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenPastePillarModal}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
                    title="Paste JSON to automatically create or update content pillars"
                  >
                    <ClipboardPaste size={14} />
                    <span>Paste JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreatePillar}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Pillar
                  </button>
                </div>
              </div>

              {pillarSuccessNotice && (
                <div className="p-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{pillarSuccessNotice}</span>
                </div>
              )}

              {pillars.length === 0 ? (
                <div className="p-8 border border-line bg-paper-card text-center space-y-3">
                  <p className="text-xs text-ink-muted">
                    No content pillars established yet for this channel.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenPastePillarModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-line text-ink text-xs font-semibold cursor-pointer hover:bg-ink/5"
                    >
                      <ClipboardPaste size={14} /> Paste JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCreatePillar}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-signal text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus size={14} /> Establish First Pillar
                    </button>
                  </div>
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
                              onClick={(e) => handleCopySinglePillarJson(pillar, e)}
                              className="p-1 text-ink-muted hover:text-signal transition-colors cursor-pointer"
                              title="Copy pillar JSON"
                            >
                              {copiedSinglePillarSlug === pillar.slug ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
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
          )}

          {/* TAB 2, 3 & 4: UNCOMPLETED, COMPLETED & POSTED TOPICS */}
          {(activeTab === "uncompleted" || activeTab === "completed" || activeTab === "posted") && (
            <section className="space-y-4">
              {/* Filter and Search Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {activeTab === "posted" ? (
                    <Youtube size={18} className="text-rose-600 shrink-0" />
                  ) : activeTab === "completed" ? (
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  ) : (
                    <Clock size={18} className="text-signal shrink-0" />
                  )}
                  <h2 className="text-lg font-display font-semibold text-ink">
                    {activeTab === "posted"
                      ? "Posted Topics"
                      : activeTab === "completed"
                      ? "Completed Topics"
                      : "Uncompleted Topics"}
                  </h2>
                  <span className="text-xs font-mono text-ink-muted">
                    ({displayedTopics.length})
                  </span>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-2.5 text-ink-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeTab} topics...`}
                    className="h-9 sm:h-8 w-full pl-8 pr-3 text-xs border border-line bg-paper-card text-ink outline-none focus:border-signal"
                  />
                </div>
              </div>

              {/* Pillar Filter Pills */}
              <div className="overflow-x-auto scrollbar-none pb-1">
                <div className="flex items-center gap-1.5 pt-1 min-w-max">
                  <button
                    type="button"
                    onClick={() => setSelectedPillarFilter("All")}
                    className={`px-3 py-1 text-xs font-medium border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                      selectedPillarFilter === "All"
                        ? "bg-signal text-white border-signal"
                        : "bg-paper-card text-ink-muted border-line hover:text-ink"
                    }`}
                  >
                    All (
                    {activeTab === "posted"
                      ? postedTopics.length
                      : activeTab === "completed"
                      ? completedTopics.length
                      : uncompletedTopics.length}
                    )
                  </button>
                  {pillars.map((pillar) => {
                    const listForCount =
                      activeTab === "posted"
                        ? postedTopics
                        : activeTab === "completed"
                        ? completedTopics
                        : uncompletedTopics;
                    const count = listForCount.filter(
                      (t) => t.pillarSlug === pillar.slug || t.pillarName === pillar.name
                    ).length;
                    return (
                      <button
                        key={pillar.slug}
                        type="button"
                        onClick={() => setSelectedPillarFilter(pillar.slug)}
                        className={`px-3 py-1 text-xs font-medium border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                          selectedPillarFilter === pillar.slug
                            ? "bg-signal text-white border-signal"
                            : "bg-paper-card text-ink-muted border-line hover:text-ink"
                        }`}
                      >
                        {pillar.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topics Table/List */}
              {displayedTopics.length === 0 ? (
                <div className="p-8 border border-line bg-paper-card text-center space-y-2">
                  <p className="text-xs text-ink-muted">
                    {activeTab === "posted"
                      ? "No posted topics found in this selection."
                      : activeTab === "completed"
                      ? "No completed topics found in this selection."
                      : "No uncompleted topics found in this selection."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line border border-line bg-paper-card">
                  {displayedTopics.map((topic) => {
                    const hasThumb = Boolean(topic.thumbnailUrl && topic.thumbnailUrl.trim() !== "" && topic.thumbnailUrl !== "generated");
                    const hasDesc = Boolean(topic.storyDescription && topic.storyDescription.trim() !== "");
                    const hasMaster = Boolean(topic.masterVideoUrl && topic.masterVideoUrl.trim() !== "" && topic.masterVideoUrl !== "generated");
                    const isPosted = isTopicPosted(topic);
                    const isFullyComplete = hasThumb && hasDesc && hasMaster;

                    return (
                      <div
                        key={topic.slug}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink/[0.015] transition-colors"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {topic.pillarName && (
                              <span className="text-[11px] font-mono text-signal/80 bg-signal/5 px-2 py-0.5 border border-signal/10">
                                {topic.pillarName}
                              </span>
                            )}
                            {isPosted ? (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-500/20 uppercase flex items-center gap-1">
                                <Youtube size={11} /> Posted to YouTube
                              </span>
                            ) : isFullyComplete ? (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase">
                                Completed
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-700 border border-amber-500/20 uppercase">
                                In Progress
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/dashboard/channels/${channelSlug}/topic/${topic.slug}`}
                            className="text-sm sm:text-base font-semibold text-ink hover:text-signal transition-colors block break-words"
                          >
                            {topic.title}
                          </Link>

                          {/* Completion checklist indicators */}
                          <div className="flex items-center gap-3 text-xs font-mono pt-1">
                            <span
                              className={`flex items-center gap-1 ${
                                hasMaster ? "text-emerald-700" : "text-ink-muted/70"
                              }`}
                              title={hasMaster ? "Master Video Ready" : "Master Video Not Ready"}
                            >
                              <Video size={13} />
                              <span className="text-[11px]">{hasMaster ? "Video Ready" : "No Video"}</span>
                            </span>

                            <span
                              className={`flex items-center gap-1 ${
                                hasThumb ? "text-emerald-700" : "text-ink-muted/70"
                              }`}
                              title={hasThumb ? "Thumbnail Ready" : "Thumbnail Missing"}
                            >
                              <ImageIcon size={13} />
                              <span className="text-[11px]">{hasThumb ? "Thumbnail Ready" : "No Thumbnail"}</span>
                            </span>

                            <span
                              className={`flex items-center gap-1 ${
                                hasDesc ? "text-emerald-700" : "text-ink-muted/70"
                              }`}
                              title={hasDesc ? "Story Description Ready" : "Story Description Missing"}
                            >
                              <FileText size={13} />
                              <span className="text-[11px]">{hasDesc ? "Description Ready" : "No Description"}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                          {topic.youtubeUrl && (
                            <a
                              href={topic.youtubeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-line bg-paper-card text-rose-700 hover:border-rose-300 text-xs font-semibold transition-all cursor-pointer"
                              title="Watch published video on YouTube"
                            >
                              <Youtube size={13} /> Watch
                            </a>
                          )}
                          <Link
                            href={`/dashboard/channels/${channelSlug}/topic/${topic.slug}`}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold transition-all cursor-pointer w-full sm:w-auto"
                          >
                            Open Studio <ChevronRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickFillPillarFromClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 border border-line text-[11px] font-medium text-ink hover:text-signal hover:border-signal/40 bg-white cursor-pointer"
                  title="Auto-fill inputs from JSON currently in clipboard"
                >
                  <ClipboardPaste size={12} /> Auto-fill from Clipboard
                </button>
                <button
                  type="button"
                  onClick={() => setCreatePillarModalOpen(false)}
                  className="p-1 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
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
                  placeholder="Directives for topics generated within this pillar..."
                  className="w-full p-3 border border-line-dark bg-white text-ink outline-none focus:border-signal leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-tone">
                  Tone Directive
                </label>
                <input
                  id="p-tone"
                  type="text"
                  value={pillarTone}
                  onChange={(e) => setPillarTone(e.target.value)}
                  placeholder="e.g. High suspense, scholarly, investigative"
                  className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreatePillarModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-signal hover:bg-signal-hover text-white font-semibold shadow-xs shadow-signal/20 transition-colors cursor-pointer"
                >
                  {editingPillarSlug ? "Save Changes" : "Create Pillar"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PASTE PILLARS JSON MODAL */}
      {mounted && pastePillarModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-xl bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste size={18} className="text-signal" />
                <h3 className="text-lg font-display font-semibold text-ink">
                  Paste Content Pillars JSON
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPastePillarModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleImportPastedPillars} className="space-y-4 text-xs flex-1 flex flex-col">
              <div className="flex-1 flex flex-col space-y-1">
                <label className="block font-semibold text-ink/80" htmlFor="paste-json-area">
                  Paste JSON Array or Object *
                </label>
                <textarea
                  id="paste-json-area"
                  required
                  rows={10}
                  value={pastedPillarsJson}
                  onChange={(e) => setPastedPillarsJson(e.target.value)}
                  placeholder={`[\n  {\n    "name": "Market Crashes & Speculative Bubbles",\n    "tag": "Macroeconomics",\n    "description": "Deep-dives into historic financial panics..."\n  }\n]`}
                  className="w-full flex-1 p-3 font-mono text-xs border border-line-dark bg-white text-ink outline-none focus:border-signal leading-relaxed resize-none min-h-[160px]"
                />
              </div>

              {pastePillarError && (
                <div className="p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{pastePillarError}</span>
                </div>
              )}

              <div className="pt-2 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPastePillarModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPillars}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white font-semibold shadow-xs shadow-signal/20 transition-colors cursor-pointer"
                >
                  {isSavingPillars ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>Save Pillars</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CHANNEL CONFIRMATION MODAL */}
      {mounted && deleteChannelModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-md bg-paper border border-line p-6 shadow-2xl space-y-4 animate-scale-in text-ink my-auto">
            <div className="flex items-center gap-2 text-rose-600 font-semibold">
              <Trash2 size={18} />
              <h3 className="text-base font-display">Delete Channel</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Are you sure you want to delete <strong className="text-ink">{channelTitle}</strong>? All content pillars, topics, and studio assets associated with this channel will be permanently removed.
            </p>
            <div className="pt-3 border-t border-line flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteChannelModalOpen(false)}
                className="px-4 py-2 border border-line text-ink hover:bg-ink/5 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingChannel}
                onClick={handleDeleteChannel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {isDeletingChannel ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

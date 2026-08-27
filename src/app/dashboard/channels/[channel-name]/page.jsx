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
  Loader2,
  ClipboardPaste,
  AlertCircle
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

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { success: false, error: `Invalid JSON syntax: ${err.message}` };
  }

  let list = [];
  if (Array.isArray(parsed)) {
    list = parsed.map(extractPillarFromJson).filter(Boolean);
  } else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.pillars)) {
      list = parsed.pillars.map(extractPillarFromJson).filter(Boolean);
    } else if (Array.isArray(parsed.content_pillars)) {
      list = parsed.content_pillars.map(extractPillarFromJson).filter(Boolean);
    } else if (Array.isArray(parsed.contentPillars)) {
      list = parsed.contentPillars.map(extractPillarFromJson).filter(Boolean);
    } else {
      const single = extractPillarFromJson(parsed);
      if (single) list = [single];
    }
  }

  if (list.length === 0) {
    return {
      success: false,
      error: "No valid content pillar object(s) with a 'name' field found in JSON.",
    };
  }

  return { success: true, pillars: list };
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
  const [pastePillarModalOpen, setPastePillarModalOpen] = useState(false);
  const [deleteChannelModalOpen, setDeleteChannelModalOpen] = useState(false);

  // Pillar Form State
  const [pillarName, setPillarName] = useState("");
  const [pillarTag, setPillarTag] = useState("");
  const [pillarDescription, setPillarDescription] = useState("");
  const [pillarTone, setPillarTone] = useState("");
  const [pillarContentLength, setPillarContentLength] = useState("");
  const [pillarContentWordsCount, setPillarContentWordsCount] = useState("");
  const [pillarUseMainCharacter, setPillarUseMainCharacter] = useState(false);
  const [pillarMainCharacterDescription, setPillarMainCharacterDescription] = useState("");
  const [editingPillarSlug, setEditingPillarSlug] = useState(null);
  const [savingPillar, setSavingPillar] = useState(false);

  // Paste Pillar JSON State
  const [pastedPillarJsonText, setPastedPillarJsonText] = useState("");
  const [pastePillarError, setPastePillarError] = useState("");
  const [pastingPillars, setPastingPillars] = useState(false);
  const [pillarSuccessNotice, setPillarSuccessNotice] = useState("");
  const [copiedPillarsJson, setCopiedPillarsJson] = useState(false);
  const [copiedSinglePillarSlug, setCopiedSinglePillarSlug] = useState(null);

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
    } catch {
      // Fallback
    }
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
      await fetch(`/api/channels/${channelSlug}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore
    }
    router.push("/dashboard");
  }

  // Pillar Actions
  function handleOpenCreatePillar() {
    setEditingPillarSlug(null);
    setPillarName("");
    setPillarTag("");
    setPillarDescription("");
    setPillarTone("");
    setPillarContentLength("");
    setPillarContentWordsCount("");
    setPillarUseMainCharacter(false);
    setPillarMainCharacterDescription("");
    setCreatePillarModalOpen(true);
  }

  function handleOpenPastePillarModal() {
    setPastedPillarJsonText("");
    setPastePillarError("");
    setPastePillarModalOpen(true);
  }

  async function handlePastePillarFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedPillarJsonText(text);
        setPastePillarError("");
      }
    } catch {}
  }

  async function handleQuickFillPillarFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const res = parsePillarsJsonText(text);
      if (res.success && res.pillars.length > 0) {
        const p = res.pillars[0];
        setPillarName(p.name);
        setPillarTag(p.tag || "");
        setPillarDescription(p.description || "");
        setPillarTone(p.tone || "");
        setPillarContentLength(p.contentLength || p.content_length || "");
        setPillarContentWordsCount(p.contentWordsCount || p.content_words_count || "");
        setPillarUseMainCharacter(p.useMainCharacter);
        setPillarMainCharacterDescription(p.mainCharacterDescription || "");
      }
    } catch {}
  }

  async function handleApplyPastedPillarJson(e) {
    if (e) e.preventDefault();
    setPastePillarError("");
    const parsed = parsePillarsJsonText(pastedPillarJsonText);
    if (!parsed.success) {
      setPastePillarError(parsed.error);
      return;
    }

    setPastingPillars(true);
    let successCount = 0;
    try {
      for (const p of parsed.pillars) {
        const res = await fetch(`/api/channels/${channelSlug}/pillars`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            tag: p.tag,
            description: p.description,
            tone: p.tone,
            contentLength: p.contentLength,
            contentWordsCount: p.contentWordsCount,
            useMainCharacter: p.useMainCharacter,
            mainCharacterDescription: p.mainCharacterDescription,
          }),
        });
        if (res.ok) successCount++;
      }
      await loadWorkspaceData();
      setPillarSuccessNotice(`Successfully established ${successCount} content pillar(s)!`);
      setPastePillarModalOpen(false);
      setPastedPillarJsonText("");
      setTimeout(() => setPillarSuccessNotice(""), 4500);
    } catch (err) {
      setPastePillarError(`Error importing pillars: ${err.message}`);
    } finally {
      setPastingPillars(false);
    }
  }

  function handleOpenEditPillar(pillar, e) {
    e.stopPropagation();
    e.preventDefault();
    setEditingPillarSlug(pillar.slug);
    setPillarName(pillar.name);
    setPillarTag(pillar.tag || "");
    setPillarDescription(pillar.description || "");
    setPillarTone(pillar.tone || "");
    setPillarContentLength(pillar.contentLength || pillar.content_length || "");
    setPillarContentWordsCount(pillar.contentWordsCount || pillar.content_words_count || "");
    setPillarUseMainCharacter(Boolean(pillar.useMainCharacter ?? pillar.use_main_character));
    setPillarMainCharacterDescription(pillar.mainCharacterDescription || pillar.main_character_description || "");
    setCreatePillarModalOpen(true);
  }

  async function handleSavePillar(e) {
    e.preventDefault();
    const trimmed = pillarName.trim();
    if (!trimmed) return;

    setSavingPillar(true);
    const payload = {
      name: trimmed,
      tag: pillarTag.trim(),
      description: pillarDescription.trim(),
      tone: pillarTone.trim(),
      contentLength: pillarContentLength.trim(),
      contentWordsCount: pillarContentWordsCount.trim(),
      useMainCharacter: pillarUseMainCharacter,
      mainCharacterDescription: pillarMainCharacterDescription.trim(),
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
      setCreatePillarModalOpen(false);
    } catch (err) {
      console.error("Failed to save pillar:", err);
    } finally {
      setSavingPillar(false);
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
                  placeholder="The thematic boundary, core premise, and perspective of this pillar..."
                  className="w-full p-2.5 border border-line-dark bg-white text-ink outline-none focus:border-signal leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-tone">
                  Tone
                </label>
                <input
                  id="p-tone"
                  type="text"
                  value={pillarTone}
                  onChange={(e) => setPillarTone(e.target.value)}
                  placeholder="e.g. Calm, investigative, psychologically deep, slightly somber yet authoritative"
                  className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-length">
                  Target Content Length
                </label>
                <input
                  id="p-length"
                  type="text"
                  value={pillarContentLength}
                  onChange={(e) => setPillarContentLength(e.target.value)}
                  placeholder="e.g. 15-20 minutes (~2500 words) or 10-12 minutes"
                  className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-words">
                  Target Word Count
                </label>
                <input
                  id="p-words"
                  type="text"
                  value={pillarContentWordsCount}
                  onChange={(e) => setPillarContentWordsCount(e.target.value)}
                  placeholder="e.g. 2,500 - 3,500 words or 3,000 words"
                  className="w-full h-9 px-3 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              <div className="p-3 bg-ink/5 border border-line space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="p-use-main-char"
                    type="checkbox"
                    checked={pillarUseMainCharacter}
                    onChange={(e) => setPillarUseMainCharacter(e.target.checked)}
                    className="w-4 h-4 rounded border-line text-signal focus:ring-signal"
                  />
                  <span className="font-semibold text-ink text-xs">
                    Use Main Character Anchor (USE_MAIN_CHARACTER)
                  </span>
                </label>

                {pillarUseMainCharacter && (
                  <div>
                    <label className="block font-semibold text-ink/80 mb-1" htmlFor="p-char-desc">
                      Main Character Description (MAIN_CHARACTER_DESCRIPTION)
                    </label>
                    <textarea
                      id="p-char-desc"
                      rows={3}
                      value={pillarMainCharacterDescription}
                      onChange={(e) => setPillarMainCharacterDescription(e.target.value)}
                      placeholder="Describe the recurring character persona (e.g. A weary 30-something male clinical psychologist with unruly dark hair, spectacles, wearing a faded olive tweed coat and linen shirt)..."
                      className="w-full p-2.5 border border-line-dark bg-white text-ink outline-none focus:border-signal leading-relaxed"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreatePillarModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 transition-colors cursor-pointer text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPillar}
                  className="px-5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs"
                >
                  {savingPillar ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  <span>
                    {savingPillar
                      ? (editingPillarSlug ? "Saving Changes..." : "Establishing Pillar...")
                      : (editingPillarSlug ? "Save Changes" : "Establish Pillar")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE TOPICS MODAL */}
      {mounted && createTopicModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-lg bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-in text-ink my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-signal" />
                <h3 className="text-lg font-display font-semibold text-ink">
                  Establish Content Topic
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

            <form onSubmit={handleCreateTopic} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="t-pillar">
                  Assign Content Pillar *
                </label>
                <select
                  id="t-pillar"
                  required
                  value={topicPillar}
                  onChange={(e) => setTopicPillar(e.target.value)}
                  className="w-full h-9 px-2.5 border border-line-dark bg-white text-ink outline-none focus:border-signal"
                >
                  <option value="" disabled>Select a Content Pillar</option>
                  {pillars.map((p) => (
                    <option key={p.slug} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="t-titles">
                  Topic Title(s) *
                </label>
                <p className="text-[11px] text-ink-muted mb-1.5">
                  Enter one title or paste multiple lines to batch create multiple story episodes.
                </p>
                <textarea
                  id="t-titles"
                  required
                  rows={5}
                  value={topicTitles}
                  onChange={(e) => setTopicTitles(e.target.value)}
                  placeholder={"The Secret History of Fiat Inflation\nWhy the Panic of 1907 Created the Modern Fed\nThe Collapse of Bretton Woods"}
                  className="w-full p-2.5 border border-line-dark bg-white text-ink outline-none focus:border-signal leading-relaxed font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-line">
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
                  className="px-5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  {creatingTopics ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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

      {/* PASTE CONTENT PILLAR JSON MODAL */}
      {mounted && pastePillarModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPastePillarModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-signal/10 text-signal rounded">
                  <ClipboardPaste size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-semibold text-ink">
                    Paste Content Pillar JSON
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Paste a single content pillar object or an array of pillars to batch establish them.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPastePillarModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPastedPillarJson} className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <label htmlFor="paste-pillar-json-textarea" className="font-semibold text-ink/80">
                    Pillar JSON (Single Object or Array) *
                  </label>
                  <button
                    type="button"
                    onClick={handlePastePillarFromClipboard}
                    className="text-signal hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <ClipboardPaste size={12} /> Paste from clipboard
                  </button>
                </div>
                <textarea
                  id="paste-pillar-json-textarea"
                  required
                  rows={12}
                  value={pastedPillarJsonText}
                  onChange={(e) => {
                    setPastedPillarJsonText(e.target.value);
                    if (pastePillarError) setPastePillarError("");
                  }}
                  placeholder={`[\n  {\n    "name": "Cognitive Biases & Mental Models",\n    "tag": "Psychology",\n    "description": "Deep breakdowns of counterintuitive human psychological flaws and decision heuristics.",\n    "tone": "Calm, analytical, investigative, authoritative",\n    "content_length": "15-20 minutes (~2500 words)",\n    "content_words_count": "2,500 - 3,500 words",\n    "use_main_character": true,\n    "main_character_description": "A weary 30-something male clinical psychologist with unruly dark hair, round spectacles, wearing a faded olive tweed coat."\n  }\n]`}
                  className="w-full flex-1 min-h-[220px] p-3.5 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal"
                />
              </div>

              {pastePillarError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{pastePillarError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setPastePillarModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 transition-colors cursor-pointer text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pastingPillars}
                  className="px-5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  {pastingPillars ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
                  <span>{pastingPillars ? "Establishing Pillars..." : "Import Pillars"}</span>
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

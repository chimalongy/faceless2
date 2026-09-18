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
  Loader2,
  Sparkles,
  Video,
  Copy,
  Check,
  Smartphone,
  CheckCircle2,
  Youtube,
  Scissors,
  Image as ImageIcon,
  FileText
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

function toTopicSlug(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ContentPillarDetail() {
  const router = useRouter();
  const params = useParams();
  const rawChannelSlug = params?.["channel-name"] || "";
  const rawPillarSlug = params?.["content-pillar-name"] || "";

  const channelSlug = Array.isArray(rawChannelSlug) ? rawChannelSlug[0] : rawChannelSlug;
  const pillarSlug = Array.isArray(rawPillarSlug) ? rawPillarSlug[0] : rawPillarSlug;

  const [loading, setLoading] = useState(true);
  const [pillar, setPillar] = useState(null);
  const [topics, setTopics] = useState([]);
  const [activeTab, setActiveTab] = useState("longform"); // 'longform' | 'shorts' | 'completed'
  const [mounted, setMounted] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [extractingShortSlug, setExtractingShortSlug] = useState(null);

  // Modals / forms
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicTitles, setTopicTitles] = useState("");
  const [newTopicVideoType, setNewTopicVideoType] = useState("longform");
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

  const longformTopics = useMemo(() => {
    return topics.filter((t) => t.videoType !== "short");
  }, [topics]);

  const shortsTopics = useMemo(() => {
    return topics.filter((t) => t.videoType === "short");
  }, [topics]);

  const completedVideos = useMemo(() => {
    return topics.filter((t) => t.stage === "Completed" || t.masterVideoUrl);
  }, [topics]);

  function handleOpenCreateTopic(type) {
    setNewTopicVideoType(type || (activeTab === "shorts" ? "short" : "longform"));
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
      videoType: newTopicVideoType,
      aspectRatio: newTopicVideoType === "short" ? "9:16" : "16:9",
    };

    try {
      await fetch(`/api/channels/${channelSlug}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadData();
      if (newTopicVideoType === "short") {
        setActiveTab("shorts");
      } else {
        setActiveTab("longform");
      }
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
    if (!confirm(`Are you sure you want to delete this topic?`)) return;
    try {
      await fetch(`/api/channels/${channelSlug}/topics/${topicSlugToDelete}`, {
        method: "DELETE",
      });
      await loadData();
    } catch {
      // Ignore
    }
  }

  async function handleExtractShort(topicSlug, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!topicSlug || extractingShortSlug) return;
    setExtractingShortSlug(topicSlug);
    try {
      const res = await fetch(
        `/api/channels/${channelSlug}/topics/${topicSlug}/extract-short`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to extract Short");
      }
      await loadData();
      setActiveTab("shorts");
    } catch (err) {
      alert("Error extracting short: " + err.message);
    } finally {
      setExtractingShortSlug(null);
    }
  }

  function handleCopyPillarJson() {
    const data = {
      name: pillar?.name || pillarSlug,
      slug: pillarSlug,
      tag: pillar?.tag || "",
      description: pillar?.description || "",
      tone: pillar?.tone || "",
      content_length: pillar?.contentLength || pillar?.content_length || "15-20 minutes (~2500 words)",
      content_words_count: pillar?.contentWordsCount || pillar?.content_words_count || "2,500 - 3,500 words",
      use_main_character: Boolean(pillar?.useMainCharacter ?? pillar?.use_main_character),
      main_character_description: pillar?.mainCharacterDescription || pillar?.main_character_description || "",
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {}
  }

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
            {pillar?.description && (
              <p className="text-xs text-ink-muted max-w-2xl mt-1 leading-relaxed">
                {pillar.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyPillarJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
              title="Copy content pillar JSON schema"
            >
              {copiedJson ? (
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
            <button
              type="button"
              onClick={() => handleOpenCreateTopic(activeTab === "shorts" ? "short" : "longform")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              <Plus size={15} /> New Content Topic
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading pillar intelligence...</p>
        </section>
      ) : (
        <>
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 border-b border-line bg-paper-card px-2 pt-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("longform")}
              className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "longform"
                  ? "border-signal text-signal font-bold bg-signal/5"
                  : "border-transparent text-ink-muted hover:text-ink hover:border-line"
              }`}
            >
              <Film size={14} />
              <span>Long Form</span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
                {longformTopics.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("shorts")}
              className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "shorts"
                  ? "border-signal text-signal font-bold bg-signal/5"
                  : "border-transparent text-ink-muted hover:text-ink hover:border-line"
              }`}
            >
              <Smartphone size={14} className="text-rose-500" />
              <span>Shorts</span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
                {shortsTopics.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`px-3 sm:px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "completed"
                  ? "border-signal text-signal font-bold bg-signal/5"
                  : "border-transparent text-ink-muted hover:text-ink hover:border-line"
              }`}
            >
              <Video size={14} />
              <span>Master Archive</span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 bg-paper border border-line rounded-xs">
                {completedVideos.length}
              </span>
            </button>
          </div>

          {/* TAB 1: LONG FORM TOPICS */}
          {activeTab === "longform" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Film size={15} className="text-signal" />
                    <span>Long Form Topics ({longformTopics.length})</span>
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    16:9 widescreen video topics designed for full-length documentary and storytelling episodes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenCreateTopic("longform")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={13} /> Add Long Form Topic
                </button>
              </div>

              {longformTopics.length === 0 ? (
                <div className="p-12 border border-line bg-paper-card text-center space-y-3">
                  <Film size={28} className="text-signal/60 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-ink">No long form topics under this pillar yet</h3>
                    <p className="text-xs text-ink-muted max-w-sm mx-auto">
                      Create your first 16:9 widescreen topic to start scripting scenes and rendering master video episodes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateTopic("longform")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus size={14} /> Add Long Form Topic
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line border border-line bg-paper-card">
                  {longformTopics.map((topic) => {
                    const hasMaster = Boolean(topic.masterVideoUrl);
                    const hasThumb = Boolean(topic.thumbnailUrl);
                    const hasDesc = Boolean(topic.storyDescription);
                    const hasScript = Boolean(topic.scriptContent);
                    const isPosted = Boolean(topic.youtubeUrl || topic.youtubeVideoId);
                    const isCompleted = hasMaster || topic.stage === "Completed";

                    return (
                      <div
                        key={topic.slug}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink/[0.015] transition-colors"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 uppercase">
                              16:9 Longform
                            </span>

                            {isPosted ? (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-500/20 uppercase flex items-center gap-1">
                                <Youtube size={11} /> Posted
                              </span>
                            ) : isCompleted ? (
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
                            href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}/topic/${topic.slug}`}
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
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card text-rose-700 hover:border-rose-300 text-xs font-semibold transition-all cursor-pointer"
                              title="Watch on YouTube"
                            >
                              <Youtube size={13} /> Watch
                            </a>
                          )}

                          {hasScript && (
                            <button
                              type="button"
                              onClick={(e) => handleExtractShort(topic.slug, e)}
                              disabled={extractingShortSlug === topic.slug}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                              title="Extract a 45s viral Short from this script"
                            >
                              {extractingShortSlug === topic.slug ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-signal" />
                                  <span>Extracting...</span>
                                </>
                              ) : (
                                <>
                                  <Scissors size={13} className="text-signal" />
                                  <span>Extract Short</span>
                                </>
                              )}
                            </button>
                          )}

                          <Link
                            href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}/topic/${topic.slug}`}
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHORTS TOPICS */}
          {activeTab === "shorts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Smartphone size={15} className="text-rose-500" />
                    <span>Vertical Shorts ({shortsTopics.length})</span>
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    9:16 vertical shortform topics tailored for high-retention YouTube Shorts and TikTok feeds.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenCreateTopic("short")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={13} /> Add Short Topic
                </button>
              </div>

              {shortsTopics.length === 0 ? (
                <div className="p-12 border border-line bg-paper-card text-center space-y-3">
                  <Smartphone size={28} className="text-rose-500/60 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-ink">No vertical shorts under this pillar yet</h3>
                    <p className="text-xs text-ink-muted max-w-sm mx-auto">
                      Create a dedicated 9:16 short topic, or extract one from any scripted longform topic above.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateTopic("short")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus size={14} /> Add First Short Topic
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line border border-line bg-paper-card">
                  {shortsTopics.map((topic) => {
                    const hasMaster = Boolean(topic.masterVideoUrl);
                    const hasDesc = Boolean(topic.storyDescription);
                    const isPosted = Boolean(topic.youtubeUrl || topic.youtubeVideoId || topic.tiktokPublishId);
                    const isCompleted = hasMaster || topic.stage === "Completed";

                    return (
                      <div
                        key={topic.slug}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink/[0.015] transition-colors"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 uppercase flex items-center gap-1">
                              <Smartphone size={10} /> 9:16 Short
                            </span>

                            {topic.parentTopicId && (
                              <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 border border-purple-200">
                                Extracted from Longform
                              </span>
                            )}

                            {isPosted ? (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-500/20 uppercase flex items-center gap-1">
                                <Youtube size={11} /> Posted
                              </span>
                            ) : isCompleted ? (
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
                            href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}/topic/${topic.slug}`}
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
                              title={hasMaster ? "Master Short Ready" : "Short Video Not Compiled"}
                            >
                              <Video size={13} />
                              <span className="text-[11px]">{hasMaster ? "Short Master Ready" : "No Master"}</span>
                            </span>

                            <span
                              className={`flex items-center gap-1 ${
                                hasDesc ? "text-emerald-700" : "text-ink-muted/70"
                              }`}
                              title={hasDesc ? "Description / Caption Ready" : "No Caption"}
                            >
                              <FileText size={13} />
                              <span className="text-[11px]">{hasDesc ? "Caption Ready" : "No Caption"}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                          {topic.youtubeUrl && (
                            <a
                              href={topic.youtubeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card text-rose-700 hover:border-rose-300 text-xs font-semibold transition-all cursor-pointer"
                              title="Watch Short on YouTube"
                            >
                              <Youtube size={13} /> Watch
                            </a>
                          )}

                          <Link
                            href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}/topic/${topic.slug}`}
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMPLETED VIDEOS */}
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
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase">
                            Master Ready
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-muted border border-line uppercase">
                            {video.videoType === "short" ? "9:16 Short" : "16:9 Longform"}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-ink line-clamp-2">
                          {video.title}
                        </h4>
                      </div>

                      <div className="p-3 border-t border-line flex items-center justify-between text-xs bg-paper">
                        <span className="text-ink-muted font-mono text-[11px]">
                          Master Cut
                        </span>
                        <Link
                          href={`/dashboard/channels/${channelSlug}/content_pillar/${pillarSlug}/topic/${video.slug}`}
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
          <div className="relative w-full max-w-lg bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Film size={18} className="text-signal" />
                <h3 className="text-lg font-display font-semibold text-ink">
                  New {newTopicVideoType === "short" ? "Short" : "Long Form"} Topic
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
              {/* Video Format Choice */}
              <div>
                <label className="block font-semibold text-ink/80 mb-1.5">
                  Target Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewTopicVideoType("longform")}
                    className={`p-2.5 border cursor-pointer flex items-center gap-2 select-none transition-colors ${
                      newTopicVideoType === "longform"
                        ? "border-signal bg-signal/5 font-semibold text-signal"
                        : "border-line bg-paper hover:border-line-dark text-ink"
                    }`}
                  >
                    <Film size={14} />
                    <span>Long Form (16:9)</span>
                  </div>

                  <div
                    onClick={() => setNewTopicVideoType("short")}
                    className={`p-2.5 border cursor-pointer flex items-center gap-2 select-none transition-colors ${
                      newTopicVideoType === "short"
                        ? "border-rose-500 bg-rose-50 font-semibold text-rose-700"
                        : "border-line bg-paper hover:border-line-dark text-ink"
                    }`}
                  >
                    <Smartphone size={14} />
                    <span>Vertical Short (9:16)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink/80 mb-1" htmlFor="pt-titles">
                  Topic Name(s) *
                </label>
                <p className="text-[11px] text-ink-muted mb-2">
                  Enter one or multiple topic names (one per line) to establish multiple topics under this pillar at once.
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
                  {creatingTopics ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>
                    {creatingTopics
                      ? "Creating Topics..."
                      : topicTitles.trim().split(/\r?\n/).filter(Boolean).length > 1
                      ? `Create ${topicTitles.trim().split(/\r?\n/).filter(Boolean).length} Topics`
                      : `Create ${newTopicVideoType === "short" ? "Short" : "Long Form"} Topic`}
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

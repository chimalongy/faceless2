"use client";

import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Trash2,
  Tv,
  Sparkles,
  Sliders,
  Mic,
  Palette,
  Layers,
  Youtube,
  AlertTriangle,
  Radio,
  Check,
  Globe,
  AtSign,
  Target,
  Compass,
  Bookmark,
  Shield,
  HeartHandshake,
  MessageSquareQuote,
  Eye,
  Volume2,
  ImageIcon,
  Copy,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const STORAGE_KEY = "faceless_channels";

export default function EditChannelPage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.["channel-name"] || "";
  const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Canonical Channel Fields
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState("");
  const [niche, setNiche] = useState("");
  const [subNiche, setSubNiche] = useState("");
  const [contentCategory, setContentCategory] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [mission, setMission] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [personality, setPersonality] = useState("");
  const [brandPositioning, setBrandPositioning] = useState("");
  const [brandPromise, setBrandPromise] = useState("");
  const [imageTheme, setImageTheme] = useState("");
  const [thumbnailTheme, setThumbnailTheme] = useState("");
  const [audioTheme, setAudioTheme] = useState("");
  const [status, setStatus] = useState("Active");

  // Load channel data from Neon API
  useEffect(() => {
    async function fetchChannel() {
      setLoading(true);
      try {
        const res = await fetch(`/api/channels/${channelSlug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.channel) {
            const c = data.channel;
            setName(c.name || "");
            setHandle(c.handle || `@${c.slug || channelSlug}`);
            setChannelUrl(c.channelUrl || `https://youtube.com/@${c.slug || channelSlug}`);
            setDescription(c.description || "");
            setTagline(c.tagline || "");
            setNiche(c.niche || "");
            setSubNiche(c.subNiche || "");
            setContentCategory(c.contentCategory || "Documentaries & Education");
            setTargetAudience(c.targetAudience || "");
            setMission(c.mission || "");
            setValueProposition(c.valueProposition || "");
            setPersonality(c.personality || "");
            setBrandPositioning(c.brandPositioning || "");
            setBrandPromise(c.brandPromise || "");
            setImageTheme(c.imageTheme || "");
            setThumbnailTheme(c.thumbnailTheme || "");
            setAudioTheme(c.audioTheme || "");
            setStatus(c.status || "Active");
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to local storage if offline
      }

      // Check localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const found = parsed.find((c) => c.slug === channelSlug);
          if (found) {
            setName(found.name || "");
            setHandle(found.handle || `@${channelSlug}`);
            setChannelUrl(found.channelUrl || `https://youtube.com/@${channelSlug}`);
            setDescription(found.description || "");
            setTagline(found.tagline || "");
            setNiche(found.niche || "");
            setSubNiche(found.subNiche || "");
            setContentCategory(found.contentCategory || "Documentaries & Education");
            setTargetAudience(found.targetAudience || "");
            setMission(found.mission || "");
            setValueProposition(found.valueProposition || "");
            setPersonality(found.personality || "");
            setBrandPositioning(found.brandPositioning || "");
            setBrandPromise(found.brandPromise || "");
            setImageTheme(found.imageTheme || "");
            setThumbnailTheme(found.thumbnailTheme || "");
            setAudioTheme(found.audioTheme || "");
            setStatus(found.status || "Active");
          }
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    }

    fetchChannel();
  }, [channelSlug]);

  function handleCopyJson() {
    const nestedData = {
      channel: {
        name: name.trim() || channelSlug,
        slug: channelSlug,
        handle: handle.trim() || `@${channelSlug}`,
        channel_url: channelUrl.trim() || `https://youtube.com/@${channelSlug}`,
        tagline: tagline.trim(),
        description: description.trim(),
        status: status,
      },
      niche_and_audience: {
        niche: niche.trim(),
        sub_niche: subNiche.trim(),
        content_category: contentCategory.trim(),
        target_audience: targetAudience.trim(),
      },
      brand_strategy: {
        mission: mission.trim(),
        value_proposition: valueProposition.trim(),
        personality: personality.trim(),
        brand_positioning: brandPositioning.trim(),
        brand_promise: brandPromise.trim(),
      },
      creative_themes: {
        image_theme: imageTheme.trim(),
        thumbnail_theme: thumbnailTheme.trim(),
        audio_theme: audioTheme.trim(),
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

  async function handleSave(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    const updatedChannel = {
      name: trimmedName,
      slug: channelSlug,
      handle: handle.trim() || `@${channelSlug}`,
      channelUrl: channelUrl.trim() || `https://youtube.com/@${channelSlug}`,
      description: description.trim(),
      tagline: tagline.trim(),
      niche: niche.trim(),
      subNiche: subNiche.trim(),
      contentCategory: contentCategory.trim(),
      targetAudience: targetAudience.trim(),
      mission: mission.trim(),
      valueProposition: valueProposition.trim(),
      personality: personality.trim(),
      brandPositioning: brandPositioning.trim(),
      brandPromise: brandPromise.trim(),
      imageTheme: imageTheme.trim(),
      thumbnailTheme: thumbnailTheme.trim(),
      audioTheme: audioTheme.trim(),
      status,
    };

    try {
      await fetch(`/api/channels/${channelSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedChannel),
      });

      // Update local storage backup
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const updatedList = parsed.map((c) =>
          c.slug === channelSlug ? { ...c, ...updatedChannel } : c
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      }
    } catch {
      // Ignore
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 1500);
  }

  async function handleDeleteChannel() {
    try {
      await fetch(`/api/channels/${channelSlug}`, {
        method: "DELETE",
      });
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter((c) => c.slug !== channelSlug);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch {
      // Ignore
    }
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl max-w-4xl">
        <RefreshCw size={24} className="animate-spin text-signal mx-auto" />
        <p className="text-xs text-ink-muted">Loading channel configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl animate-card-rise pb-20">
      {/* Back Button & Top Header */}
      <div>
        <Link
          href={`/dashboard/channels/${channelSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to {name || "Channel Workspace"}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                Channel Brand Architecture
              </span>
              <span className="text-xs font-mono text-ink-muted">/{channelSlug}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              Edit Channel: {name || channelSlug}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Configure brand positioning, mission, persona, image styling, thumbnail themes, audio directives, and identity parameters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
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
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              {saving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : saved ? (
                <Check size={15} />
              ) : (
                <Save size={15} />
              )}
              <span>{saving ? "Saving..." : saved ? "Changes Saved" : "Save All Fields"}</span>
            </button>
          </div>
        </div>
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fade-in">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600" />
            Channel brand architecture & fields saved successfully to database!
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-emerald-700">Updated</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: CORE IDENTITY & SOCIALS */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Tv size={16} />
            </span>
            <span>1. Core Identity & Web Presence</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-channel-name">
                Channel Name *
              </label>
              <input
                id="field-channel-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Quiet Ledger"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-handle">
                Handle (@channelname)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-ink-muted text-xs">@</span>
                <input
                  id="field-handle"
                  type="text"
                  value={handle.startsWith("@") ? handle.slice(1) : handle}
                  onChange={(e) => setHandle(`@${e.target.value.replace(/^@/, "")}`)}
                  placeholder="thequietledger"
                  className="w-full h-10 pl-8 pr-3.5 border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-channel-url">
                Channel URL
              </label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-3 text-ink-muted" />
                <input
                  id="field-channel-url"
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="https://youtube.com/@thequietledger"
                  className="w-full h-10 pl-9 pr-3.5 border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-status">
                Engine Status
              </label>
              <select
                id="field-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal cursor-pointer"
              >
                <option value="Active">Active (Automated Production On)</option>
                <option value="Paused">Paused (Temporary Standby)</option>
                <option value="Draft">Draft (Incubation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-tagline">
              Channel Tagline
            </label>
            <input
              id="field-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Uncovering the silent mechanics of sovereign wealth and monetary history."
              className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-description">
              Channel Description
            </label>
            <textarea
              id="field-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed channel overview and bio..."
              className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal"
            />
          </div>
        </section>

        {/* SECTION 2: NICHE & AUDIENCE CATEGORIZATION */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Compass size={16} />
            </span>
            <span>2. Niche, Sub-Niche & Audience Focus</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-niche">
                Niche
              </label>
              <input
                id="field-niche"
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Personal Finance"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-subniche">
                Sub-niche
              </label>
              <input
                id="field-subniche"
                type="text"
                value={subNiche}
                onChange={(e) => setSubNiche(e.target.value)}
                placeholder="e.g. Monetary History"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-content-category">
                Content Category
              </label>
              <input
                id="field-content-category"
                type="text"
                value={contentCategory}
                onChange={(e) => setContentCategory(e.target.value)}
                placeholder="e.g. Education & Documentaries"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-target-audience">
              Target Audience
            </label>
            <input
              id="field-target-audience"
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. In-depth documentary viewers, macro analysts"
              className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
            />
          </div>
        </section>

        {/* SECTION 3: BRAND STRATEGY & VALUE PROPOSITION */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Shield size={16} />
            </span>
            <span>3. Brand Strategy & Positioning Architecture</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-mission">
                Channel Mission
              </label>
              <textarea
                id="field-mission"
                rows={3}
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="e.g. To demystify complex phenomena through immersive storytelling..."
                className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-value-prop">
                Channel Value Proposition
              </label>
              <textarea
                id="field-value-prop"
                rows={3}
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                placeholder="e.g. Actionable macro-historical context without clickbait noise."
                className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-personality">
                Channel Personality
              </label>
              <input
                id="field-personality"
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g. Analytical, calm, authoritative"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-brand-positioning">
                Brand Positioning
              </label>
              <input
                id="field-brand-positioning"
                type="text"
                value={brandPositioning}
                onChange={(e) => setBrandPositioning(e.target.value)}
                placeholder="e.g. The premier quiet intelligence desk"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-brand-promise">
                Brand Promise
              </label>
              <input
                id="field-brand-promise"
                type="text"
                value={brandPromise}
                onChange={(e) => setBrandPromise(e.target.value)}
                placeholder="e.g. Rigorous historical accuracy and zero hyperbole"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>
          </div>
        </section>

        {/* SECTION 4: IMAGE_THEME, THUMBNAIL_THEME & AUDIO_THEME DIRECTIVES */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Palette size={16} />
            </span>
            <span>4. Creative Themes & Studio Audio-Visual Directives</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-image-theme">
                <Eye size={13} className="text-signal" />
                <span>Image_Theme</span>
              </label>
              <span className="text-[10px] font-mono text-ink-muted uppercase">Scene Visual Aesthetics</span>
            </div>
            <textarea
              id="field-image-theme"
              rows={3}
              value={imageTheme}
              onChange={(e) => setImageTheme(e.target.value)}
              placeholder="e.g. Monochromatic dark slate, gold bullion accents, archival parchment textures, volumetric rim lighting, 8k cinematic macro documentary"
              className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-thumbnail-theme">
                <ImageIcon size={13} className="text-signal" />
                <span>Thumbnail_Theme</span>
              </label>
              <span className="text-[10px] font-mono text-ink-muted uppercase">High-CTR Cover Directives</span>
            </div>
            <textarea
              id="field-thumbnail-theme"
              rows={3}
              value={thumbnailTheme}
              onChange={(e) => setThumbnailTheme(e.target.value)}
              placeholder="e.g. Bold golden typography, dramatic high-contrast focal point, dark obsidian background, mysterious vault lighting"
              className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-audio-theme">
                <Volume2 size={13} className="text-signal" />
                <span>Audio_theme</span>
              </label>
              <span className="text-[10px] font-mono text-ink-muted uppercase">Voice & Acoustic Atmosphere</span>
            </div>
            <textarea
              id="field-audio-theme"
              rows={3}
              value={audioTheme}
              onChange={(e) => setAudioTheme(e.target.value)}
              placeholder="e.g. Deep baritone narrator, subtle low-frequency drone (-20dB), acoustic cello swells"
              className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
            />
          </div>
        </section>

        {/* SECTION 5: SAVE BAR & DANGER ZONE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-line">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-line bg-paper-card text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trash2 size={14} /> Delete Channel
          </button>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Link
              href={`/dashboard/channels/${channelSlug}`}
              className="px-4 py-2.5 border border-line bg-paper-card text-xs font-semibold text-ink hover:bg-ink/5 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? "Saving..." : "Save Channel Profile"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-md bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2 border border-rose-200">
              <Trash2 size={20} />
            </div>

            <div>
              <h3 className="text-xl font-display font-semibold text-ink tracking-tight">
                Delete {name || channelSlug}?
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                Are you sure you want to delete this channel? All associated content pillars, story topics, and settings will be permanently removed from the database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
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
        </div>
      )}
    </div>
  );
}

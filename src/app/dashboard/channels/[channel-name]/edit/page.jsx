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
  Image as ImageIcon,
  Copy,
  Loader2,
  ClipboardPaste,
  FileCode,
  X,
  AlertCircle,
  Upload,
  Camera,
  Download
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

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
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasteSuccessNotice, setPasteSuccessNotice] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Artwork & Branding Images
  const [bannerUrl, setBannerUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [bannerNotice, setBannerNotice] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState(null);

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
            setContentCategory(c.contentCategory || "");
            setTargetAudience(c.targetAudience || "");
            setMission(c.mission || "");
            setValueProposition(c.valueProposition || "");
            setPersonality(c.personality || "");
            setBrandPositioning(c.brandPositioning || "");
            setBrandPromise(c.brandPromise || "");
            setImageTheme(c.imageTheme || "");
            setThumbnailTheme(c.thumbnailTheme || "");
            setAudioTheme(c.audioTheme || "");
            setBannerUrl(c.bannerUrl || "");
            setAvatarUrl(c.avatarUrl || "");
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
            setContentCategory(found.contentCategory || "");
            setTargetAudience(found.targetAudience || "");
            setMission(found.mission || "");
            setValueProposition(found.valueProposition || "");
            setPersonality(found.personality || "");
            setBrandPositioning(found.brandPositioning || "");
            setBrandPromise(found.brandPromise || "");
            setImageTheme(found.imageTheme || "");
            setThumbnailTheme(found.thumbnailTheme || "");
            setAudioTheme(found.audioTheme || "");
            setBannerUrl(found.bannerUrl || "");
            setAvatarUrl(found.avatarUrl || "");
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

  function extractAndApplyJson(jsonStringOrObj) {
    let data;
    if (typeof jsonStringOrObj === "string") {
      try {
        data = JSON.parse(jsonStringOrObj.trim());
      } catch {
        return { success: false, error: "Invalid JSON format. Please check for syntax or formatting errors." };
      }
    } else {
      data = jsonStringOrObj;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { success: false, error: "Provided JSON must be an object with key-value pairs." };
    }

    const nestedSections = [
      data.channel,
      data.channel_info,
      data.channelInfo,
      data.niche_and_audience,
      data.nicheAndAudience,
      data.brand_strategy,
      data.brandStrategy,
      data.creative_themes,
      data.creativeThemes,
    ].filter((s) => s && typeof s === "object");

    const findValue = (...keys) => {
      for (const k of keys) {
        if (data[k] !== undefined && data[k] !== null) return data[k];
      }
      for (const section of nestedSections) {
        for (const k of keys) {
          if (section[k] !== undefined && section[k] !== null) return section[k];
        }
      }
      return undefined;
    };

    let count = 0;
    const setField = (setter, ...keys) => {
      const val = findValue(...keys);
      if (val !== undefined) {
        setter(typeof val === "string" ? val : String(val));
        count++;
      }
    };

    setField(setName, "name", "channelName", "channel_name");
    setField(setHandle, "handle", "channelHandle", "channel_handle");
    setField(setChannelUrl, "channelUrl", "channel_url", "url");
    setField(setDescription, "description", "channelDescription", "channel_description");
    setField(setTagline, "tagline", "slogan");
    setField(setNiche, "niche", "primaryNiche", "primary_niche");
    setField(setSubNiche, "subNiche", "sub_niche", "subniche");
    setField(setContentCategory, "contentCategory", "content_category", "category");
    setField(setTargetAudience, "targetAudience", "target_audience", "audience");
    setField(setMission, "mission", "channelMission", "channel_mission");
    setField(setValueProposition, "valueProposition", "value_proposition");
    setField(setPersonality, "personality", "tone", "voice");
    setField(setBrandPositioning, "brandPositioning", "brand_positioning", "positioning");
    setField(setBrandPromise, "brandPromise", "brand_promise", "promise");
    setField(setImageTheme, "imageTheme", "image_theme", "imagesTheme", "visualTheme", "visual_theme");
    setField(setThumbnailTheme, "thumbnailTheme", "thumbnail_theme", "thumbnailsTheme");
    setField(setAudioTheme, "audioTheme", "audio_theme", "soundTheme", "voiceoverTheme");
    setField(setStatus, "status");

    if (count === 0) {
      return { success: false, error: "No matching channel fields found in this JSON object." };
    }

    return { success: true, count };
  }

  function handleApplyPastedJson(e) {
    if (e) e.preventDefault();
    setPasteError("");
    if (!pastedJsonText.trim()) {
      setPasteError("Please paste JSON into the text area before applying.");
      return;
    }
    const result = extractAndApplyJson(pastedJsonText);
    if (!result.success) {
      setPasteError(result.error);
      return;
    }

    setPasteSuccessNotice(`Populated ${result.count} fields from JSON! Review and click "Save All Fields" to persist.`);
    setPasteModalOpen(false);
    setPastedJsonText("");
    setTimeout(() => {
      setPasteSuccessNotice("");
    }, 4500);
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedJsonText(text);
        setPasteError("");
      }
    } catch {
      // Clipboard read permission might not be granted
    }
  }

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
      bannerUrl: bannerUrl.trim(),
      avatarUrl: avatarUrl.trim(),
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

  async function handleUploadBanner(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      setBannerNotice({ type: "error", message: "File exceeds 6 MB limit. Please select an image of 6 MB or less." });
      setTimeout(() => setBannerNotice(null), 5000);
      return;
    }

    setIsUploadingBanner(true);
    setBannerNotice(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("channelSlug", channelSlug);
    formData.append("assetType", "channel_banner");

    try {
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload banner");

      setBannerUrl(data.publicUrl);
      setBannerNotice({ type: "success", message: "Banner image uploaded successfully." });
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err) {
      setBannerNotice({ type: "error", message: err.message || "Failed to upload banner image." });
      setTimeout(() => setBannerNotice(null), 5000);
    } finally {
      setIsUploadingBanner(false);
    }
  }

  async function handleRemoveBanner() {
    const prevUrl = bannerUrl;
    setBannerUrl("");
    setBannerNotice({ type: "success", message: "Banner image removed from storage." });
    setTimeout(() => setBannerNotice(null), 3000);

    if (prevUrl) {
      try {
        await fetch("/api/storage/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: prevUrl,
            channelSlug,
            assetType: "channel_banner",
          }),
        });
      } catch (err) {
        console.warn("Could not delete banner from R2:", err);
      }
    }
  }

  async function handleUploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setAvatarNotice({ type: "error", message: "File exceeds 4 MB limit. Please select a picture of 4 MB or less." });
      setTimeout(() => setAvatarNotice(null), 5000);
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarNotice(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("channelSlug", channelSlug);
    formData.append("assetType", "channel_avatar");

    try {
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload picture");

      setAvatarUrl(data.publicUrl);
      setAvatarNotice({ type: "success", message: "Channel picture uploaded successfully." });
      setTimeout(() => setAvatarNotice(null), 4000);
    } catch (err) {
      setAvatarNotice({ type: "error", message: err.message || "Failed to upload channel picture." });
      setTimeout(() => setAvatarNotice(null), 5000);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    const prevUrl = avatarUrl;
    setAvatarUrl("");
    setAvatarNotice({ type: "success", message: "Channel picture removed from storage." });
    setTimeout(() => setAvatarNotice(null), 3000);

    if (prevUrl) {
      try {
        await fetch("/api/storage/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: prevUrl,
            channelSlug,
            assetType: "channel_avatar",
          }),
        });
      } catch (err) {
        console.warn("Could not delete avatar from R2:", err);
      }
    }
  }

  async function handleDownloadImage(url, filename) {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "image.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
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
        <Loader2 size={24} className="animate-spin text-signal mx-auto" />
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
              onClick={() => {
                setPasteError("");
                setPasteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
              title="Paste JSON to automatically fill all channel fields"
            >
              <ClipboardPaste size={14} />
              <span>Paste JSON</span>
            </button>
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
                <Loader2 size={15} className="animate-spin" />
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

      {pasteSuccessNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center justify-between animate-fade-in rounded-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            {pasteSuccessNotice}
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-emerald-700">JSON Applied</span>
        </div>
      )}

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
        {/* SECTION 0: CHANNEL ARTWORK & VISUAL BRANDING */}
        <section className="p-6 border border-line bg-paper-card space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
              <span className="p-1.5 bg-signal/10 text-signal">
                <Palette size={16} />
              </span>
              <span>Channel Artwork & Visual Branding</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-signal bg-signal/10 px-2 py-0.5">
              YouTube Specifications
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Banner Image Column (7 cols) */}
            <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-signal" />
                  <span>Banner Image</span>
                </h4>
                <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                  For the best results on all devices, use an image that's at least 2048 x 1152 pixels and 6 MB or less.
                </p>
              </div>

              {/* Banner Preview Canvas */}
              <div className="relative w-full aspect-[16/6] bg-paper-dark border border-line-dark overflow-hidden flex items-center justify-center group rounded-xs">
                {bannerUrl ? (
                  <>
                    <img
                      src={bannerUrl}
                      alt="Channel Banner"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(bannerUrl, `${channelSlug}-banner.png`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-ink text-xs font-semibold hover:bg-paper cursor-pointer shadow-md"
                        title="Download banner image"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-ink text-xs font-semibold hover:bg-paper cursor-pointer shadow-md">
                        <Upload size={13} />
                        <span>Replace</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingBanner}
                          onChange={handleUploadBanner}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveBanner}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 space-y-2.5">
                    <div className="w-9 h-9 rounded-full bg-paper border border-line flex items-center justify-center text-ink-muted mx-auto">
                      <ImageIcon size={16} />
                    </div>
                    <label className={`inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer ${
                      isUploadingBanner ? "opacity-60 pointer-events-none" : ""
                    }`}>
                      {isUploadingBanner ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Uploading Banner...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>Upload Banner Image</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingBanner}
                        onChange={handleUploadBanner}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {bannerNotice && (
                <div className={`p-2.5 text-xs flex items-center gap-2 border ${
                  bannerNotice.type === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{bannerNotice.message}</span>
                </div>
              )}
            </div>

            {/* Channel Picture Column (5 cols) */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Camera size={14} className="text-signal" />
                  <span>Channel Picture</span>
                </h4>
                <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                  It's recommended that you use a picture that's at least 98 x 98 pixels and 4 MB or less. Use a PNG or GIF (no animations) file. Make sure that your picture follows the YouTube Community Guidelines.
                </p>
              </div>

              <div className="p-4 border border-line bg-paper flex items-center gap-4">
                <div className="relative w-18 h-18 rounded-full border-2 border-line bg-paper-card overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Channel Picture"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-display font-bold text-signal">
                      {(name || channelSlug || "C").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer ${
                      isUploadingAvatar ? "opacity-60 pointer-events-none" : ""
                    }`}>
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>{avatarUrl ? "Change" : "Upload Picture"}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/gif,image/jpeg,image/webp"
                        disabled={isUploadingAvatar}
                        onChange={handleUploadAvatar}
                        className="hidden"
                      />
                    </label>

                    {avatarUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDownloadImage(avatarUrl, `${channelSlug}-picture.png`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                          title="Download channel picture"
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-paper-card hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-ink-muted transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-muted font-mono">PNG, GIF, JPEG (max 4 MB)</p>
                </div>
              </div>

              {avatarNotice && (
                <div className={`p-2.5 text-xs flex items-center gap-2 border ${
                  avatarNotice.type === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{avatarNotice.message}</span>
                </div>
              )}
            </div>
          </div>
        </section>

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
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? "Saving..." : "Save Channel Profile"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Paste JSON Modal */}
      {mounted && pasteModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasteModalOpen(false);
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
                    Paste Channel JSON
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Paste raw JSON to automatically populate all channel fields, brand strategy, and creative theme parameters.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPastedJson} className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <label htmlFor="paste-json-textarea" className="font-semibold text-ink/80">
                    JSON Object *
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="text-signal hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <ClipboardPaste size={12} /> Paste from clipboard
                  </button>
                </div>
                <textarea
                  id="paste-json-textarea"
                  required
                  rows={14}
                  value={pastedJsonText}
                  onChange={(e) => {
                    setPastedJsonText(e.target.value);
                    if (pasteError) setPasteError("");
                  }}
                  placeholder={`{\n  "channel": {\n    "name": "Money Koncepts",\n    "slug": "moneykoncepts",\n    "handle": "@moneykoncepts",\n    "channel_url": "https://youtube.com/@moneykoncepts",\n    "tagline": "Mastering the mechanics of money and enterprise.",\n    "description": "Deep-dive financial breakdowns and wealth building frameworks.",\n    "status": "Active"\n  },\n  "niche_and_audience": {\n    "niche": "Finance & Wealth",\n    "sub_niche": "Enterprise & Capital",\n    "content_category": "Business & Finance",\n    "target_audience": "Entrepreneurs, investors, and ambitious professionals."\n  },\n  "brand_strategy": {\n    "mission": "Demystify complex capital markets into clear visual stories.",\n    "value_proposition": "First-principles financial intelligence.",\n    "personality": "Authoritative, analytical, objective",\n    "brand_positioning": "The definitive channel for capital analysis.",\n    "brand_promise": "Factual rigor without sensationalism."\n  },\n  "creative_themes": {\n    "image_theme": "Dark modern editorial, subtle gold and obsidian lighting.",\n    "thumbnail_theme": "High contrast minimal charts, bold serif focal words.",\n    "audio_theme": "Deep authoritative baritone narration with subtle low-drone audio backdrop."\n  }\n}`}
                  className="w-full flex-1 min-h-[220px] p-3.5 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal"
                />
              </div>

              {pasteError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{pasteError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setPastedJsonText("");
                    setPasteError("");
                  }}
                  className="text-xs text-ink-muted hover:text-ink cursor-pointer"
                >
                  Clear input
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPasteModalOpen(false)}
                    className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-signal hover:bg-signal-hover active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Fill All Fields
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {mounted && deleteModalOpen && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}

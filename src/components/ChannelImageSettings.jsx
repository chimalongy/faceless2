"use client";

import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Sparkles,
  Loader2,
  FolderArchive,
  Smartphone,
  Film,
  CheckSquare,
  Square,
  AlertCircle,
  Maximize2,
  X,
  RefreshCw,
  Eye,
  Info,
  Save,
  Check,
  Palette,
  FileCode,
  Copy,
  RotateCcw,
  User,
  Users,
  Star,
  Plus,
  Edit3,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  IMAGE_THEME_FIELDS,
  DEFAULT_IMAGE_THEME,
  parseImageTheme,
  hasImageThemeContent,
} from "@/lib/image-theme";

export default function ChannelImageSettings({ channelSlug, channelTitle, useImagePool = false }) {
  const [activePool, setActivePool] = useState("shorts"); // 'shorts' | 'longform'
  const [loading, setLoading] = useState(true);
  const [poolData, setPoolData] = useState({
    shortsCount: 0,
    longformCount: 0,
    images: [],
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Channel record (needed for safe full-PUT when saving themes)
  const [channelData, setChannelData] = useState(null);

  // Image Theme state (structured 6-field object from Qwen Image Studio)
  const [imageTheme, setImageTheme] = useState(DEFAULT_IMAGE_THEME);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savedTheme, setSavedTheme] = useState(false);

  // JSON Import/Export Modal state
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [copiedJson, setCopiedJson] = useState(false);

  // Use Image Pool toggle state
  const [channelUseImagePool, setChannelUseImagePool] = useState(Boolean(useImagePool));
  const [savingPoolToggle, setSavingPoolToggle] = useState(false);

  // Thumbnail Theme state
  const [thumbnailTheme, setThumbnailTheme] = useState("");
  const [savingThumbnailTheme, setSavingThumbnailTheme] = useState(false);
  const [savedThumbnailTheme, setSavedThumbnailTheme] = useState(false);

  // Channel Characters state
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [characterModalOpen, setCharacterModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [charName, setCharName] = useState("");
  const [charPhysicalSpec, setCharPhysicalSpec] = useState("");
  const [charSignatureFeature, setCharSignatureFeature] = useState("");
  const [charWardrobe, setCharWardrobe] = useState("");
  const [charIsMain, setCharIsMain] = useState(false);
  const [isSavingChar, setIsSavingChar] = useState(false);

  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch full channel record on mount and parse structured imageTheme
  useEffect(() => {
    if (!channelSlug) return;
    fetch(`/api/channels/${channelSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.channel) {
          setChannelData(data.channel);
          // Parse structured imageTheme from database or legacy string
          setImageTheme(parseImageTheme(data.channel.imageTheme));
          setThumbnailTheme(data.channel.thumbnailTheme || "");
          setChannelUseImagePool(Boolean(data.channel.useImagePool ?? data.channel.use_image_pool));
        }
      })
      .catch((err) => {
        console.error("Failed to load channel for image settings:", err);
      });
    loadCharacters();
  }, [channelSlug]);

  async function loadCharacters() {
    setLoadingCharacters(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/characters`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.characters)) {
          setCharacters(data.characters);
        }
      }
    } catch (err) {
      console.error("Failed to load characters:", err);
    } finally {
      setLoadingCharacters(false);
    }
  }

  function handleOpenCreateCharacter() {
    setEditingCharacter(null);
    setCharName("");
    setCharPhysicalSpec("");
    setCharSignatureFeature("");
    setCharWardrobe("");
    setCharIsMain(characters.length === 0);
    setCharacterModalOpen(true);
  }

  function handleOpenEditCharacter(char) {
    setEditingCharacter(char);
    setCharName(char.name || "");
    setCharPhysicalSpec(char.physical_spec || char.physicalSpec || "");
    setCharSignatureFeature(char.signature_feature || char.signatureFeature || "");
    setCharWardrobe(char.wardrobe || "");
    setCharIsMain(Boolean(char.is_main ?? char.isMain));
    setCharacterModalOpen(true);
  }

  async function handleSaveCharacter(e) {
    if (e) e.preventDefault();
    if (!charName.trim()) {
      toast.error("Character name is required");
      return;
    }

    setIsSavingChar(true);
    try {
      const isEdit = Boolean(editingCharacter);
      const method = isEdit ? "PUT" : "POST";
      const body = {
        id: isEdit ? editingCharacter.id : undefined,
        name: charName.trim(),
        physicalSpec: charPhysicalSpec.trim(),
        signatureFeature: charSignatureFeature.trim(),
        wardrobe: charWardrobe.trim(),
        isMain: charIsMain,
      };

      const res = await fetch(`/api/channels/${channelSlug}/characters`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save character");
      }

      toast.success(isEdit ? "Character updated!" : "Character created!");
      setCharacterModalOpen(false);
      loadCharacters();
    } catch (err) {
      console.error("Save character error:", err);
      toast.error(err.message || "Failed to save character");
    } finally {
      setIsSavingChar(false);
    }
  }

  async function handleSetAsMainCharacter(char) {
    try {
      const res = await fetch(`/api/channels/${channelSlug}/characters`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: char.id,
          isMain: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to set main character");
      }
      toast.success(`"${char.name}" set as Main Character!`);
      loadCharacters();
    } catch (err) {
      console.error("Set main character error:", err);
      toast.error(err.message || "Failed to set main character");
    }
  }

  async function handleDeleteCharacter(char) {
    if (!confirm(`Delete character "${char.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/channels/${channelSlug}/characters?id=${char.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete character");
      }
      toast.success("Character deleted");
      loadCharacters();
    } catch (err) {
      console.error("Delete character error:", err);
      toast.error(err.message || "Failed to delete character");
    }
  }

  useEffect(() => {
    loadPoolImages(activePool);
    setSelectedIds(new Set());
  }, [channelSlug, activePool]);

  async function loadPoolImages(type = activePool) {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/image-pool?type=${type}`);
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        setPoolData({
          shortsCount: data.shortsCount || 0,
          longformCount: data.longformCount || 0,
          images: data.images || [],
        });
      } else {
        toast.error(data.error || "Failed to load image pool");
      }
    } catch (err) {
      console.error("Error loading pool:", err);
      toast.error(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }

  // Handle uploading files (images or zip) via direct R2 presigned URLs
  async function handleFileUpload(files, isZip = false) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadPercent(0);

    try {
      const isZipUpload = isZip || (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip"));

      if (isZipUpload) {
        const zipFile = files[0];
        setUploadProgress(`Authorizing upload for ${zipFile.name}...`);

        const presignRes = await fetch(`/api/channels/${channelSlug}/image-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "presign",
            poolType: activePool,
            fileName: zipFile.name,
            isZip: true,
            mimeType: zipFile.type || "application/zip",
          }),
        });

        const presignText = await presignRes.text();
        let presignData = {};
        try {
          presignData = JSON.parse(presignText);
        } catch {
          throw new Error(presignText.slice(0, 150) || `Server error (${presignRes.status})`);
        }

        if (!presignRes.ok || !presignData.uploadUrl) {
          throw new Error(presignData.error || "Failed to obtain storage authorization for ZIP");
        }

        setUploadProgress("Uploading ZIP to storage (0%)...");
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignData.uploadUrl, true);

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
              const loadedMB = (evt.loaded / 1024 / 1024).toFixed(1);
              const totalMB = (evt.total / 1024 / 1024).toFixed(1);
              setUploadPercent(percent);
              setUploadProgress(`Uploading ZIP: ${loadedMB}MB / ${totalMB}MB (${percent}%)`);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadPercent(100);
              resolve();
            } else {
              reject(new Error(`Storage rejected ZIP upload (HTTP ${xhr.status}). Check R2 CORS settings.`));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Storage upload network error. Ensure Cloudflare R2 CORS allows PUT requests."));
          };

          xhr.ontimeout = () => {
            reject(new Error("Storage upload timed out."));
          };

          xhr.send(zipFile);
        });

        setUploadProgress("Unpacking ZIP archive & syncing images...");
        const processRes = await fetch(`/api/channels/${channelSlug}/image-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process-zip",
            poolType: activePool,
            zipFileKey: presignData.key,
          }),
        });

        const processText = await processRes.text();
        let processData = {};
        try {
          processData = JSON.parse(processText);
        } catch {
          throw new Error(processText.slice(0, 150) || `Extraction error (${processRes.status})`);
        }

        if (processRes.ok && processData.success) {
          toast.success(`Successfully added ${processData.uploadedCount} image(s) to the ${activePool === "shorts" ? "Shorts" : "Longform"} pool!`);
          loadPoolImages(activePool);
        } else {
          throw new Error(processData.error || "Failed to process ZIP archive");
        }
      } else {
        const fileList = Array.from(files);
        setUploadProgress(`Authorizing upload for ${fileList.length} image(s)...`);

        const presignRes = await fetch(`/api/channels/${channelSlug}/image-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "presign",
            poolType: activePool,
            files: fileList.map((f) => ({ fileName: f.name, mimeType: f.type })),
          }),
        });

        const presignText = await presignRes.text();
        let presignData = {};
        try {
          presignData = JSON.parse(presignText);
        } catch {
          throw new Error(presignText.slice(0, 150) || `Server error (${presignRes.status})`);
        }

        if (!presignRes.ok || !Array.isArray(presignData.presignedList)) {
          throw new Error(presignData.error || "Failed to obtain upload authorization for images");
        }

        const uploadedRecords = [];
        let completed = 0;
        const total = fileList.length;
        const concurrency = 3;

        for (let i = 0; i < fileList.length; i += concurrency) {
          const chunk = fileList.slice(i, i + concurrency);
          await Promise.all(
            chunk.map(async (file, idx) => {
              const presigned = presignData.presignedList[i + idx];
              if (!presigned?.uploadUrl) return;

              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", presigned.uploadUrl, true);
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    completed++;
                    setUploadPercent(Math.round((completed / total) * 100));
                    setUploadProgress(`Uploading images: ${completed} / ${total}`);
                    uploadedRecords.push({
                      fileUrl: presigned.publicUrl,
                      fileKey: presigned.key,
                      fileName: file.name,
                      mimeType: file.type || "image/png",
                      sizeBytes: file.size,
                    });
                    resolve();
                  } else {
                    reject(new Error(`Storage rejected "${file.name}" (HTTP ${xhr.status})`));
                  }
                };
                xhr.onerror = () => reject(new Error(`Upload network error for "${file.name}"`));
                xhr.ontimeout = () => reject(new Error(`Upload timed out for "${file.name}"`));
                xhr.send(file);
              });
            })
          );
        }

        setUploadProgress("Registering images in pool...");
        const recordRes = await fetch(`/api/channels/${channelSlug}/image-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record-images",
            poolType: activePool,
            images: uploadedRecords,
          }),
        });

        const recordText = await recordRes.text();
        let recordData = {};
        try {
          recordData = JSON.parse(recordText);
        } catch {
          throw new Error(recordText.slice(0, 150) || `Save error (${recordRes.status})`);
        }

        if (recordRes.ok && recordData.success) {
          toast.success(`Successfully added ${recordData.uploadedCount} image(s) to the ${activePool === "shorts" ? "Shorts" : "Longform"} pool!`);
          loadPoolImages(activePool);
        } else {
          throw new Error(recordData.error || "Failed to record uploaded images");
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload pool images");
    } finally {
      setUploading(false);
      setUploadProgress("");
      setUploadPercent(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  // Selection toggles
  function toggleSelectId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === poolData.images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(poolData.images.map((img) => img.id)));
    }
  }

  // Delete single or selected images
  async function handleDeleteImages(idsToDelete) {
    if (!idsToDelete || idsToDelete.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} image(s) from the pool?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/image-pool`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        toast.success(`Deleted ${data.deletedCount} image(s) from pool.`);
        setSelectedIds(new Set());
        loadPoolImages(activePool);
      } else {
        toast.error(data.error || "Failed to delete images.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete images");
    } finally {
      setDeleting(false);
    }
  }

  // Handlers for Image Theme field editing
  function handleThemeFieldChange(key, value) {
    setImageTheme((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  // Copy current 6 fields as formatted JSON
  function handleCopyJson() {
    try {
      navigator.clipboard.writeText(JSON.stringify(imageTheme, null, 2));
      setCopiedJson(true);
      toast.success("Image theme JSON copied to clipboard");
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      toast.error("Failed to copy JSON");
    }
  }

  // Apply JSON from Import modal
  function handleApplyJson() {
    setJsonError("");
    if (!jsonInput.trim()) return;

    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("JSON must contain an object.");
        return;
      }

      const updated = parseImageTheme(parsed);
      setImageTheme(updated);
      setShowJsonModal(false);
      setJsonInput("");
      setJsonError("");
      toast.success("Applied visual identity directives from JSON");
    } catch (err) {
      setJsonError("Invalid JSON syntax. Please verify commas and quotes.");
    }
  }

  // Clear Visual Identity fields
  function handleClearTheme() {
    if (confirm("Clear all Visual Identity fields?")) {
      setImageTheme({ ...DEFAULT_IMAGE_THEME });
      toast("Image theme cleared");
    }
  }

  // Save Image Theme to DB (persists as JSON string)
  async function handleSaveImageTheme(e) {
    if (e) e.preventDefault();
    if (!channelData) {
      toast.error("Channel data not loaded yet.");
      return;
    }
    setSavingTheme(true);
    try {
      const payload = {
        ...channelData,
        imageTheme, // API will serialize to JSON string
      };
      const res = await fetch(`/api/channels/${channelSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.channel) {
          setChannelData(data.channel);
          // Keep state consistent from the database returned record
          setImageTheme(parseImageTheme(data.channel.imageTheme));
        }
        setSavedTheme(true);
        toast.success("Image theme saved successfully!");
        setTimeout(() => setSavedTheme(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save image theme");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save image theme");
    } finally {
      setSavingTheme(false);
    }
  }

  // Toggle Use Image Pool setting
  async function handleToggleUseImagePool(checked) {
    setChannelUseImagePool(checked);
    if (!channelData) return;

    setSavingPoolToggle(true);
    try {
      const payload = {
        ...channelData,
        useImagePool: checked,
        use_image_pool: checked,
      };
      const res = await fetch(`/api/channels/${channelSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.channel) setChannelData(data.channel);
        toast.success(checked ? "Using Image Pool for scene visuals" : "Using AI generation for scene visuals");
      } else {
        setChannelUseImagePool(!checked);
        toast.error("Failed to update Image Pool preference");
      }
    } catch (err) {
      setChannelUseImagePool(!checked);
      toast.error(err.message || "Network error");
    } finally {
      setSavingPoolToggle(false);
    }
  }

  // Save Thumbnail Theme to DB
  async function handleSaveThumbnailTheme(e) {
    if (e) e.preventDefault();
    if (!channelData) {
      toast.error("Channel data not loaded yet.");
      return;
    }
    setSavingThumbnailTheme(true);
    try {
      const payload = { ...channelData, thumbnailTheme: thumbnailTheme.trim() };
      const res = await fetch(`/api/channels/${channelSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.channel) setChannelData(data.channel);
        setSavedThumbnailTheme(true);
        toast.success("Thumbnail theme saved!");
        setTimeout(() => setSavedThumbnailTheme(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save thumbnail theme");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save thumbnail theme");
    } finally {
      setSavingThumbnailTheme(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. KEEP CONSISTENT (VISUAL IDENTITY / IMAGE THEME) SECTION */}
      <section className="p-6 border border-line bg-paper-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
              <span className="p-1.5 bg-signal/10 text-signal">
                <Eye size={16} />
              </span>
              <span>Consistent Visual Identity (Image Theme)</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Anchor your channel's visual universe. These 4 visual style characteristics remain persistent across every generated scene image.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setJsonInput(JSON.stringify(imageTheme, null, 2));
                setShowJsonModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-signal/30 bg-signal/5 text-signal hover:bg-signal/15 text-xs font-semibold transition-all cursor-pointer"
            >
              <FileCode size={13} />
              <span>Import JSON</span>
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-paper text-ink hover:text-signal text-xs font-semibold transition-all cursor-pointer"
              title="Copy current theme as JSON"
            >
              {copiedJson ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
            </button>

            <button
              type="button"
              onClick={handleClearTheme}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-line bg-paper text-ink-muted hover:text-red-600 text-xs transition-all cursor-pointer"
              title="Clear all fields"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* 4 Structured Keep Consistent Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {IMAGE_THEME_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5 p-3.5 border border-line/60 bg-white/40">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`field-${field.key}`}
                  className="block text-xs font-bold text-ink flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                  <span>{field.label}</span>
                </label>
                <span className="text-[10px] font-mono text-ink-muted">{field.key}</span>
              </div>
              <p className="text-[11px] text-ink-muted leading-tight">{field.description}</p>
              <textarea
                id={`field-${field.key}`}
                rows={3}
                value={imageTheme[field.key] || ""}
                onChange={(e) => handleThemeFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full p-2.5 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal resize-y"
              />
            </div>
          ))}
        </div>

        {/* Action bar for Image Theme */}
        <div className="flex items-center justify-between pt-2 border-t border-line/60">
          <div className="text-[11px] font-mono text-ink-muted">
            {hasImageThemeContent(imageTheme) ? (
              <span className="text-signal font-semibold">● Visual identity active & configured</span>
            ) : (
              <span>○ Identity not configured yet</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveImageTheme}
            disabled={savingTheme}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
          >
            {savingTheme ? <Loader2 size={13} className="animate-spin" /> : savedTheme ? <Check size={13} /> : <Save size={13} />}
            <span>{savingTheme ? "Saving Identity..." : savedTheme ? "Saved!" : "Save Image Theme"}</span>
          </button>
        </div>
      </section>

      {/* 2. CHANNEL CHARACTERS (RECURRING CAST & MASCOTS) SECTION */}
      <section className="p-6 border border-line bg-paper-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
              <span className="p-1.5 bg-signal/10 text-signal">
                <Users size={16} />
              </span>
              <span>Channel Characters (Recurring Cast & Mascots)</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Define multiple characters with precise physical specifications and signature wardrobe. Mark one as the <strong>Main Character</strong> to be automatically used when content pillars have "Use Main Character" enabled.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateCharacter}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Add Character</span>
          </button>
        </div>

        {loadingCharacters ? (
          <div className="flex items-center justify-center py-8 text-ink-muted gap-2 text-xs">
            <Loader2 size={16} className="animate-spin text-signal" />
            <span>Loading characters...</span>
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-line bg-paper/50 p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-signal/10 text-signal flex items-center justify-center mx-auto">
              <User size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-ink">No characters created yet</p>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Create your channel's protagonist or recurring mascot with consistent physical features, signature details, and wardrobe.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateCharacter}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-signal text-white text-xs font-semibold hover:bg-signal-hover transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Create First Character</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {characters.map((char) => {
              const isMain = Boolean(char.is_main ?? char.isMain);
              return (
                <div
                  key={char.id}
                  className={`p-4 border transition-all ${
                    isMain
                      ? "border-signal bg-signal/[0.03] shadow-xs ring-1 ring-signal/20"
                      : "border-line/70 bg-white/50 hover:border-line"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3 pb-2.5 border-b border-line/60">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-full ${isMain ? "bg-signal text-white" : "bg-ink/5 text-ink-muted"}`}>
                        <User size={14} />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-ink leading-tight">{char.name}</h4>
                        <span className="text-[10px] font-mono text-ink-muted">ID: {char.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMain ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                          <span>Main Character</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetAsMainCharacter(char)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-line bg-paper hover:border-signal hover:text-signal text-[11px] font-medium text-ink-muted transition-all cursor-pointer"
                          title="Designate as Channel Main Character"
                        >
                          <Star size={11} />
                          <span>Set as Main</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditCharacter(char)}
                        className="p-1.5 border border-line bg-paper hover:text-signal text-ink-muted transition-all cursor-pointer"
                        title="Edit Character"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCharacter(char)}
                        className="p-1.5 border border-line bg-paper hover:text-red-600 text-ink-muted transition-all cursor-pointer"
                        title="Delete Character"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* 3 Structured Spec Fields */}
                  <div className="space-y-2.5 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-semibold text-ink-muted uppercase tracking-wider block">
                        Physical Spec
                      </span>
                      <p className="text-ink font-mono text-[11px] leading-relaxed bg-paper/60 p-2 border border-line/40 rounded-xs">
                        {char.physical_spec || char.physicalSpec || <span className="text-ink-muted italic">None specified</span>}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-semibold text-ink-muted uppercase tracking-wider block">
                        Signature Feature
                      </span>
                      <p className="text-ink font-mono text-[11px] leading-relaxed bg-paper/60 p-2 border border-line/40 rounded-xs">
                        {char.signature_feature || char.signatureFeature || <span className="text-ink-muted italic">None specified</span>}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-semibold text-ink-muted uppercase tracking-wider block">
                        Wardrobe
                      </span>
                      <p className="text-ink font-mono text-[11px] leading-relaxed bg-paper/60 p-2 border border-line/40 rounded-xs">
                        {char.wardrobe || <span className="text-ink-muted italic">None specified</span>}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. THUMBNAIL THEME SECTION */}
      <section className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Palette size={16} />
            </span>
            <span>Thumbnail Theme</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-signal bg-signal/10 px-2 py-0.5">
            High-CTR Cover Directives
          </span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Define the visual style and composition directives for AI-generated thumbnails on this channel.
        </p>
        <form onSubmit={handleSaveThumbnailTheme} className="space-y-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-thumbnail-theme-pool">
              <Palette size={13} className="text-signal" />
              <span>Thumbnail_Theme</span>
            </label>
            <span className="text-[10px] font-mono text-ink-muted uppercase">High-CTR Cover Directives</span>
          </div>
          <textarea
            id="field-thumbnail-theme-pool"
            rows={3}
            value={thumbnailTheme}
            onChange={(e) => setThumbnailTheme(e.target.value)}
            placeholder="e.g. Bold golden typography, dramatic high-contrast focal point, dark obsidian background, mysterious vault lighting"
            className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingThumbnailTheme}
              className="inline-flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              {savingThumbnailTheme ? <Loader2 size={13} className="animate-spin" /> : savedThumbnailTheme ? <Check size={13} /> : <Save size={13} />}
              <span>{savingThumbnailTheme ? "Saving..." : savedThumbnailTheme ? "Saved!" : "Save Thumbnail Theme"}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 4. USE IMAGE POOL PREFERENCE TOGGLE */}
      <section className="p-5 border border-line bg-paper-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-signal" />
              <span className="text-xs font-bold text-ink">Use Image Pool for Scene Visuals</span>
              {savingPoolToggle && <Loader2 size={12} className="animate-spin text-signal" />}
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              When enabled, topic studios can randomly assign images from this pool to all scene frames with one click. When disabled, scene visuals will be generated directly using the visual identity and character specifications above.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={channelUseImagePool}
              onChange={(e) => handleToggleUseImagePool(e.target.checked)}
              disabled={savingPoolToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-line peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-signal"></div>
          </label>
        </div>
      </section>

      {/* 4. REUSABLE IMAGE POOL LIBRARY */}
      <div className="p-4 sm:p-5 border border-line bg-paper-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-signal" />
            <h2 className="text-lg font-display font-bold text-ink">Channel Image Pool</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 bg-signal/10 text-signal border border-signal/20 font-semibold uppercase">
              Reusable Media Library
            </span>
          </div>
          <p className="text-xs text-ink-muted max-w-2xl leading-relaxed">
            Upload images here once for this channel. When creating video topics, click{" "}
            <strong className="text-ink">"Assign from Pool"</strong> in the Images tab to randomly distribute these visuals across your scenes with zero manual placement.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => loadPoolImages(activePool)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-paper text-ink hover:text-signal text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh image pool"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Pool Segmented Tabs (Shorts vs Longform) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActivePool("shorts")}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              activePool === "shorts"
                ? "bg-signal text-white border-signal shadow-xs"
                : "bg-paper-card text-ink-muted hover:text-ink border-line"
            }`}
          >
            <Smartphone size={15} />
            <span>Shorts Pool (9:16)</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 border rounded-xs ${
                activePool === "shorts" ? "bg-white/20 border-white/30 text-white" : "bg-paper border-line text-ink-muted"
              }`}
            >
              {poolData.shortsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActivePool("longform")}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              activePool === "longform"
                ? "bg-signal text-white border-signal shadow-xs"
                : "bg-paper-card text-ink-muted hover:text-ink border-line"
            }`}
          >
            <Film size={15} />
            <span>Longform Pool (16:9)</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 border rounded-xs ${
                activePool === "longform" ? "bg-white/20 border-white/30 text-white" : "bg-paper border-line text-ink-muted"
              }`}
            >
              {poolData.longformCount}
            </span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-ink-muted flex items-center gap-1.5">
          <Info size={13} className="text-signal" />
          <span>
            {activePool === "shorts"
              ? "Recommended aspect ratio: 9:16 (1080x1920) for Shorts & TikTok"
              : "Recommended aspect ratio: 16:9 (1920x1080 or 1376x768) for YouTube"}
          </span>
        </div>
      </div>

      {/* Upload Zone & Bulk Actions */}
      <div className="p-4 border border-line bg-paper-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Individual image files upload button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files, false)}
            accept="image/png,image/jpeg,image/webp,image/jpg"
            multiple
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            <span>Upload Images</span>
          </button>

          {/* ZIP Archive Bulk Upload button */}
          <input
            type="file"
            ref={zipInputRef}
            onChange={(e) => handleFileUpload(e.target.files, true)}
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => zipInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-line bg-paper text-ink hover:text-signal disabled:opacity-50 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <FolderArchive size={14} className="text-signal" />
            <span>Upload ZIP</span>
          </button>

          {/* Select all toggle */}
          {poolData.images.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-paper text-ink-muted hover:text-ink text-xs font-medium transition-all cursor-pointer ml-1"
            >
              {selectedIds.size === poolData.images.length ? (
                <>
                  <CheckSquare size={13} className="text-signal" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={13} />
                  <span>Select All ({poolData.images.length})</span>
                </>
              )}
            </button>
          )}

          {/* Delete selected button */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => handleDeleteImages(Array.from(selectedIds))}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer animate-fade-in"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-xs font-mono text-signal">
            <Loader2 size={13} className="animate-spin" />
            <span>{uploadProgress || "Uploading..."}</span>
          </div>
        )}
      </div>

      {/* Images Grid */}
      {loading ? (
        <div className="p-16 border border-line bg-paper-card text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs font-mono text-ink-muted">Loading image pool assets...</p>
        </div>
      ) : poolData.images.length === 0 ? (
        <div className="p-16 border border-dashed border-line-dark bg-paper text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-signal/10 text-signal flex items-center justify-center mx-auto">
            <ImageIcon size={22} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink">
              No images in the {activePool === "shorts" ? "Shorts (9:16)" : "Longform (16:9)"} pool yet
            </h3>
            <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
              Upload standalone images or drop a ZIP archive. They will be stored securely in Cloudflare R2 and ready for automated scene assignment across all your channel topics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Upload size={13} />
            <span>Upload Your First Images</span>
          </button>
        </div>
      ) : (
        <div
          className={`grid gap-3 ${
            activePool === "shorts"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
              : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          }`}
        >
          {poolData.images.map((img) => {
            const isSelected = selectedIds.has(img.id);
            return (
              <div
                key={img.id}
                className={`group relative border transition-all bg-paper overflow-hidden ${
                  isSelected ? "border-signal ring-2 ring-signal/30 shadow-md" : "border-line hover:border-line-dark"
                }`}
              >
                {/* Image display */}
                <div
                  className={`w-full overflow-hidden bg-black/5 flex items-center justify-center cursor-pointer ${
                    activePool === "shorts" ? "aspect-9/16" : "aspect-16/9"
                  }`}
                  onClick={() => setLightboxImage(img)}
                >
                  <img
                    src={img.fileUrl}
                    alt={img.fileName || "Pool image"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Selection checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectId(img.id);
                  }}
                  className={`absolute top-2 left-2 p-1 rounded-xs transition-all cursor-pointer ${
                    isSelected
                      ? "bg-signal text-white"
                      : "bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/80"
                  }`}
                  title={isSelected ? "Deselect" : "Select"}
                >
                  {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                </button>

                {/* Single image delete button */}
                <button
                  type="button"
                  disabled={deleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteImages([img.id]);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-xs bg-black/60 text-white/80 hover:bg-red-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Delete image"
                >
                  <Trash2 size={13} />
                </button>

                {/* Lightbox zoom button */}
                <button
                  type="button"
                  onClick={() => setLightboxImage(img)}
                  className="absolute bottom-2 right-2 p-1 rounded-xs bg-black/60 text-white/80 hover:bg-black/90 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Expand view"
                >
                  <Maximize2 size={12} />
                </button>

                {/* Metadata caption */}
                <div className="p-1.5 border-t border-line/60 bg-paper-card text-[10px] font-mono text-ink-muted truncate">
                  {img.fileName || "image"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* JSON Import Modal */}
      {showJsonModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl border border-line bg-paper-card shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <FileCode size={15} className="text-signal" />
                  <span>Import Consistent Visual Identity JSON</span>
                </h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Paste your JSON below to populate the 6 Keep Consistent fields.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowJsonModal(false);
                  setJsonError("");
                }}
                className="text-ink-muted hover:text-ink p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <textarea
                rows={12}
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setJsonError("");
                }}
                placeholder={`{
  "visualStyle": "Cinematic 2D animated illustration with soft anime-inspired line work",
  "characterIdentity": "30-year-old Black man, short buzz cut, trimmed goatee, athletic slim build",
  "wardrobe": "Dark blue oversized hoodie, black raw denim trousers, white sneakers",
  "colorPalette": "Deep blue obsidian, warm amber accents, muted gray shadows",
  "rendering": "High-detail digital illustration, soft volumetric lighting",
  "backgroundTreatment": "Clean cinematic backgrounds with subtle depth of field"
}`}
                className="w-full p-3.5 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal"
              />

              {jsonError && (
                <div className="p-3 border border-red-500/20 bg-red-500/10 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{jsonError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setShowJsonModal(false);
                  setJsonError("");
                }}
                className="px-4 py-2 border border-line bg-paper text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyJson}
                disabled={!jsonInput.trim()}
                className="px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Apply JSON
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create / Edit Character Modal */}
      {characterModalOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setCharacterModalOpen(false)}
        >
          <div
            className="bg-paper border border-line max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-signal/10 text-signal">
                  <User size={16} />
                </span>
                <h3 className="text-sm font-bold text-ink">
                  {editingCharacter ? `Edit Character: ${editingCharacter.name}` : "Create New Character"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCharacterModalOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCharacter} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-ink">
                  Name <span className="text-signal">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="e.g. The Observer, Marcus, Dr. Evelyn Vance"
                  className="w-full p-2.5 border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>

              {/* Physical Spec */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-ink">Physical Spec</label>
                  <span className="text-[10px] font-mono text-ink-muted">Age, build, skin tone, hair, facial features</span>
                </div>
                <textarea
                  rows={3}
                  value={charPhysicalSpec}
                  onChange={(e) => setCharPhysicalSpec(e.target.value)}
                  placeholder="e.g. Lean young adult White male with fair skin, clean-shaven, tousled dark-brown hair, expressive hazel eyes, intense thoughtful demeanor"
                  className="w-full p-2.5 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal resize-y"
                />
              </div>

              {/* Signature Feature */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-ink">Signature Feature</label>
                  <span className="text-[10px] font-mono text-ink-muted">Instantly recognizable anchor</span>
                </div>
                <textarea
                  rows={2}
                  value={charSignatureFeature}
                  onChange={(e) => setCharSignatureFeature(e.target.value)}
                  placeholder="e.g. Signature round amber-tinted glasses, distinct silver signet ring on right hand"
                  className="w-full p-2.5 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal resize-y"
                />
              </div>

              {/* Wardrobe */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-ink">Wardrobe</label>
                  <span className="text-[10px] font-mono text-ink-muted">Consistent clothing & outfit</span>
                </div>
                <textarea
                  rows={2}
                  value={charWardrobe}
                  onChange={(e) => setCharWardrobe(e.target.value)}
                  placeholder="e.g. Burnt-orange button-down overshirt over charcoal T-shirt, dark trousers, minimalist sneakers"
                  className="w-full p-2.5 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal resize-y"
                />
              </div>

              {/* Set as Main Character Checkbox */}
              <div className="p-3 border border-line bg-paper/50 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="char-is-main"
                  checked={charIsMain}
                  onChange={(e) => setCharIsMain(e.target.checked)}
                  className="mt-0.5 accent-signal cursor-pointer"
                />
                <label htmlFor="char-is-main" className="cursor-pointer select-none space-y-0.5">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Star size={12} className={charIsMain ? "fill-amber-500 text-amber-500" : "text-ink-muted"} />
                    <span>Set as Channel Main Character</span>
                  </span>
                  <p className="text-[11px] text-ink-muted leading-tight">
                    When content pillars enable "Use Main Character", this character's structured identity will be automatically injected into generated scene prompts.
                  </p>
                </label>
              </div>

              {/* Modal actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCharacterModalOpen(false)}
                  className="px-4 py-2 border border-line bg-paper text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingChar || !charName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isSavingChar ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{isSavingChar ? "Saving..." : editingCharacter ? "Update Character" : "Create Character"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Modal */}
      {lightboxImage && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-paper border border-line p-2 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-signal text-white hover:bg-signal-hover shadow-md cursor-pointer z-10"
              title="Close"
            >
              <X size={16} />
            </button>
            <img
              src={lightboxImage.fileUrl}
              alt={lightboxImage.fileName}
              className="max-h-[80vh] w-auto object-contain mx-auto"
            />
            <div className="mt-2 text-center text-xs font-mono text-ink-muted">
              {lightboxImage.fileName}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

"use client";

import {
  Film,
  Upload,
  Trash2,
  Plus,
  Play,
  Pause,
  Maximize2,
  X,
  Loader2,
  AlertCircle,
  Video,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  RefreshCw,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function VideoOverlaysTab() {
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aspectFilter, setAspectFilter] = useState("all"); // 'all' | '16:9' | '9:16'

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadAspect, setUploadAspect] = useState("all");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);

  // Gallery interactive states
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [playingId, setPlayingId] = useState(null);
  const [lightboxOverlay, setLightboxOverlay] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    loadOverlays();
  }, []);

  async function loadOverlays() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/overlays");
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
      }

      if (res.ok && data.success) {
        setOverlays(data.overlays || []);
      } else {
        toast.error(data.error || "Failed to load overlays");
      }
    } catch (err) {
      console.error("Error loading overlays:", err);
      toast.error(err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }

  // Filtered list
  const filteredOverlays = overlays.filter((item) => {
    if (aspectFilter === "all") return true;
    return item.aspectRatio === aspectFilter || item.aspectRatio === "all";
  });

  // Handle direct-to-R2 upload submission
  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please choose a video overlay file");
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);
    setUploadProgress("Authorizing storage upload...");

    try {
      // Step 1: Request presigned R2 upload URL
      const presignRes = await fetch("/api/settings/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "presign",
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        }),
      });

      const presignText = await presignRes.text();
      let presignData = {};
      try {
        presignData = JSON.parse(presignText);
      } catch {
        throw new Error(presignText.slice(0, 150) || `Server returned ${presignRes.status}`);
      }

      if (!presignRes.ok || !presignData.uploadUrl) {
        throw new Error(presignData.error || "Failed to obtain storage authorization");
      }

      // Step 2: Upload binary directly to Cloudflare R2 via XMLHttpRequest with progress tracking
      setUploadProgress("Uploading 0%...");
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignData.uploadUrl, true);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
            const loadedMB = (evt.loaded / 1024 / 1024).toFixed(1);
            const totalMB = (evt.total / 1024 / 1024).toFixed(1);
            setUploadPercent(percent);
            setUploadProgress(`${loadedMB}MB / ${totalMB}MB (${percent}%)`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadPercent(100);
            resolve();
          } else {
            reject(new Error(`Storage rejected file (status ${xhr.status}). Check R2 CORS settings.`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Storage upload network error. Ensure Cloudflare R2 allows PUT requests."));
        };

        xhr.ontimeout = () => {
          reject(new Error("Storage upload timed out."));
        };

        xhr.send(selectedFile);
      });

      // Step 3: Record metadata in DB
      setUploadProgress("Registering overlay...");
      const finalName = uploadName.trim() || selectedFile.name.replace(/\.[^/.]+$/, "");
      const createRes = await fetch("/api/settings/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: finalName,
          fileUrl: presignData.publicUrl,
          fileKey: presignData.key,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "video/mp4",
          aspectRatio: uploadAspect,
          sizeBytes: selectedFile.size,
        }),
      });

      const createText = await createRes.text();
      let createData = {};
      try {
        createData = JSON.parse(createText);
      } catch {
        throw new Error(createText.slice(0, 150) || `Server returned ${createRes.status}`);
      }

      if (createRes.ok && createData.success) {
        toast.success(`Overlay "${createData.overlay?.name || finalName}" uploaded successfully!`);
        setUploadModalOpen(false);
        setSelectedFile(null);
        setUploadName("");
        setUploadAspect("all");
        loadOverlays();
      } else {
        throw new Error(createData.error || "Failed to save overlay to database");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload video overlay");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
      setUploadPercent(0);
    }
  }

  // Handle deletion
  async function handleDeleteOverlays(idsToDelete) {
    if (!idsToDelete || idsToDelete.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} overlay(s)?`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/settings/overlays", {
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
        toast.success(`Deleted ${data.deletedCount} overlay(s).`);
        setSelectedIds(new Set());
        loadOverlays();
      } else {
        toast.error(data.error || "Failed to delete overlay(s)");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete overlay(s)");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelectId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredOverlays.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOverlays.map((item) => item.id)));
    }
  }

  return (
    <div className="space-y-6">
      {/* Informational Header Card */}
      <div className="p-4 sm:p-5 border border-line bg-paper-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-signal" />
            <h2 className="text-lg font-display font-bold text-ink">Video Overlays Library</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-signal/10 text-signal border border-signal/20 font-semibold uppercase">
              Visual FX & Textures
            </span>
          </div>
          <p className="text-xs text-ink-muted max-w-2xl leading-relaxed">
            Manage reusable video overlay assets (film grain, light leaks, dust, VHS noise, particle sweeps) to be blended onto scene frames during rendering.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadOverlays}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-paper text-ink hover:text-signal text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh overlay list"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
          >
            <Plus size={14} />
            <span>Add Overlay</span>
          </button>
        </div>
      </div>

      {/* Filter and Selection Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted flex items-center gap-1">
            <SlidersHorizontal size={13} />
            <span>Format:</span>
          </span>
          {["all", "16:9", "9:16"].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setAspectFilter(val)}
              className={`px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                aspectFilter === val
                  ? "bg-signal text-white border-signal"
                  : "bg-paper-card text-ink-muted hover:text-ink border-line"
              }`}
            >
              {val === "all" ? "All Formats" : val === "16:9" ? "16:9 (Longform)" : "9:16 (Shorts)"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {filteredOverlays.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-line bg-paper text-xs font-medium text-ink hover:text-signal cursor-pointer"
            >
              {selectedIds.size === filteredOverlays.length ? (
                <>
                  <CheckSquare size={13} className="text-signal" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={13} />
                  <span>Select All ({filteredOverlays.length})</span>
                </>
              )}
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => handleDeleteOverlays(Array.from(selectedIds))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="p-12 border border-line bg-paper-card text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading video overlays...</p>
        </div>
      ) : filteredOverlays.length === 0 ? (
        <div className="p-12 border border-line bg-paper-card text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-signal/10 text-signal border border-signal/20 flex items-center justify-center">
            <Film size={22} />
          </div>
          <h4 className="text-sm font-semibold text-ink">No video overlays uploaded yet</h4>
          <p className="text-xs text-ink-muted max-w-md mx-auto">
            Upload MP4 or WebM video overlays such as film grain, ambient dust, light leaks, or glitch effects.
          </p>
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
          >
            <Plus size={14} />
            <span>Upload First Overlay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOverlays.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isPlaying = playingId === item.id;
            const isVertical = item.aspectRatio === "9:16";

            return (
              <div
                key={item.id}
                className={`group relative border transition-all bg-paper-card flex flex-col ${
                  isSelected ? "border-signal ring-2 ring-signal/30 shadow-md" : "border-line hover:border-line-dark hover:shadow-xs"
                }`}
              >
                {/* Video Preview Container */}
                <div
                  className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => toggleSelectId(item.id)}
                >
                  <video
                    src={item.fileUrl}
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain pointer-events-none"
                    ref={(el) => {
                      if (!el) return;
                      if (isPlaying) el.play().catch(() => {});
                      else el.pause();
                    }}
                  />

                  {/* Checkbox (Top Left) */}
                  <div
                    className="absolute top-2 left-2 z-10 p-1 bg-black/50 backdrop-blur-xs rounded-xs cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectId(item.id);
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-white fill-signal" />
                    ) : (
                      <Square size={16} className="text-white/80 hover:text-white" />
                    )}
                  </div>

                  {/* Format Tag (Bottom Left) */}
                  <div className="absolute bottom-2 left-2 z-10">
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase bg-black/70 text-white border border-white/20 rounded-xs">
                      {item.aspectRatio === "all" ? "Universal" : item.aspectRatio}
                    </span>
                  </div>

                  {/* Action Overlay Controls (Center & Right) */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingId(isPlaying ? null : item.id);
                      }}
                      className="p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-transform transform hover:scale-110 cursor-pointer shadow-lg"
                      title={isPlaying ? "Pause preview" : "Play preview"}
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-0.5" />}
                    </button>
                  </div>

                  {/* Top Right Quick Actions */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxOverlay(item);
                      }}
                      className="p-1.5 bg-black/70 hover:bg-black text-white rounded-xs cursor-pointer"
                      title="Enlarge video player"
                    >
                      <Maximize2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOverlays([item.id]);
                      }}
                      className="p-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xs cursor-pointer"
                      title="Delete overlay"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-3 border-t border-line space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-ink truncate" title={item.name}>
                      {item.name}
                    </h4>
                    <span className="text-[10px] font-mono text-ink-muted shrink-0">
                      {formatBytes(item.sizeBytes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted">
                    <span className="truncate" title={item.fileName}>
                      {item.fileName}
                    </span>
                    <span className="shrink-0">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Overlay Modal */}
      {mounted && uploadModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
        >
          <div className="relative w-full max-w-md bg-paper border border-line p-6 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-signal" />
                <h3 className="text-base font-display font-semibold text-ink">
                  Add Video Overlay
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* File Picker */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-ink">
                  Video File (MP4, WebM, MOV) *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 border-2 border-dashed border-line bg-white/60 hover:border-signal/50 cursor-pointer text-center space-y-1"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        if (!uploadName.trim()) {
                          setUploadName(file.name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                  />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <Film size={24} className="text-signal mx-auto" />
                      <p className="font-semibold text-ink truncate">{selectedFile.name}</p>
                      <p className="text-[10px] font-mono text-ink-muted">{formatBytes(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="space-y-1 py-1">
                      <Upload size={24} className="text-ink-muted mx-auto" />
                      <p className="font-semibold text-ink">Click to select video overlay</p>
                      <p className="text-[10px] text-ink-muted">MP4, WebM, or MOV up to 100MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Overlay Name */}
              <div className="space-y-1">
                <label className="block font-semibold text-ink" htmlFor="overlay-name-input">
                  Overlay Title / Preset Name *
                </label>
                <input
                  id="overlay-name-input"
                  type="text"
                  required
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. 35mm Vintage Film Grain"
                  className="w-full p-2.5 border border-line bg-white text-ink outline-none focus:border-signal"
                />
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-1">
                <label className="block font-semibold text-ink">
                  Target Aspect Ratio
                </label>
                <select
                  value={uploadAspect}
                  onChange={(e) => setUploadAspect(e.target.value)}
                  className="w-full p-2.5 border border-line bg-white text-ink outline-none focus:border-signal"
                >
                  <option value="all">Universal / Flexible (Fits both 16:9 & 9:16)</option>
                  <option value="16:9">16:9 Landscape (Longform only)</option>
                  <option value="9:16">9:16 Vertical (Shorts / Reels only)</option>
                </select>
              </div>

              {/* Progress Indicator */}
              {isUploading && (
                <div className="p-3 bg-paper-subtle border border-line space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-ink font-semibold flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin text-signal shrink-0" />
                      <span className="truncate">{uploadProgress || "Uploading..."}</span>
                    </span>
                    <span className="text-signal font-bold shrink-0">{uploadPercent}%</span>
                  </div>
                  <div className="w-full bg-line h-2 overflow-hidden rounded-xs">
                    <div
                      className="bg-signal h-full transition-all duration-150"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border border-line text-ink hover:bg-ink/5 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover disabled:opacity-50 text-white font-semibold cursor-pointer shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>{uploadProgress || "Uploading..."}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span>Upload Overlay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Video Player Modal */}
      {mounted && lightboxOverlay && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={() => setLightboxOverlay(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxOverlay(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 cursor-pointer"
            >
              <X size={24} />
            </button>
            <video
              src={lightboxOverlay.fileUrl}
              controls
              autoPlay
              loop
              className="max-w-full max-h-[80vh] shadow-2xl border border-white/10"
            />
            <div className="mt-3 text-center text-xs font-mono text-white/80">
              {lightboxOverlay.name} ({lightboxOverlay.aspectRatio}) • {formatBytes(lightboxOverlay.sizeBytes)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

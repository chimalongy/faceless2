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
  Info
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

export default function ChannelImagePoolView({ channelSlug, channelTitle, useImagePool = false }) {
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

  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

        // Step 1: Request presigned R2 upload URL
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

        // Step 2: Upload ZIP directly to Cloudflare R2 via XMLHttpRequest with progress tracking
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

        // Step 3: Server processes and extracts images from the uploaded ZIP
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
        // Direct individual image files upload
        const fileList = Array.from(files);
        setUploadProgress(`Authorizing upload for ${fileList.length} image(s)...`);

        // Step 1: Batch presign URLs
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

        // Step 2: Upload each image directly to R2 in parallel chunks
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

        // Step 3: Record metadata in DB
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

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
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
              ? "Shorts pool provides vertical 9:16 visuals (768×1376)"
              : "Longform pool provides horizontal 16:9 visuals (1376×768)"}
          </span>
        </div>
      </div>

      {/* Upload Dropzone Section */}
      <div className="p-6 border-2 border-dashed border-line bg-paper-card/60 text-center space-y-3 relative hover:border-signal/50 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, false)}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, true)}
        />

        {uploading ? (
          <div className="py-6 space-y-3 max-w-sm mx-auto">
            <Loader2 size={28} className="animate-spin text-signal mx-auto" />
            <p className="text-xs font-semibold text-ink">{uploadProgress || "Uploading files..."}</p>
            {uploadPercent > 0 && (
              <div className="w-full bg-line h-2 overflow-hidden rounded-xs">
                <div
                  className="bg-signal h-full transition-all duration-150"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            )}
            <p className="text-[11px] text-ink-muted">Please wait while images are optimized and synced to storage.</p>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            <div className="w-12 h-12 mx-auto bg-signal/10 text-signal border border-signal/20 flex items-center justify-center">
              {activePool === "shorts" ? <Smartphone size={22} /> : <Film size={22} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Add Images to {activePool === "shorts" ? "Shorts Pool (9:16)" : "Longform Pool (16:9)"}
              </h3>
              <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto">
                Upload as many images as you want. Select multiple images at once or drop a single{" "}
                <strong className="text-ink">.zip</strong> archive to bulk import.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
              >
                <Upload size={14} />
                <span>Upload Images</span>
              </button>
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-line bg-paper text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold cursor-pointer transition-all"
              >
                <FolderArchive size={14} className="text-amber-600" />
                <span>Bulk Upload ZIP</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gallery Header Controls */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {poolData.images.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-line bg-paper text-xs font-medium text-ink hover:text-signal cursor-pointer"
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

          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => handleDeleteImages(Array.from(selectedIds))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}
        </div>

        <span className="text-xs font-mono text-ink-muted">
          Showing {poolData.images.length} {activePool === "shorts" ? "Shorts (9:16)" : "Longform (16:9)"} visual(s)
        </span>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="p-12 border border-line bg-paper-card text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading pool assets...</p>
        </div>
      ) : poolData.images.length === 0 ? (
        <div className="p-12 border border-line bg-paper-card text-center space-y-3">
          <div className="w-10 h-10 mx-auto bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <h4 className="text-sm font-semibold text-ink">
            No images in the {activePool === "shorts" ? "Shorts" : "Longform"} pool yet
          </h4>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            Upload images or a .zip archive above. Once uploaded, they will be instantly available to assign to any scene in this channel.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            activePool === "shorts"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          }`}
        >
          {poolData.images.map((img) => {
            const isSelected = selectedIds.has(img.id);
            return (
              <div
                key={img.id}
                onClick={() => toggleSelectId(img.id)}
                className={`group relative border transition-all cursor-pointer bg-paper-card flex flex-col ${
                  isSelected ? "border-signal ring-2 ring-signal/30 shadow-md" : "border-line hover:border-line-dark hover:shadow-xs"
                }`}
              >
                {/* Image Container */}
                <div
                  className={`relative w-full overflow-hidden bg-black/5 ${
                    activePool === "shorts" ? "aspect-[9/16]" : "aspect-video"
                  }`}
                >
                  <img
                    src={img.fileUrl}
                    alt={img.fileName || "Pool Image"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Selection Checkbox (Top Left) */}
                  <div
                    className="absolute top-2 left-2 z-10 p-1 bg-black/40 backdrop-blur-xs rounded-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectId(img.id);
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-white fill-signal" />
                    ) : (
                      <Square size={16} className="text-white/80 hover:text-white" />
                    )}
                  </div>

                  {/* Action Overlay (Top Right) */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxImage(img);
                      }}
                      className="p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-xs cursor-pointer transition-colors"
                      title="Enlarge preview"
                    >
                      <Maximize2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImages([img.id]);
                      }}
                      className="p-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xs cursor-pointer transition-colors"
                      title="Delete from pool"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Card Meta Footer */}
                <div className="p-2 border-t border-line text-[11px] font-mono text-ink-muted truncate">
                  <p className="truncate text-ink font-medium" title={img.fileName}>
                    {img.fileName || "pool-image.png"}
                  </p>
                  <p className="text-[10px] text-ink-muted/70 pt-0.5">
                    {img.sizeBytes ? `${(img.sizeBytes / 1024).toFixed(0)} KB` : "Stored in R2"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {mounted && lightboxImage && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 cursor-pointer"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImage.fileUrl}
              alt={lightboxImage.fileName}
              className="max-w-full max-h-[80vh] object-contain shadow-2xl border border-white/10"
            />
            <div className="mt-3 text-center text-xs font-mono text-white/80">
              {lightboxImage.fileName} ({activePool === "shorts" ? "Shorts 9:16" : "Longform 16:9"})
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

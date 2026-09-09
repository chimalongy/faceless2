"use client";

import {
  Film,
  Upload,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  ImageOff,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Download,
  CheckSquare,
  Square,
  X,
  FileCode,
  Copy,
  Check,
  Code,
  FolderArchive,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Grid
} from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

export default function ImagesTab({
  scenesJson,
  setScenesJson,
  sceneImages,
  isGeneratingAllImages = false,
  generatingSceneImages = {},
  isExtractingZip = false,
  handleUploadSceneImage,
  handleUploadZipImages,
  handleDeleteSceneImage,
  handleDeleteMultipleSceneImages,
  handleGenerateSceneImage,
  handleGenerateAllImages,
  isShort = false,
}) {
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [downloadingScenes, setDownloadingScenes] = useState({});
  const [selectedScenes, setSelectedScenes] = useState(new Set());
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editablePromptJson, setEditablePromptJson] = useState("");
  const [promptModalError, setPromptModalError] = useState("");
  const [copiedJson, setCopiedJson] = useState(false);
  const [includeAudioText, setIncludeAudioText] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Active view per scene card: "all" (grid/filmstrip of all frames) or a number (1, 2, 3...) for focused frame
  const [sceneFrameView, setSceneFrameView] = useState({});

  // Fullscreen Lightbox Modal state: { sceneNum, frameIndex, totalFrames, url, name, prompt, sceneImagesList }
  const [lightbox, setLightbox] = useState(null);

  // Live ZIP upload & extraction progress state
  const [zipProgress, setZipProgress] = useState({
    active: false,
    percent: 0,
    stage: "",
    fileName: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard navigation for Lightbox modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (!lightbox) return;
      if (e.key === "Escape") {
        setLightbox(null);
      } else if (e.key === "ArrowLeft") {
        navigateLightbox(-1);
      } else if (e.key === "ArrowRight") {
        navigateLightbox(1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox]);

  function navigateLightbox(direction) {
    if (!lightbox || !Array.isArray(lightbox.frames) || lightbox.frames.length <= 1) return;
    const currentIndex = lightbox.frameIndex - 1;
    const nextIndex = (currentIndex + direction + lightbox.frames.length) % lightbox.frames.length;
    const nextFrame = lightbox.frames[nextIndex];
    if (nextFrame) {
      setLightbox({
        ...lightbox,
        frameIndex: nextIndex + 1,
        url: nextFrame.url,
        name: nextFrame.name,
        prompt: nextFrame.prompt,
      });
    }
  }

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  function togglePrompt(sceneNum) {
    setExpandedPrompts((prev) => ({
      ...prev,
      [sceneNum]: !prev[sceneNum],
    }));
  }

  function toggleSelectScene(sceneNum) {
    setSelectedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneNum)) {
        next.delete(sceneNum);
      } else {
        next.add(sceneNum);
      }
      return next;
    });
  }

  const ungeneratedScenes = parsedScenes.filter((s) => {
    const sNum = s.scene_number;
    const imgData = sceneImages[sNum] || sceneImages[String(sNum)] || sceneImages[Number(sNum)];
    return !imgData?.url && (!Array.isArray(imgData?.images) || imgData.images.length === 0);
  });

  const isAllUngeneratedSelected =
    ungeneratedScenes.length > 0 &&
    selectedScenes.size === ungeneratedScenes.length &&
    ungeneratedScenes.every((s) => selectedScenes.has(s.scene_number));

  function handleSelectAllScenes() {
    setSelectedScenes(new Set(parsedScenes.map((s) => s.scene_number)));
  }

  function handleToggleUngeneratedScenes() {
    if (isAllUngeneratedSelected) {
      setSelectedScenes(new Set());
    } else {
      setSelectedScenes(new Set(ungeneratedScenes.map((s) => s.scene_number)));
      if (ungeneratedScenes.length === 0) {
        toast("All scene images have already been generated / uploaded.", { icon: "✨" });
      } else {
        toast.success(`Selected ${ungeneratedScenes.length} ungenerated scene(s).`);
      }
    }
  }

  function handleDeselectAll() {
    setSelectedScenes(new Set());
  }

  function onDeleteBatchClick() {
    if (selectedScenes.size === 0) return;
    const arrayToDelete = Array.from(selectedScenes);
    if (handleDeleteMultipleSceneImages) {
      handleDeleteMultipleSceneImages(arrayToDelete);
      setSelectedScenes(new Set());
    }
  }

  // Handle Upload ZIP with real-time byte progress
  async function onZipFileSelected(file) {
    if (!file) return;
    setZipProgress({
      active: true,
      percent: 0,
      stage: `Preparing to upload ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`,
      fileName: file.name,
      status: "uploading",
    });

    try {
      if (handleUploadZipImages) {
        await handleUploadZipImages(file, (progress) => {
          setZipProgress((prev) => ({
            ...prev,
            ...progress,
          }));
        });
      }
      setZipProgress((prev) => ({
        ...prev,
        percent: 100,
        stage: "Extraction complete! Mapping images to scenes...",
        status: "done",
      }));
      setTimeout(() => {
        setZipProgress({ active: false, percent: 0, stage: "", fileName: "", status: "idle" });
      }, 1500);
    } catch (err) {
      console.error("ZIP Upload error:", err);
      setZipProgress({ active: false, percent: 0, stage: "", fileName: "", status: "idle" });
    }
  }

  // Get JSON array of selected scene prompts with optional audio_text inclusion
  function getPromptsJsonData(onlySelected = true, withAudio = includeAudioText) {
    const targetScenes = onlySelected && selectedScenes.size > 0
      ? parsedScenes.filter((s) => selectedScenes.has(s.scene_number))
      : parsedScenes;

    return targetScenes.map((s) => {
      const item = {
        scene_number: s.scene_number,
      };
      if (withAudio) {
        item.audio_text = s.audio_text || s.narration || s.script || s.voiceover || s.text || "";
      }
      if (Array.isArray(s.images) && s.images.length > 0) {
        item.number_of_images = s.number_of_images || s.images.length;
        item.images = s.images;
      }
      item.image_prompt = s.image_prompt || s.images?.[0]?.image_prompt || "";
      return item;
    });
  }

  function handleOpenPromptJsonModal(onlySelected = true) {
    const data = getPromptsJsonData(onlySelected, includeAudioText);
    setEditablePromptJson(JSON.stringify(data, null, 2));
    setPromptModalError("");
    setCopiedJson(false);
    setPromptModalOpen(true);
  }

  function handleCopyPromptsJson() {
    const data = getPromptsJsonData(true, includeAudioText);
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString);
    toast.success(
      `Copied ${data.length} scene prompt(s) ${includeAudioText ? "with audio text " : ""}as JSON to clipboard!`
    );
  }

  function handleDownloadPromptsJson() {
    const data = getPromptsJsonData(true, includeAudioText);
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `scene-image-prompts.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    toast.success("Prompts JSON downloaded.");
  }

  function handleApplyPromptJson(e) {
    if (e) e.preventDefault();
    setPromptModalError("");

    try {
      const parsed = JSON.parse(editablePromptJson);
      if (!Array.isArray(parsed)) {
        throw new Error("Prompt JSON must be an array of objects: [{ scene_number, image_prompt, audio_text? }]");
      }

      const promptMap = new Map();
      parsed.forEach((item) => {
        const sNum = item.scene_number || item.sceneIndex || item.scene;
        if (sNum !== undefined) {
          promptMap.set(Number(sNum), {
            image_prompt: item.image_prompt ?? item.visual_prompt ?? item.prompt,
            audio_text: item.audio_text ?? item.narration ?? item.script ?? item.voiceover ?? item.text,
            number_of_images: item.number_of_images,
            images: Array.isArray(item.images) ? item.images : undefined,
          });
        }
      });

      const updated = parsedScenes.map((s) => {
        if (promptMap.has(Number(s.scene_number))) {
          const item = promptMap.get(Number(s.scene_number));
          const next = { ...s };
          if (item.image_prompt !== undefined) next.image_prompt = item.image_prompt;
          if (item.audio_text !== undefined) next.audio_text = item.audio_text;
          if (item.number_of_images !== undefined) next.number_of_images = item.number_of_images;
          if (item.images !== undefined) next.images = item.images;
          return next;
        }
        return s;
      });

      if (setScenesJson) {
        setScenesJson(JSON.stringify(updated, null, 2));
      }
      setPromptModalOpen(false);
      toast.success(`Updated ${promptMap.size} scene(s) from JSON.`);
    } catch (err) {
      setPromptModalError(err.message || "Failed to parse JSON. Please check formatting.");
    }
  }

  async function handleDownloadImage(sceneNum, url, imageName) {
    if (!url) return;
    const downloadKey = `${sceneNum}_${imageName || url}`;
    setDownloadingScenes((prev) => ({ ...prev, [downloadKey]: true }));
    const filename = imageName || `scene-${sceneNum}-visual.png`;
    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download proxy returned error");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.warn("Falling back to direct download link:", err);
      const link = document.createElement("a");
      link.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingScenes((prev) => ({ ...prev, [downloadKey]: false }));
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Film size={16} className="text-signal" /> Scene Visual Assets & Multi-Image Manager
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Review multiple frames per scene, inspect individual image prompts, upload archives, or synthesize AI visuals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Upload ZIP Archive Button */}
            <label
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer ${
                isExtractingZip || zipProgress.active ? "opacity-60 pointer-events-none" : ""
              }`}
              title="Upload ZIP archive of scene images (e.g. 1_1.jfif, 1_2.jfif, 2.jpg)"
            >
              {isExtractingZip || zipProgress.active ? (
                <>
                  <Loader2 size={13} className="animate-spin text-signal" />
                  <span>Unpacking ZIP...</span>
                </>
              ) : (
                <>
                  <FolderArchive size={13} className="text-signal" />
                  <span>Upload ZIP</span>
                </>
              )}
              <input
                type="file"
                accept=".zip,application/zip"
                disabled={isExtractingZip || zipProgress.active}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onZipFileSelected(file);
                  }
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>

            {/* Select All Toggle */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={selectedScenes.size === parsedScenes.length ? handleDeselectAll : handleSelectAllScenes}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                title="Select all scenes"
              >
                {selectedScenes.size === parsedScenes.length ? (
                  <>
                    <CheckSquare size={13} className="text-signal" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={13} />
                    <span>Select All ({parsedScenes.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Select Ungenerated Scenes Button */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={handleToggleUngeneratedScenes}
                className={`inline-flex items-center gap-1.5 px-3 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer ${
                  ungeneratedScenes.length === 0 ? "opacity-60" : ""
                }`}
                title="Select only scenes whose images have not been generated or uploaded yet"
              >
                {isAllUngeneratedSelected ? (
                  <>
                    <CheckSquare size={13} className="text-signal" />
                    <span>Deselect Ungenerated ({ungeneratedScenes.length})</span>
                  </>
                ) : (
                  <>
                    <ImageOff size={13} className="text-amber-600" />
                    <span>Select Ungenerated ({ungeneratedScenes.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Prompts JSON Option Button */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenPromptJsonModal(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                title="View or edit all image prompts as JSON"
              >
                <Code size={13} className="text-signal" />
                <span>Prompts (JSON)</span>
              </button>
            )}

            {/* Generate All */}
            <button
              type="button"
              disabled={isGeneratingAllImages || parsedScenes.length === 0}
              onClick={handleGenerateAllImages}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-60 shrink-0"
            >
              {isGeneratingAllImages ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating Remaining Images...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Generate All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live ZIP Upload & Extraction Progress Card */}
        {zipProgress.active && (
          <div className="p-4 bg-paper-dark border-2 border-signal/40 shadow-sm space-y-2.5 animate-slide-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive size={16} className="text-signal animate-bounce" />
                <span className="text-xs font-semibold text-ink font-mono">
                  {zipProgress.status === "uploading"
                    ? `Uploading ZIP to R2: ${zipProgress.fileName}`
                    : `Processing ZIP: ${zipProgress.fileName}`}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-signal">
                {zipProgress.percent}%
              </span>
            </div>

            <div className="w-full h-2 bg-line rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  zipProgress.status === "processing" ? "bg-amber-500 animate-pulse" : "bg-signal"
                }`}
                style={{ width: `${zipProgress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-muted font-mono">
              <span className="truncate pr-2">{zipProgress.stage}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 border shrink-0 ${
                  zipProgress.status === "uploading"
                    ? "text-blue-800 bg-blue-50 border-blue-300"
                    : zipProgress.status === "done"
                    ? "text-emerald-800 bg-emerald-50 border-emerald-300"
                    : "text-amber-800 bg-amber-50 border-amber-300"
                }`}
              >
                {zipProgress.status === "uploading"
                  ? "Direct R2 Upload"
                  : zipProgress.status === "done"
                  ? "Completed"
                  : "Trigger.dev Worker Active"}
              </span>
            </div>
          </div>
        )}

        {/* Selected Scenes Action Bar */}
        {selectedScenes.size > 0 && (
          <div className="p-3 bg-paper-dark border border-signal/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
              <span className="text-xs font-semibold text-ink font-mono">
                {selectedScenes.size} scene{selectedScenes.size > 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-line text-[11px] font-semibold text-ink cursor-pointer select-none rounded-sm hover:bg-ink/5">
                <input
                  type="checkbox"
                  checked={includeAudioText}
                  onChange={(e) => setIncludeAudioText(e.target.checked)}
                  className="w-3.5 h-3.5 accent-signal cursor-pointer"
                />
                <span>Include Audio Text</span>
              </label>

              <button
                type="button"
                onClick={handleCopyPromptsJson}
                className="px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-[11px] font-semibold text-ink transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Copy selected image prompts in JSON format"
              >
                <Copy size={12} className="text-signal" />
                <span>Copy Prompts JSON</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPromptJsonModal(true)}
                className="px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-[11px] font-semibold text-ink transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Open JSON editor for selected scene prompts"
              >
                <FileCode size={12} className="text-signal" />
                <span>Edit / View Prompts JSON</span>
              </button>

              <button
                type="button"
                onClick={onDeleteBatchClick}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                title="Delete generated images for selected scenes"
              >
                <Trash2 size={12} />
                <span>Delete Selected Images</span>
              </button>

              <button
                type="button"
                onClick={handleDeselectAll}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-ink/5 rounded-full transition-colors cursor-pointer"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid of Scene Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
              Scene Visuals ({parsedScenes.length} Scenes)
            </h4>
            <span
              className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded border ${
                isShort
                  ? "text-signal bg-signal/10 border-signal/30"
                  : "text-ink-muted bg-ink/5 border-line"
              }`}
            >
              {isShort ? "9:16 Short Format" : "16:9 Landscape"}
            </span>
          </div>
        </div>

        {parsedScenes.length === 0 ? (
          <div className="p-8 border border-line bg-paper-card text-center space-y-2 text-ink-muted">
            <AlertCircle size={32} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes defined</p>
            <p className="text-xs text-ink-muted">
              Add scenes in the "Scenes (JSON)" tab to start managing visual assets.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-5 ${
              isShort
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                : "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"
            }`}
          >
            {parsedScenes.map((scene) => {
              const sceneNum = scene.scene_number;
              const imgData =
                sceneImages[sceneNum] ||
                sceneImages[String(sceneNum)] ||
                sceneImages[Number(sceneNum)];

              const isSelected = selectedScenes.has(sceneNum);

              // 1. Gather all prompt definitions for this scene
              const definedPrompts = Array.isArray(scene.images) && scene.images.length > 0
                ? scene.images.map((img, i) => ({
                    image_number: img.image_number || i + 1,
                    image_prompt: img.image_prompt || img.prompt || "",
                  }))
                : [
                    {
                      image_number: 1,
                      image_prompt: scene.image_prompt || "",
                    },
                  ];

              // 2. Gather all existing uploaded/generated image assets for this scene
              const uploadedImagesList = Array.isArray(imgData?.images) && imgData.images.length > 0
                ? imgData.images
                : imgData?.url
                ? [
                    {
                      url: imgData.url,
                      key: imgData.key,
                      name: imgData.name,
                      endpointUsed: imgData.endpointUsed,
                    },
                  ]
                : [];

              // 3. Determine total frames: maximum of defined prompts, number_of_images field, and uploaded files
              const totalFrames = Math.max(
                definedPrompts.length,
                Number(scene.number_of_images) || 0,
                uploadedImagesList.length,
                1
              );

              const isMultiImage = totalFrames > 1;

              // Build normalized list of frames for this scene
              const frames = Array.from({ length: totalFrames }, (_, idx) => {
                const frameNum = idx + 1;
                const asset = uploadedImagesList[idx] || null;
                const promptObj = definedPrompts[idx] || definedPrompts[0] || {};
                const promptText = promptObj.image_prompt || scene.image_prompt || "";

                return {
                  frameNumber: frameNum,
                  url: asset?.url || null,
                  key: asset?.key || null,
                  name: asset?.name || `scene-${sceneNum}-${frameNum}.png`,
                  endpointUsed: asset?.endpointUsed || imgData?.endpointUsed || null,
                  prompt: promptText,
                  hasImage: !!asset?.url,
                };
              });

              const uploadedCount = frames.filter((f) => f.hasImage).length;
              const isFullyLoaded = uploadedCount >= totalFrames && totalFrames > 0;
              const currentView = sceneFrameView[sceneNum] || "all"; // "all" or 1, 2, 3...
              const isGeneratingOverall =
                !!generatingSceneImages[sceneNum] || isGeneratingAllImages;

              return (
                <div
                  key={sceneNum}
                  className={`border bg-paper-card flex flex-col justify-between transition-all overflow-hidden rounded-xs ${
                    isSelected
                      ? "border-signal ring-2 ring-signal/20 bg-signal/5 shadow-sm"
                      : "border-line hover:border-signal/40"
                  }`}
                >
                  {/* Scene Card Header */}
                  <div className="p-3 border-b border-line/60 bg-paper-dark/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Checkbox */}
                      <label className="flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectScene(sceneNum)}
                          className="w-3.5 h-3.5 text-signal rounded border-line cursor-pointer accent-signal"
                          title="Select this scene"
                        />
                      </label>

                      <span className="w-5 h-5 bg-ink text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {sceneNum}
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink truncate">
                        SCENE 0{sceneNum}
                      </span>

                      {/* Multi-Image Indicator Badge */}
                      {isMultiImage ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-xs shrink-0 ${
                            isFullyLoaded
                              ? "text-emerald-800 bg-emerald-50 border border-emerald-300"
                              : uploadedCount > 0
                              ? "text-amber-800 bg-amber-50 border border-amber-300"
                              : "text-ink-muted bg-ink/5 border border-line"
                          }`}
                        >
                          <Layers size={11} className={isFullyLoaded ? "text-emerald-600" : "text-signal"} />
                          <span>
                            {uploadedCount}/{totalFrames} Images
                          </span>
                        </span>
                      ) : (
                        uploadedCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Image uploaded" />
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Toggle Prompt Button */}
                      <button
                        type="button"
                        onClick={() => togglePrompt(sceneNum)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-[10px] font-semibold text-ink transition-all cursor-pointer"
                        title="Toggle image prompt text"
                      >
                        {expandedPrompts[sceneNum] ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{expandedPrompts[sceneNum] ? "Hide" : "Prompt"}</span>
                      </button>

                      {/* Clear All Images for Scene */}
                      {uploadedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSceneImage(sceneNum)}
                          className="p-1 rounded-sm text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete all images for this scene"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-Frame Navigation Sub-header (only when multiple images) */}
                  {isMultiImage && (
                    <div className="px-3 py-1.5 bg-paper-dark/70 border-b border-line/40 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        <button
                          type="button"
                          onClick={() =>
                            setSceneFrameView((prev) => ({ ...prev, [sceneNum]: "all" }))
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer shrink-0 ${
                            currentView === "all"
                              ? "bg-signal text-white shadow-2xs"
                              : "bg-white text-ink border border-line hover:bg-ink/5"
                          }`}
                        >
                          <Grid size={11} />
                          <span>All ({totalFrames})</span>
                        </button>

                        {frames.map((f) => (
                          <button
                            key={f.frameNumber}
                            type="button"
                            onClick={() =>
                              setSceneFrameView((prev) => ({
                                ...prev,
                                [sceneNum]: f.frameNumber,
                              }))
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer shrink-0 ${
                              currentView === f.frameNumber
                                ? "bg-signal text-white shadow-2xs"
                                : "bg-white text-ink border border-line hover:bg-ink/5"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                f.hasImage ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                            />
                            <span>#{f.frameNumber}</span>
                          </button>
                        ))}
                      </div>

                      <span className="text-[10px] font-mono text-ink-muted shrink-0">
                        {currentView === "all" ? "Multi-View" : `Frame ${currentView}/${totalFrames}`}
                      </span>
                    </div>
                  )}

                  {/* Visual Content Display Area */}
                  <div className="p-3 bg-paper-dark/20 flex-1 flex flex-col justify-center">
                    {/* CASE 1: All Frames Grid View */}
                    {isMultiImage && currentView === "all" ? (
                      <div
                        className={`grid gap-2.5 ${
                          frames.length === 2
                            ? "grid-cols-2"
                            : frames.length === 3
                            ? "grid-cols-3"
                            : frames.length === 4
                            ? "grid-cols-2 sm:grid-cols-4"
                            : "grid-cols-3 sm:grid-cols-5"
                        }`}
                      >
                        {frames.map((f) => {
                          const isGenThisFrame =
                            generatingSceneImages[`${sceneNum}_${f.frameNumber}`] ||
                            (isGeneratingOverall && !f.hasImage);
                          const isDown = downloadingScenes[`${sceneNum}_${f.name}`];

                          return (
                            <div
                              key={f.frameNumber}
                              className="group relative border border-line bg-paper-card overflow-hidden flex flex-col justify-between shadow-2xs hover:border-signal/50 transition-all"
                            >
                              {/* Frame Card Header Pill */}
                              <div className="px-2 py-1 bg-paper-dark/80 border-b border-line/50 flex items-center justify-between text-[10px] font-mono">
                                <span className="font-bold text-ink">#{f.frameNumber}</span>
                                <span
                                  className={`text-[9px] px-1 rounded ${
                                    f.hasImage
                                      ? "text-emerald-800 bg-emerald-100/80"
                                      : "text-amber-800 bg-amber-100/80"
                                  }`}
                                >
                                  {f.hasImage ? "Loaded" : "Empty"}
                                </span>
                              </div>

                              {/* Frame Preview Image Box */}
                              <div
                                className={`relative w-full ${
                                  isShort ? "aspect-[9/16]" : "aspect-video"
                                } bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer`}
                                onClick={() => {
                                  if (f.hasImage) {
                                    setLightbox({
                                      sceneNum,
                                      frameIndex: f.frameNumber,
                                      totalFrames,
                                      url: f.url,
                                      name: f.name,
                                      prompt: f.prompt,
                                      frames,
                                    });
                                  } else {
                                    setSceneFrameView((prev) => ({
                                      ...prev,
                                      [sceneNum]: f.frameNumber,
                                    }));
                                  }
                                }}
                              >
                                {isGenThisFrame ? (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-center p-2">
                                    <div className="space-y-1">
                                      <Loader2 size={16} className="animate-spin text-signal mx-auto" />
                                      <p className="text-[9px] font-mono text-white/80 font-semibold">
                                        Generating #{f.frameNumber}...
                                      </p>
                                    </div>
                                  </div>
                                ) : f.hasImage ? (
                                  <>
                                    <img
                                      src={f.url}
                                      alt={`Scene ${sceneNum} Frame ${f.frameNumber}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {/* Hover overlay with zoom icon */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLightbox({
                                            sceneNum,
                                            frameIndex: f.frameNumber,
                                            totalFrames,
                                            url: f.url,
                                            name: f.name,
                                            prompt: f.prompt,
                                            frames,
                                          });
                                        }}
                                        className="p-1.5 rounded-full bg-white/90 hover:bg-white text-ink shadow-sm transition-transform active:scale-95"
                                        title="View Fullscreen"
                                      >
                                        <Maximize2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadImage(sceneNum, f.url, f.name);
                                        }}
                                        className="p-1.5 rounded-full bg-white/90 hover:bg-white text-ink shadow-sm transition-transform active:scale-95"
                                        title="Download Frame"
                                      >
                                        <Download size={12} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="p-2 text-center text-white/40 space-y-1">
                                    <ImageIcon size={18} className="mx-auto opacity-50" />
                                    <p className="text-[9px] font-mono">No visual</p>
                                  </div>
                                )}
                              </div>

                              {/* Frame Action Toolbar */}
                              <div className="p-1.5 bg-paper-card border-t border-line/60 flex items-center justify-between gap-1">
                                {/* Upload / Replace Frame */}
                                <label
                                  className="p-1 rounded text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer shrink-0"
                                  title={`Upload / Replace Frame #${f.frameNumber}`}
                                >
                                  <Upload size={11} />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleUploadSceneImage(sceneNum, file, f.frameNumber);
                                      }
                                      e.target.value = "";
                                    }}
                                    className="hidden"
                                  />
                                </label>

                                {/* Generate single frame */}
                                <button
                                  type="button"
                                  disabled={isGenThisFrame}
                                  onClick={() => handleGenerateSceneImage(sceneNum, f.frameNumber)}
                                  className="p-1 rounded text-signal hover:bg-signal/10 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                  title={`Generate Frame #${f.frameNumber} with AI`}
                                >
                                  <Sparkles size={11} />
                                </button>

                                {/* Delete single frame */}
                                {f.hasImage && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteSceneImage(sceneNum, f.frameNumber, f.key, f.url)
                                    }
                                    className="p-1 rounded text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                                    title={`Delete Frame #${f.frameNumber}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* CASE 2: Single Frame Focused View (or standard single image scene) */
                      (() => {
                        const activeFrameIndex =
                          typeof currentView === "number" ? currentView : 1;
                        const activeFrame =
                          frames[activeFrameIndex - 1] || frames[0] || {};
                        const isGenActive =
                          generatingSceneImages[`${sceneNum}_${activeFrameIndex}`] ||
                          (isGeneratingOverall && !activeFrame.hasImage);
                        const isDownActive = downloadingScenes[`${sceneNum}_${activeFrame.name}`];

                        return (
                          <div className="space-y-2">
                            {/* Featured Image Box */}
                            <div
                              className={`relative ${
                                isShort ? "aspect-[9/16]" : "aspect-video"
                              } w-full bg-slate-950 text-white overflow-hidden flex items-center justify-center rounded-xs group shadow-inner`}
                            >
                              {/* Aspect Ratio Badge */}
                              <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-black/75 text-white/90 backdrop-blur-xs rounded border border-white/10 pointer-events-none z-10">
                                {isShort ? "9:16" : "16:9"}
                              </span>

                              {/* Frame Position Badge (if multi-image) */}
                              {isMultiImage && (
                                <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-signal text-white backdrop-blur-xs rounded pointer-events-none z-10 shadow-sm">
                                  Frame {activeFrameIndex} / {totalFrames}
                                </span>
                              )}

                              {isGenActive ? (
                                <div className="relative w-full h-full flex items-center justify-center bg-slate-900 text-center p-3 space-y-1.5">
                                  <div className="space-y-1.5">
                                    <Loader2 size={24} className="animate-spin text-signal mx-auto" />
                                    <p className="text-[11px] font-mono text-white/90 font-semibold">
                                      Generating Scene 0{sceneNum}
                                      {isMultiImage ? ` Frame #${activeFrameIndex}` : ""}...
                                    </p>
                                  </div>
                                </div>
                              ) : activeFrame.hasImage ? (
                                <>
                                  <img
                                    src={activeFrame.url}
                                    alt={`Scene ${sceneNum} Frame ${activeFrameIndex}`}
                                    className="w-full h-full object-cover"
                                  />

                                  {/* Fullscreen zoom overlay button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightbox({
                                        sceneNum,
                                        frameIndex: activeFrameIndex,
                                        totalFrames,
                                        url: activeFrame.url,
                                        name: activeFrame.name,
                                        prompt: activeFrame.prompt,
                                        frames,
                                      })
                                    }
                                    className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                  >
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-ink text-xs font-semibold rounded shadow-md transform translate-y-1 group-hover:translate-y-0 transition-transform">
                                      <Maximize2 size={13} />
                                      <span>View Fullscreen</span>
                                    </span>
                                  </button>
                                </>
                              ) : (
                                <div className="text-center space-y-1.5 p-4 text-white/50">
                                  <ImageIcon size={28} className="mx-auto opacity-40 text-white" />
                                  <p className="text-[11px] font-mono text-white/70">
                                    {isMultiImage
                                      ? `Frame #${activeFrameIndex} not generated yet`
                                      : "No image yet"}
                                  </p>
                                </div>
                              )}

                              {/* Multi-Image Previous / Next Overlay Navigation Arrows */}
                              {isMultiImage && frames.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const prevIdx =
                                        activeFrameIndex > 1
                                          ? activeFrameIndex - 1
                                          : totalFrames;
                                      setSceneFrameView((prev) => ({
                                        ...prev,
                                        [sceneNum]: prevIdx,
                                      }));
                                    }}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md z-10"
                                    title="Previous Frame"
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextIdx =
                                        activeFrameIndex < totalFrames
                                          ? activeFrameIndex + 1
                                          : 1;
                                      setSceneFrameView((prev) => ({
                                        ...prev,
                                        [sceneNum]: nextIdx,
                                      }));
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md z-10"
                                    title="Next Frame"
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </>
                              )}

                              {activeFrame.endpointUsed && activeFrame.hasImage && (
                                <span
                                  className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[9px] font-mono text-emerald-900 bg-emerald-100/90 backdrop-blur-xs border border-emerald-300 max-w-[140px] truncate"
                                  title={activeFrame.endpointUsed}
                                >
                                  {activeFrame.endpointUsed}
                                </span>
                              )}
                            </div>

                            {/* Focused Frame Controls Bar */}
                            <div className="p-2 bg-paper-card border border-line flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                {/* Upload / Replace Frame */}
                                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-[10px] font-semibold text-ink transition-all cursor-pointer">
                                  <Upload size={11} />
                                  <span>
                                    {activeFrame.hasImage
                                      ? isMultiImage
                                        ? `Replace #${activeFrameIndex}`
                                        : "Replace"
                                      : isMultiImage
                                      ? `Upload #${activeFrameIndex}`
                                      : "Upload"}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleUploadSceneImage(
                                          sceneNum,
                                          file,
                                          isMultiImage ? activeFrameIndex : null
                                        );
                                      }
                                      e.target.value = "";
                                    }}
                                    className="hidden"
                                  />
                                </label>

                                {/* Download */}
                                {activeFrame.hasImage && (
                                  <button
                                    type="button"
                                    disabled={isDownActive}
                                    onClick={() =>
                                      handleDownloadImage(
                                        sceneNum,
                                        activeFrame.url,
                                        activeFrame.name
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-ink text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                                    title="Download image"
                                  >
                                    {isDownActive ? (
                                      <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                      <Download size={11} />
                                    )}
                                    <span>Download</span>
                                  </button>
                                )}

                                {/* Delete single frame */}
                                {activeFrame.hasImage && isMultiImage && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteSceneImage(
                                        sceneNum,
                                        activeFrameIndex,
                                        activeFrame.key,
                                        activeFrame.url
                                      )
                                    }
                                    className="p-1 rounded-sm text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title={`Delete Frame #${activeFrameIndex}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>

                              {/* Generate single frame */}
                              <button
                                type="button"
                                disabled={isGenActive}
                                onClick={() =>
                                  handleGenerateSceneImage(
                                    sceneNum,
                                    isMultiImage ? activeFrameIndex : null
                                  )
                                }
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-sm border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                                title={`Generate ${
                                  isMultiImage ? `Frame #${activeFrameIndex}` : "image"
                                } with AI`}
                              >
                                {isGenActive ? (
                                  <>
                                    <Loader2 size={11} className="animate-spin" />
                                    <span>Generating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={11} />
                                    <span>
                                      {activeFrame.hasImage ? "Regenerate" : "Generate"}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* Image Prompt Box (Accordion view) */}
                  {expandedPrompts[sceneNum] && (
                    <div className="p-3 bg-paper-dark/60 border-t border-line space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-ink-muted uppercase font-mono">
                          Visual Directives ({definedPrompts.length} Prompt{definedPrompts.length > 1 ? "s" : ""}):
                        </span>
                      </div>

                      {definedPrompts.map((p, pIdx) => {
                        const frameNum = p.image_number || pIdx + 1;
                        const matchingFrame = frames[pIdx];

                        return (
                          <div
                            key={pIdx}
                            className="p-2.5 bg-paper-card border border-line space-y-1.5 rounded-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-semibold text-signal flex items-center gap-1.5">
                                <span>Image #{frameNum}</span>
                                {matchingFrame?.hasImage && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Image uploaded" />
                                )}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(p.image_prompt || "");
                                  toast.success(`Copied Frame #${frameNum} prompt!`);
                                }}
                                className="text-[10px] font-mono text-ink-muted hover:text-signal inline-flex items-center gap-1 cursor-pointer"
                                title="Copy prompt to clipboard"
                              >
                                <Copy size={11} />
                                <span>Copy</span>
                              </button>
                            </div>
                            <p className="font-mono text-[11px] text-ink leading-relaxed break-words">
                              {p.image_prompt || "No visual prompt provided."}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prompts JSON Modal (View / Copy / Edit & Apply Prompts) */}
      {mounted && promptModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPromptModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl bg-paper border border-line p-5 sm:p-7 shadow-2xl space-y-4 animate-scale-in text-ink max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-signal/10 text-signal flex items-center justify-center">
                  <FileCode size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-display font-semibold text-ink">
                    Scene Image Prompts (JSON)
                  </h3>
                  <p className="text-xs text-ink-muted">
                    View, copy, download, or edit visual prompt directives formatted as JSON.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromptModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPromptJson} className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                  <label className="flex items-center gap-1.5 font-semibold text-ink/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeAudioText}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIncludeAudioText(checked);
                        const data = getPromptsJsonData(selectedScenes.size > 0, checked);
                        setEditablePromptJson(JSON.stringify(data, null, 2));
                      }}
                      className="w-3.5 h-3.5 accent-signal cursor-pointer"
                    />
                    <span>Include Audio Text (<code className="font-mono text-[11px] bg-ink/5 px-1 py-0.5 rounded">audio_text</code>)</span>
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(editablePromptJson);
                        setCopiedJson(true);
                        setTimeout(() => setCopiedJson(false), 2000);
                        toast.success("JSON copied to clipboard!");
                      }}
                      className="text-signal hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedJson ? "Copied!" : "Copy JSON"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPromptsJson}
                      className="text-signal hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <textarea
                  required
                  rows={14}
                  value={editablePromptJson}
                  onChange={(e) => {
                    setEditablePromptJson(e.target.value);
                    if (promptModalError) setPromptModalError("");
                  }}
                  className="w-full flex-1 min-h-[240px] p-3.5 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal resize-y"
                />
              </div>

              {promptModalError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{promptModalError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-line">
                <p className="text-[11px] text-ink-muted">
                  Tip: Editing and applying will update image prompts {includeAudioText ? "and audio narration " : ""}across scenes.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPromptModalOpen(false)}
                    className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-signal hover:bg-signal-hover active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check size={14} /> Apply Updates
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {mounted && lightbox && createPortal(
        <div
          className="fixed inset-0 z-[999999] w-screen h-screen bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 999999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          }}
        >
          {/* Top Bar of Lightbox */}
          <div className="flex items-center justify-between gap-4 text-white z-10">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 bg-signal text-white font-mono text-xs font-bold flex items-center justify-center rounded">
                {lightbox.sceneNum}
              </span>
              <div>
                <h4 className="font-mono text-sm font-semibold">
                  Scene 0{lightbox.sceneNum}
                  {lightbox.totalFrames > 1 ? ` • Frame ${lightbox.frameIndex} of ${lightbox.totalFrames}` : ""}
                </h4>
                <p className="text-[11px] text-white/60 font-mono truncate max-w-sm sm:max-w-md">
                  {lightbox.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadImage(lightbox.sceneNum, lightbox.url, lightbox.name)}
                className="p-2 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Download High-Res Image"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="p-2 rounded bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Central Image Viewport with Previous & Next navigation */}
          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0">
            {lightbox.frames && lightbox.frames.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => navigateLightbox(-1)}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg z-20 backdrop-blur-xs"
                  title="Previous Frame (Left Arrow)"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => navigateLightbox(1)}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg z-20 backdrop-blur-xs"
                  title="Next Frame (Right Arrow)"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            <img
              src={lightbox.url}
              alt={`Scene ${lightbox.sceneNum} Frame ${lightbox.frameIndex}`}
              className="max-w-full max-h-full object-contain rounded shadow-2xl animate-scale-in"
            />
          </div>

          {/* Bottom Bar: Prompt Info & Frame Strip */}
          <div className="p-3 sm:p-4 bg-slate-900/90 border border-white/10 rounded-md backdrop-blur-md max-w-4xl mx-auto w-full text-white space-y-2.5 z-10">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-signal">
                Visual Directive {lightbox.totalFrames > 1 ? `(Frame #${lightbox.frameIndex})` : ""}:
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lightbox.prompt || "");
                  toast.success("Prompt copied to clipboard!");
                }}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-white/80 hover:text-white cursor-pointer hover:underline"
              >
                <Copy size={12} />
                <span>Copy Prompt</span>
              </button>
            </div>

            <p className="text-xs text-white/90 font-mono leading-relaxed max-h-20 overflow-y-auto pr-1">
              {lightbox.prompt || "No visual prompt description provided for this frame."}
            </p>

            {/* Thumbnail Strip inside Lightbox */}
            {lightbox.frames && lightbox.frames.length > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                {lightbox.frames.map((f, fIdx) => (
                  <button
                    key={fIdx}
                    type="button"
                    onClick={() => {
                      setLightbox({
                        ...lightbox,
                        frameIndex: f.frameNumber,
                        url: f.url,
                        name: f.name,
                        prompt: f.prompt,
                      });
                    }}
                    className={`w-12 h-8 rounded border overflow-hidden transition-all cursor-pointer ${
                      lightbox.frameIndex === f.frameNumber
                        ? "border-signal ring-2 ring-signal/50 scale-105"
                        : "border-white/20 opacity-60 hover:opacity-100"
                    }`}
                  >
                    {f.hasImage ? (
                      <img src={f.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[9px] font-mono text-white/50">
                        #{f.frameNumber}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

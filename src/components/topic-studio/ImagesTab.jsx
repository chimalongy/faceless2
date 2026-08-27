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
  FolderArchive
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
    return !imgData?.url;
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
      item.image_prompt = s.image_prompt || "";
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

      // Map incoming prompts into parsedScenes
      const promptMap = new Map();
      parsed.forEach((item) => {
        const sNum = item.scene_number || item.sceneIndex || item.scene;
        if (sNum !== undefined) {
          promptMap.set(Number(sNum), {
            image_prompt: item.image_prompt ?? item.visual_prompt ?? item.prompt,
            audio_text: item.audio_text ?? item.narration ?? item.script ?? item.voiceover ?? item.text,
          });
        }
      });

      const updated = parsedScenes.map((s) => {
        if (promptMap.has(Number(s.scene_number))) {
          const item = promptMap.get(Number(s.scene_number));
          const next = { ...s };
          if (item.image_prompt !== undefined) next.image_prompt = item.image_prompt;
          if (item.audio_text !== undefined) next.audio_text = item.audio_text;
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
    setDownloadingScenes((prev) => ({ ...prev, [sceneNum]: true }));
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
      setDownloadingScenes((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Film size={16} className="text-signal" /> Scene Visual Assets & Imagery
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Upload single files, extract a batch ZIP by scene number, manage prompts in JSON format, or generate AI visuals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Upload ZIP Archive Button */}
            <label
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer ${
                isExtractingZip || zipProgress.active ? "opacity-60 pointer-events-none" : ""
              }`}
              title="Upload ZIP archive of scene images (e.g. 1.png_timestamp, 2.jpg)"
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

            {/* Progress Track */}
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
              {/* Option to include audio text toggle */}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-line text-[11px] font-semibold text-ink cursor-pointer select-none rounded-sm hover:bg-ink/5">
                <input
                  type="checkbox"
                  checked={includeAudioText}
                  onChange={(e) => setIncludeAudioText(e.target.checked)}
                  className="w-3.5 h-3.5 accent-signal cursor-pointer"
                />
                <span>Include Audio Text</span>
              </label>

              {/* Option 1: Copy Selected Prompts as JSON */}
              <button
                type="button"
                onClick={handleCopyPromptsJson}
                className="px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-[11px] font-semibold text-ink transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Copy selected image prompts in JSON format"
              >
                <Copy size={12} className="text-signal" />
                <span>Copy Prompts JSON</span>
              </button>

              {/* Option 2: View / Edit Selected Prompts in JSON Modal */}
              <button
                type="button"
                onClick={() => handleOpenPromptJsonModal(true)}
                className="px-3 py-1.5 border border-line bg-white hover:bg-ink/5 text-[11px] font-semibold text-ink transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Open JSON editor for selected scene prompts"
              >
                <FileCode size={12} className="text-signal" />
                <span>Edit / View Prompts JSON</span>
              </button>

              {/* Option 3: Delete Selected Images */}
              <button
                type="button"
                onClick={onDeleteBatchClick}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                title="Delete generated images for selected scenes"
              >
                <Trash2 size={12} />
                <span>Delete Selected Images</span>
              </button>

              {/* Clear Selection */}
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

      {/* 3-Column Desktop Grid for Scene Visuals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
            Scene Visuals ({parsedScenes.length} Scenes)
          </h4>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {parsedScenes.map((scene) => {
              const sceneNum = scene.scene_number;
              const imgData = sceneImages[sceneNum] || sceneImages[String(sceneNum)] || sceneImages[Number(sceneNum)];
              const hasImage = !!imgData?.url;
              const isSelected = selectedScenes.has(sceneNum);
              const isGeneratingThis = !!generatingSceneImages[sceneNum] || isGeneratingAllImages;
              const isDownloading = !!downloadingScenes[sceneNum];

              return (
                <div
                  key={sceneNum}
                  className={`border bg-paper-card flex flex-col justify-between transition-all overflow-hidden ${
                    isSelected
                      ? "border-signal ring-2 ring-signal/20 bg-signal/5 shadow-sm"
                      : "border-line hover:border-signal/40"
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="p-3 border-b border-line/60 bg-paper-dark/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Selection Checkbox */}
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

                      {/* Delete Button */}
                      {hasImage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSceneImage(sceneNum)}
                          className="p-1 rounded-sm text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete image for this scene"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 16:9 Image Preview Box */}
                  <div className="relative aspect-video w-full bg-ink text-white overflow-hidden flex items-center justify-center">
                    {generatingSceneImages[sceneNum] || (isGeneratingAllImages && !hasImage) ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-slate-900 text-center p-3 space-y-1.5">
                        <div className="space-y-1.5">
                          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
                          <p className="text-[11px] font-mono text-white/90 font-semibold">Generating Scene 0{sceneNum}...</p>
                        </div>
                      </div>
                    ) : hasImage ? (
                      <img
                        src={imgData.url}
                        alt={`Scene ${sceneNum}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center space-y-1.5 p-4 text-white/50">
                        <ImageIcon size={24} className="mx-auto opacity-40 text-white" />
                        <p className="text-[11px] font-mono text-white/70">No image yet</p>
                      </div>
                    )}

                    {imgData?.endpointUsed && hasImage && (
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[9px] font-mono text-emerald-900 bg-emerald-100/90 backdrop-blur-xs border border-emerald-300 max-w-[120px] truncate" title={imgData.endpointUsed}>
                        {imgData.endpointUsed}
                      </span>
                    )}
                  </div>

                  {/* Image Prompt Box (Accordion view) */}
                  {expandedPrompts[sceneNum] && (
                    <div className="p-3 bg-paper-dark/60 border-t border-line space-y-1 animate-fade-in">
                      <span className="text-[10px] font-semibold text-ink-muted uppercase font-mono">
                        Prompt:
                      </span>
                      <p className="font-mono text-[11px] text-ink leading-relaxed break-words max-h-24 overflow-y-auto">
                        {scene.image_prompt || "No visual prompt provided for this scene."}
                      </p>
                    </div>
                  )}

                  {/* Bottom Action Footer */}
                  <div className="p-2.5 bg-paper-card border-t border-line/60 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {/* Upload / Replace Image File */}
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-[10px] font-semibold text-ink transition-all cursor-pointer">
                        <Upload size={11} />
                        <span>{hasImage ? "Replace" : "Upload"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUploadSceneImage(sceneNum, file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      {/* Download Scene Image Button */}
                      {hasImage && (
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => handleDownloadImage(sceneNum, imgData.url, imgData.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-line bg-white hover:bg-ink/5 text-ink text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                          title="Download image"
                        >
                          {isDownloading ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Download size={11} />
                          )}
                          <span>Download</span>
                        </button>
                      )}
                    </div>

                    {/* Generate Button for Individual Scene */}
                    <button
                      type="button"
                      disabled={isGeneratingThis}
                      onClick={() => handleGenerateSceneImage(sceneNum)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-sm border border-signal/30 bg-signal/10 hover:bg-signal hover:text-white text-signal text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                      title="Generate image for this scene"
                    >
                      {generatingSceneImages[sceneNum] ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={11} />
                          <span>{hasImage ? "Regenerate" : "Generate"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prompts JSON Modal (View / Copy / Edit & Apply Prompts with Audio Text Toggle) */}
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
                  {/* Toggle Include Audio Text inside modal */}
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
    </div>
  );
}

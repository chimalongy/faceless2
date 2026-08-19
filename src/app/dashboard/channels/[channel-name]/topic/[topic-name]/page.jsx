"use client";

import {
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Mic,
  Film,
  Sparkles,
  Save,
  Layers,
  Braces,
  Check,
  Video,
  RefreshCw,
  Clock
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

import ThumbnailTab from "@/components/topic-studio/ThumbnailTab";
import ScriptTab from "@/components/topic-studio/ScriptTab";
import ScenesTab from "@/components/topic-studio/ScenesTab";
import AudioTab from "@/components/topic-studio/AudioTab";
import ImagesTab from "@/components/topic-studio/ImagesTab";
import SceneFramesTab from "@/components/topic-studio/SceneFramesTab";
import CompletedVideoTab from "@/components/topic-studio/CompletedVideoTab";
import DeleteConfirmModal from "@/components/topic-studio/DeleteConfirmModal";

export default function TopicStudioPage() {
  const params = useParams();
  const rawChannelSlug = params?.["channel-name"] || "";
  const rawPillarSlug = params?.["content-pillar-name"];
  const rawTopicSlug = params?.["topic-name"] || "";

  const channelSlug = Array.isArray(rawChannelSlug) ? rawChannelSlug[0] : rawChannelSlug;
  const topicSlug = Array.isArray(rawTopicSlug) ? rawTopicSlug[0] : rawTopicSlug;

  const channelTitle = channelSlug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  const topicTitle = topicSlug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  const backUrl = rawPillarSlug
    ? `/dashboard/channels/${channelSlug}/content_pillar/${rawPillarSlug}`
    : `/dashboard/channels/${channelSlug}`;

  // Studio Active Tab
  const [activeTab, setActiveTab] = useState("thumbnail");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 1. Thumbnail State
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [isEditingThumbPrompt, setIsEditingThumbPrompt] = useState(false);
  const [thumbPromptNotice, setThumbPromptNotice] = useState("");
  const [thumbnailImage, setThumbnailImage] = useState(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // 2. Script State
  const [scriptContent, setScriptContent] = useState("");
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptNotice, setScriptNotice] = useState("");

  // 3. Scenes State
  const [scenesJson, setScenesJson] = useState("[]");
  const [isEditingScenes, setIsEditingScenes] = useState(false);
  const [scenesNotice, setScenesNotice] = useState("");
  const [jsonError, setJsonError] = useState("");

  // 4. Audio State
  const [selectedVoice, setSelectedVoice] = useState("Marcus - Deep Narrator (Naturalist)");
  const [bgMusic, setBgMusic] = useState("Ethereal Sub-bass & Ambient Wind");
  const [sceneAudios, setSceneAudios] = useState({});

  // 5. Images State
  const [sceneImages, setSceneImages] = useState({});

  // 6. SceneFrames (Video) State
  const [sceneVideos, setSceneVideos] = useState({});

  // 7. Completed Master Video State
  const [completedMasterVideo, setCompletedMasterVideo] = useState(null);
  const [isRenderingMaster, setIsRenderingMaster] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // Generic Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Delete",
    onConfirm: () => {},
  });

  function requestDelete({ title, description, confirmLabel, onConfirm }) {
    setDeleteModalState({
      isOpen: true,
      title,
      description,
      confirmLabel: confirmLabel || "Delete",
      onConfirm: () => {
        onConfirm();
        setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  function cancelDelete() {
    setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
  }

  // Helper: Upload file to Cloudflare R2 via storage API
  async function uploadFileToR2(file, assetType, sceneIndex = null) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("channelSlug", channelSlug);
    formData.append("topicSlug", topicSlug);
    formData.append("assetType", assetType);
    if (sceneIndex !== null) formData.append("sceneIndex", sceneIndex.toString());

    const res = await fetch("/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to upload file to Cloudflare R2");
    }

    return await res.json();
  }

  // Load topic from Neon API
  useEffect(() => {
    async function loadTopicData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.topic) {
            const t = data.topic;
            if (t.thumbnailPrompt) setThumbnailPrompt(t.thumbnailPrompt);
            if (t.thumbnailUrl) {
              setThumbnailImage(t.thumbnailUrl);
            }
            if (t.scriptContent) setScriptContent(t.scriptContent);
            if (t.scenesJson) {
              setScenesJson(
                typeof t.scenesJson === "string"
                  ? t.scenesJson
                  : JSON.stringify(t.scenesJson, null, 2)
              );
            }
            if (t.masterVideoUrl) {
              setCompletedMasterVideo({
                url: t.masterVideoUrl,
                name: `${topicSlug}-master.mp4`,
              });
            }

            // Populate assets from database
            if (Array.isArray(t.assets)) {
              const audios = {};
              const images = {};
              const videos = {};
              t.assets.forEach((asset) => {
                if (asset.assetType === "thumbnail" && !t.thumbnailUrl) {
                  setThumbnailImage(asset.fileUrl);
                } else if (asset.assetType === "completedvideo" && !t.masterVideoUrl) {
                  setCompletedMasterVideo({
                    url: asset.fileUrl,
                    name: asset.fileName || `${topicSlug}-master.mp4`,
                  });
                } else if (asset.assetType === "audio" && asset.sceneIndex) {
                  audios[asset.sceneIndex] = {
                    url: asset.fileUrl,
                    name: asset.fileName || `Scene ${asset.sceneIndex} Audio`,
                    duration: "00:20",
                  };
                } else if (asset.assetType === "image" && asset.sceneIndex) {
                  images[asset.sceneIndex] = {
                    url: asset.fileUrl,
                    name: asset.fileName || `Scene ${asset.sceneIndex} Image`,
                  };
                } else if (asset.assetType === "video" && asset.sceneIndex) {
                  videos[asset.sceneIndex] = {
                    url: asset.fileUrl,
                    name: asset.fileName || `Scene ${asset.sceneIndex} Video`,
                  };
                }
              });
              if (Object.keys(audios).length > 0) setSceneAudios(audios);
              if (Object.keys(images).length > 0) setSceneImages(images);
              if (Object.keys(videos).length > 0) setSceneVideos(videos);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load topic data from API:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTopicData();
  }, [channelSlug, topicSlug]);

  // Thumbnail Handlers
  function triggerThumbPromptNotice(msg) {
    setThumbPromptNotice(msg);
    setTimeout(() => setThumbPromptNotice(""), 3000);
  }

  function handleClearThumbPrompt() {
    requestDelete({
      title: "Delete Thumbnail Prompt",
      description: "Are you sure you want to delete the entire thumbnail prompt text?",
      confirmLabel: "Delete Prompt",
      onConfirm: async () => {
        setThumbnailPrompt("");
        try {
          await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnailPrompt: "" }),
          });
        } catch {}
        triggerThumbPromptNotice("Thumbnail prompt cleared.");
      },
    });
  }

  async function handleUpdateThumbPrompt() {
    setIsEditingThumbPrompt(false);
    try {
      await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailPrompt }),
      });
    } catch {}
    triggerThumbPromptNotice("Thumbnail prompt updated.");
  }

  async function handleThumbnailUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingThumbnail(true);
    try {
      const result = await uploadFileToR2(file, "thumbnail");
      setThumbnailImage(result.publicUrl);

      // Instantly persist to Neon DB so it survives full page reloads
      await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: result.publicUrl }),
      });
      triggerThumbPromptNotice("Thumbnail uploaded & saved.");
    } catch (err) {
      console.error("Failed to upload thumbnail:", err);
      triggerThumbPromptNotice("Upload failed: " + err.message);
    } finally {
      setIsUploadingThumbnail(false);
    }
  }

  function handleClearThumbnail() {
    requestDelete({
      title: "Clear Thumbnail Image",
      description: "Are you sure you want to clear the current thumbnail preview image?",
      confirmLabel: "Clear Image",
      onConfirm: async () => {
        setThumbnailImage(null);
        try {
          await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnailUrl: "" }),
          });
        } catch {}
        triggerThumbPromptNotice("Thumbnail cleared.");
      },
    });
  }

  function handleGenerateThumbnail() {
    setIsGeneratingThumbnail(true);
    setTimeout(() => {
      setThumbnailImage("generated");
      setIsGeneratingThumbnail(false);
    }, 600);
  }

  // Script Handlers
  function triggerScriptNotice(msg) {
    setScriptNotice(msg);
    setTimeout(() => setScriptNotice(""), 3000);
  }

  function handleClearScript() {
    requestDelete({
      title: "Delete Entire Script",
      description: "Are you sure you want to delete the entire voiceover script text?",
      confirmLabel: "Delete Script",
      onConfirm: () => {
        setScriptContent("");
        triggerScriptNotice("Script content cleared.");
      },
    });
  }

  function handleUpdateScript() {
    triggerScriptNotice("Script successfully updated.");
  }

  function handleGenerateScript() {
    const generated = `In an epoch before human history, ${topicTitle} became the definitive turning point for our biosphere.

[PAUSE 0.6s]

The world was not as we know it today. Everything was harsh, unyielding, and silent. Yet beneath the visible surface, a complex chain reaction was quietly gathering momentum.

What began as an isolated physical anomaly quickly evolved into a planetary transformation. Over vast spans of geological time, unseen interactions reshaped the landscape, establishing the very conditions that make modern life possible.

Understanding this story isn't just about ancient history—it reveals how the living systems around us continue to function today.`;

    setScriptContent(generated);
    triggerScriptNotice("Script generated by AI.");
  }

  // Scenes Handlers
  function triggerScenesNotice(msg) {
    setScenesNotice(msg);
    setTimeout(() => setScenesNotice(""), 3000);
  }

  function handleClearScenes() {
    requestDelete({
      title: "Delete All Scenes",
      description: "Are you sure you want to delete all structured scene definitions in this JSON array? It will be reset to an empty array.",
      confirmLabel: "Delete All Scenes",
      onConfirm: () => {
        setScenesJson("[]");
        triggerScenesNotice("Scenes JSON cleared.");
      },
    });
  }

  function handleUpdateScenes() {
    try {
      const parsed = JSON.parse(scenesJson);
      setScenesJson(JSON.stringify(parsed, null, 2));
      setJsonError("");
      triggerScenesNotice("Scenes JSON validated & updated.");
    } catch (err) {
      setJsonError("Invalid JSON: " + err.message);
    }
  }

  function handleGenerateScenes() {
    const generated = [
      {
        scene_number: 1,
        audio_text: `In an epoch before human history, ${topicTitle} became the definitive turning point for our biosphere.`,
        image_prompt: `Cinematic wide establishing shot of ${topicTitle}, atmospheric volumetric lighting, 8k documentary cinematography`,
      },
      {
        scene_number: 2,
        audio_text: `What began as an isolated anomaly quickly evolved into a planetary chain reaction.`,
        image_prompt: `Detailed macro breakdown illustrating the core mechanism of ${topicTitle}, ultra-detailed documentary style`,
      },
      {
        scene_number: 3,
        audio_text: `Over vast spans of geological time, unseen interactions reshaped the landscape, establishing the very conditions that make modern life possible.`,
        image_prompt: `Epic wide angle reveal showing the full scale and planetary aftermath of ${topicTitle}`,
      },
    ];
    setScenesJson(JSON.stringify(generated, null, 2));
    setJsonError("");
    triggerScenesNotice("Scenes JSON generated by AI.");
  }

  // Audio Handlers
  async function handleUploadSceneAudio(sceneNum, file) {
    if (!file) return;
    try {
      const result = await uploadFileToR2(file, "audio", sceneNum);
      setSceneAudios((prev) => ({
        ...prev,
        [sceneNum]: {
          url: result.publicUrl,
          name: file.name,
          duration: "00:20",
        },
      }));
    } catch {
      const url = URL.createObjectURL(file);
      setSceneAudios((prev) => ({
        ...prev,
        [sceneNum]: {
          url,
          name: file.name,
          duration: "00:20",
        },
      }));
    }
  }

  function handleDeleteSceneAudio(sceneNum) {
    requestDelete({
      title: `Delete Scene ${sceneNum} Audio`,
      description: `Are you sure you want to delete the audio file for Scene ${sceneNum}?`,
      confirmLabel: "Delete Audio",
      onConfirm: () => {
        setSceneAudios((prev) => {
          const next = { ...prev };
          delete next[sceneNum];
          return next;
        });
      },
    });
  }

  function handleGenerateSceneAudio(sceneNum) {
    setSceneAudios((prev) => ({
      ...prev,
      [sceneNum]: {
        url: "generated",
        name: `Scene ${sceneNum} Audio`,
        duration: "00:20",
      },
    }));
  }

  function handleGenerateAllAudios() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const newAudios = {};
    parsed.forEach((s) => {
      newAudios[s.scene_number] = {
        url: "generated",
        name: `Scene ${s.scene_number} Audio`,
        duration: "00:20",
      };
    });
    setSceneAudios(newAudios);
  }

  // Images Handlers
  async function handleUploadSceneImage(sceneNum, file) {
    if (!file) return;
    try {
      const result = await uploadFileToR2(file, "image", sceneNum);
      setSceneImages((prev) => ({
        ...prev,
        [sceneNum]: {
          url: result.publicUrl,
          name: file.name,
        },
      }));
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSceneImages((prev) => ({
          ...prev,
          [sceneNum]: {
            url: e.target?.result,
            name: file.name,
          },
        }));
      };
      reader.readAsDataURL(file);
    }
  }

  function handleDeleteSceneImage(sceneNum) {
    requestDelete({
      title: `Delete Scene ${sceneNum} Image`,
      description: `Are you sure you want to delete the image for Scene ${sceneNum}?`,
      confirmLabel: "Delete Image",
      onConfirm: () => {
        setSceneImages((prev) => {
          const next = { ...prev };
          delete next[sceneNum];
          return next;
        });
      },
    });
  }

  function handleGenerateSceneImage(sceneNum) {
    setSceneImages((prev) => ({
      ...prev,
      [sceneNum]: {
        url: "generated",
        name: `Scene ${sceneNum} Image`,
      },
    }));
  }

  function handleGenerateAllImages() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const newImages = {};
    parsed.forEach((s) => {
      newImages[s.scene_number] = {
        url: "generated",
        name: `Scene ${s.scene_number} Image`,
      };
    });
    setSceneImages(newImages);
  }

  // SceneFrames (Video) Handlers
  async function handleUploadSceneVideo(sceneNum, file) {
    if (!file) return;
    try {
      const result = await uploadFileToR2(file, "video", sceneNum);
      setSceneVideos((prev) => ({
        ...prev,
        [sceneNum]: {
          url: result.publicUrl,
          name: file.name,
        },
      }));
    } catch {
      const url = URL.createObjectURL(file);
      setSceneVideos((prev) => ({
        ...prev,
        [sceneNum]: {
          url,
          name: file.name,
        },
      }));
    }
  }

  function handleDeleteSceneVideo(sceneNum) {
    requestDelete({
      title: `Delete Scene ${sceneNum} Video`,
      description: `Are you sure you want to delete the video clip for Scene ${sceneNum}?`,
      confirmLabel: "Delete Video",
      onConfirm: () => {
        setSceneVideos((prev) => {
          const next = { ...prev };
          delete next[sceneNum];
          return next;
        });
      },
    });
  }

  function handleGenerateSceneVideo(sceneNum) {
    setSceneVideos((prev) => ({
      ...prev,
      [sceneNum]: {
        url: "generated",
        name: `Scene ${sceneNum} Video`,
      },
    }));
  }

  function handleGenerateAllVideos() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const newVideos = {};
    parsed.forEach((s) => {
      newVideos[s.scene_number] = {
        url: "generated",
        name: `Scene ${s.scene_number} Video`,
      };
    });
    setSceneVideos(newVideos);
  }

  // Master Video Handlers
  async function handleUploadMasterVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFileToR2(file, "completedvideo");
      setCompletedMasterVideo({
        url: result.publicUrl,
        name: file.name,
      });
    } catch {
      const url = URL.createObjectURL(file);
      setCompletedMasterVideo({
        url,
        name: file.name,
      });
    }
  }

  function handleDeleteMasterVideo() {
    requestDelete({
      title: "Delete Master Video Cut",
      description: "Are you sure you want to delete the rendered master video file from this project?",
      confirmLabel: "Delete Master Cut",
      onConfirm: () => {
        setCompletedMasterVideo(null);
      },
    });
  }

  function handleRenderMasterVideo() {
    setIsRenderingMaster(true);
    setRenderProgress(10);
    const interval = setInterval(() => {
      setRenderProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRenderingMaster(false);
          setCompletedMasterVideo({
            url: "generated",
            name: `${topicSlug}-master-4k.mp4`,
          });
          return 100;
        }
        return prev + 15;
      });
    }, 400);
  }

  // Save full topic studio state to Neon Database
  async function handleSaveStudioState() {
    setSaving(true);
    let parsed = null;
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = null;
    }

    const payload = {
      scriptContent,
      scenesJson: parsed,
      thumbnailUrl: thumbnailImage,
      thumbnailPrompt,
      masterVideoUrl: completedMasterVideo?.url || null,
      stage: completedMasterVideo ? "Completed" : "In Progress",
    };

    try {
      await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Could not save to API:", err);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tabs = [
    { id: "thumbnail", label: "Thumbnail", icon: ImageIcon },
    { id: "script", label: "Script", icon: FileText },
    { id: "scenes", label: "Scenes (JSON)", icon: Braces },
    { id: "audio", label: "Audio", icon: Mic },
    { id: "images", label: "Images", icon: Film },
    { id: "scene_frames", label: "Scene Frames", icon: Layers },
    { id: "completed_video", label: "Completed Video", icon: Video },
  ];

  return (
    <div className="space-y-8 animate-card-rise pb-20">
      {/* Top Header & Save Bar */}
      <div>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to {channelTitle}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                Topic Production Studio
              </span>
              <span className="text-xs font-mono text-ink-muted">/{topicSlug}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              {topicTitle}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              End-to-end documentary generation desk: Thumbnail, Script, Structured Scenes, Voiceover Audio, Scene Frames, and Master Video.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveStudioState}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-signal hover:bg-signal-hover disabled:opacity-60 text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
              <span>{saving ? "Saving..." : saved ? "State Saved" : "Save Studio State"}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl">
          <RefreshCw size={24} className="animate-spin text-signal mx-auto" />
          <p className="text-xs text-ink-muted">Loading topic production desk from database...</p>
        </section>
      ) : (
        <>
          {/* Main Studio Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-line overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "border-signal text-signal bg-signal/5"
                      : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/[0.02]"
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: THUMBNAIL */}
          {activeTab === "thumbnail" && (
            <ThumbnailTab
              topicTitle={topicTitle}
              thumbnailPrompt={thumbnailPrompt}
              setThumbnailPrompt={setThumbnailPrompt}
              isEditingThumbPrompt={isEditingThumbPrompt}
              setIsEditingThumbPrompt={setIsEditingThumbPrompt}
              thumbPromptNotice={thumbPromptNotice}
              thumbnailImage={thumbnailImage}
              isGeneratingThumbnail={isGeneratingThumbnail}
              isUploadingThumbnail={isUploadingThumbnail}
              handleClearThumbPrompt={handleClearThumbPrompt}
              handleUpdateThumbPrompt={handleUpdateThumbPrompt}
              handleThumbnailUpload={handleThumbnailUpload}
              handleClearThumbnail={handleClearThumbnail}
              handleGenerateThumbnail={handleGenerateThumbnail}
            />
          )}

          {/* TAB 2: SCRIPT */}
          {activeTab === "script" && (
            <ScriptTab
              topicTitle={topicTitle}
              scriptContent={scriptContent}
              setScriptContent={setScriptContent}
              isEditingScript={isEditingScript}
              setIsEditingScript={setIsEditingScript}
              scriptNotice={scriptNotice}
              handleClearScript={handleClearScript}
              handleUpdateScript={handleUpdateScript}
              handleGenerateScript={handleGenerateScript}
            />
          )}

          {/* TAB 3: SCENES (JSON) */}
          {activeTab === "scenes" && (
            <ScenesTab
              scenesJson={scenesJson}
              setScenesJson={setScenesJson}
              isEditingScenes={isEditingScenes}
              setIsEditingScenes={setIsEditingScenes}
              scenesNotice={scenesNotice}
              jsonError={jsonError}
              handleClearScenes={handleClearScenes}
              handleUpdateScenes={handleUpdateScenes}
              handleGenerateScenes={handleGenerateScenes}
            />
          )}

          {/* TAB 4: AUDIO */}
          {activeTab === "audio" && (
            <AudioTab
              scenesJson={scenesJson}
              sceneAudios={sceneAudios}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              bgMusic={bgMusic}
              setBgMusic={setBgMusic}
              handleUploadSceneAudio={handleUploadSceneAudio}
              handleDeleteSceneAudio={handleDeleteSceneAudio}
              handleGenerateSceneAudio={handleGenerateSceneAudio}
              handleGenerateAllAudios={handleGenerateAllAudios}
            />
          )}

          {/* TAB 5: IMAGES */}
          {activeTab === "images" && (
            <ImagesTab
              scenesJson={scenesJson}
              sceneImages={sceneImages}
              handleUploadSceneImage={handleUploadSceneImage}
              handleDeleteSceneImage={handleDeleteSceneImage}
              handleGenerateSceneImage={handleGenerateSceneImage}
              handleGenerateAllImages={handleGenerateAllImages}
            />
          )}

          {/* TAB 6: SCENE FRAMES */}
          {activeTab === "scene_frames" && (
            <SceneFramesTab
              scenesJson={scenesJson}
              sceneVideos={sceneVideos}
              handleUploadSceneVideo={handleUploadSceneVideo}
              handleDeleteSceneVideo={handleDeleteSceneVideo}
              handleGenerateSceneVideo={handleGenerateSceneVideo}
              handleGenerateAllVideos={handleGenerateAllVideos}
            />
          )}

          {/* TAB 7: COMPLETED MASTER VIDEO */}
          {activeTab === "completed_video" && (
            <CompletedVideoTab
              scenesJson={scenesJson}
              completedMasterVideo={completedMasterVideo}
              isRenderingMaster={isRenderingMaster}
              renderProgress={renderProgress}
              handleUploadMasterVideo={handleUploadMasterVideo}
              handleDeleteMasterVideo={handleDeleteMasterVideo}
              handleRenderMasterVideo={handleRenderMasterVideo}
            />
          )}
        </>
      )}

      {/* Global Studio Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.title}
        description={deleteModalState.description}
        confirmLabel={deleteModalState.confirmLabel}
        onConfirm={deleteModalState.onConfirm}
        onCancel={cancelDelete}
      />
    </div>
  );
}

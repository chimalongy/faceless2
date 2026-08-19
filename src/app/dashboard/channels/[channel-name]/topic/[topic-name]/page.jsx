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
  Check
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
import DeleteConfirmModal from "@/components/topic-studio/DeleteConfirmModal";

export default function TopicStudioPage() {
  const params = useParams();
  const rawChannelSlug = params?.["channel-name"] || "field-notes";
  const rawPillarSlug = params?.["content-pillar-name"];
  const rawTopicSlug = params?.["topic-name"] || "how-ancient-mycelium-shaped-earths-first-soil";

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
  const [saved, setSaved] = useState(false);

  // 1. Thumbnail State
  const [thumbnailPrompt, setThumbnailPrompt] = useState(
    `Cinematic macro shot of bioluminescent mycelium filament network pulsating in dark primordial volcanic soil, volumetric fog, rim lighting, 8k documentary style, Unreal Engine 5 render`
  );
  const [isEditingThumbPrompt, setIsEditingThumbPrompt] = useState(false);
  const [thumbPromptNotice, setThumbPromptNotice] = useState("");
  const [thumbnailImage, setThumbnailImage] = useState("generated");
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  function triggerThumbPromptNotice(msg) {
    setThumbPromptNotice(msg);
    setTimeout(() => setThumbPromptNotice(""), 3000);
  }

  function handleClearThumbPrompt() {
    requestDelete({
      title: "Delete Thumbnail Prompt",
      description: "Are you sure you want to delete the entire thumbnail prompt text?",
      confirmLabel: "Delete Prompt",
      onConfirm: () => {
        setThumbnailPrompt("");
        triggerThumbPromptNotice("Thumbnail prompt cleared.");
      },
    });
  }

  function handleUpdateThumbPrompt() {
    setIsEditingThumbPrompt(false);
    triggerThumbPromptNotice("Thumbnail prompt updated.");
  }

  function handleThumbnailUpload(e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setThumbnailImage(uploadEvent.target?.result);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleClearThumbnail() {
    requestDelete({
      title: "Clear Thumbnail Image",
      description: "Are you sure you want to clear the current thumbnail preview image?",
      confirmLabel: "Clear Image",
      onConfirm: () => {
        setThumbnailImage(null);
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

  // 2. Script State
  const defaultScript = `400 million years ago, planet Earth had no dirt.

If you stood on the supercontinent of Gondwana, the ground beneath your feet was not dark fertile soil. It was razor-sharp volcanic granite baking under an unfiltered sun. There was no moss, no trees, and no topsoil. Just hundreds of millions of square miles of dead stone.

Then came the subterranean revolution.

Long before the first plant conquered dry land, ancient fungal hyphae began penetrating microscopic fractures in the stone. Secreting specialized carbonic and oxalic acids, these invisible organisms chemically dissolved granite to harvest elemental potassium, phosphorus, and calcium.

When they formed partnerships with primitive photosynthetic algae, Earth's first biological trading network was born: sugar in exchange for mined minerals.

Over hundreds of millions of years, the accumulation of broken stone, dead fungal biomass, and organic carbon formed the first real soil on our planet. That silent network laid the foundation for the massive Devonian forests and the air we breathe today.`;

  const [scriptContent, setScriptContent] = useState(defaultScript);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptNotice, setScriptNotice] = useState("");

  function triggerScriptNotice(msg) {
    setScriptNotice(msg);
    setTimeout(() => setScriptNotice(""), 3000);
  }

  function handleClearScript() {
    requestDelete({
      title: "Delete Full Script",
      description: "Are you sure you want to delete the entire narration script? All teleprompter speech cues and text will be cleared.",
      confirmLabel: "Delete Script",
      onConfirm: () => {
        setScriptContent("");
        triggerScriptNotice("Script cleared.");
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

  // 3. Scenes State (JSON structured: scene_number, audio_text, image_prompt)
  const defaultScenesJson = JSON.stringify(
    [
      {
        scene_number: 1,
        audio_text: "400 million years ago, planet Earth had no dirt. If you stood on the supercontinent of Gondwana, the ground was razor-sharp volcanic granite baking under an unfiltered sun.",
        image_prompt: "Cinematic wide establishing shot of jagged primordial black volcanic crags, barren rocky terrain without vegetation, drifting volcanic fog, 8k documentary style",
      },
      {
        scene_number: 2,
        audio_text: "Then came the subterranean revolution. Long before the first plant conquered dry land, ancient fungal hyphae began penetrating microscopic fractures in the stone.",
        image_prompt: "Extreme macro zoom on bioluminescent fungal filaments penetrating rock fissures and chemically dissolving dark volcanic granite with glowing secretions",
      },
      {
        scene_number: 3,
        audio_text: "When they formed partnerships with primitive photosynthetic algae, Earth's first biological trading network emerged: sugar in exchange for mined minerals.",
        image_prompt: "Underground glowing root-like mycelial network exchanging luminescent nutrient ions with primitive green algae cells, Unreal Engine 5 cinematic render",
      },
      {
        scene_number: 4,
        audio_text: "Over hundreds of millions of years, this silent network built the living soil that laid the foundation for towering Devonian forests and the air we breathe today.",
        image_prompt: "Time-lapse of rich dark fertile loam forming over ancient rocky terrain as towering Devonian primeval trees sprout into a lush vibrant forest canopy",
      },
    ],
    null,
    2
  );

  const [scenesJson, setScenesJson] = useState(defaultScenesJson);
  const [isEditingScenes, setIsEditingScenes] = useState(false);
  const [scenesNotice, setScenesNotice] = useState("");
  const [jsonError, setJsonError] = useState("");

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

  // 4. Audio State (Scene-by-scene breakdown)
  const [selectedVoice, setSelectedVoice] = useState("Marcus - Deep Narrator (Naturalist)");
  const [bgMusic, setBgMusic] = useState("Ethereal Sub-bass & Ambient Wind");
  const [sceneAudios, setSceneAudios] = useState({});

  function handleUploadSceneAudio(sceneNum, file) {
    if (!file) return;
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

  // 5. Images State (Scene-by-scene breakdown)
  const [sceneImages, setSceneImages] = useState({});

  function handleUploadSceneImage(sceneNum, file) {
    if (!file) return;
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

  // 6. SceneFrames (Video) State
  const [sceneVideos, setSceneVideos] = useState({});

  function handleUploadSceneVideo(sceneNum, file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSceneVideos((prev) => ({
      ...prev,
      [sceneNum]: {
        url,
        name: file.name,
      },
    }));
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

  // Global Delete Modal State
  const [mounted, setMounted] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Delete",
    onConfirm: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (deleteModal.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [deleteModal.isOpen]);

  function requestDelete({ title, description, confirmLabel = "Delete", onConfirm }) {
    setDeleteModal({
      isOpen: true,
      title: title || "Confirm Deletion",
      description: description || "Are you sure you want to delete this item? This action cannot be undone.",
      confirmLabel,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setDeleteModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  function closeDeleteModal() {
    setDeleteModal((prev) => ({ ...prev, isOpen: false }));
  }

  function handleSaveAll() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const tabs = [
    { id: "thumbnail", label: "Thumbnail", icon: ImageIcon },
    { id: "script", label: "Script", icon: FileText },
    { id: "scenes", label: "Scenes", icon: Braces },
    { id: "audio", label: "Audio", icon: Mic },
    { id: "images", label: "Images", icon: Film },
    { id: "sceneframes", label: "SceneFrames", icon: Layers },
  ];

  return (
    <div className="space-y-8 animate-card-rise">
      {/* Top Navigation & Breadcrumb */}
      <div>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to {rawPillarSlug ? "Content Pillar" : channelTitle}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                Content Topic
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              {topicTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              {saved ? <Check size={15} /> : <Save size={15} />}
              <span>{saved ? "All Assets Saved" : "Save All Work"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-line overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "border-signal text-signal bg-signal/5"
                  : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/5"
              }`}
            >
              <Icon size={15} />
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
          handleClearThumbPrompt={handleClearThumbPrompt}
          handleUpdateThumbPrompt={handleUpdateThumbPrompt}
          triggerThumbPromptNotice={triggerThumbPromptNotice}
          thumbnailImage={thumbnailImage}
          isGeneratingThumbnail={isGeneratingThumbnail}
          handleThumbnailUpload={handleThumbnailUpload}
          handleClearThumbnail={handleClearThumbnail}
          handleGenerateThumbnail={handleGenerateThumbnail}
        />
      )}

      {/* TAB 2: SCRIPT */}
      {activeTab === "script" && (
        <ScriptTab
          scriptContent={scriptContent}
          setScriptContent={setScriptContent}
          isEditingScript={isEditingScript}
          setIsEditingScript={setIsEditingScript}
          scriptNotice={scriptNotice}
          handleClearScript={handleClearScript}
          handleUpdateScript={handleUpdateScript}
          handleGenerateScript={handleGenerateScript}
          triggerScriptNotice={triggerScriptNotice}
        />
      )}

      {/* TAB 3: SCENES */}
      {activeTab === "scenes" && (
        <ScenesTab
          scenesJson={scenesJson}
          setScenesJson={setScenesJson}
          scenesNotice={scenesNotice}
          jsonError={jsonError}
          setJsonError={setJsonError}
          handleClearScenes={handleClearScenes}
          handleGenerateScenes={handleGenerateScenes}
          triggerScenesNotice={triggerScenesNotice}
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

      {/* TAB 6: SCENEFRAMES (VIDEOS) */}
      {activeTab === "sceneframes" && (
        <SceneFramesTab
          scenesJson={scenesJson}
          sceneVideos={sceneVideos}
          sceneImages={sceneImages}
          sceneAudios={sceneAudios}
          handleUploadSceneVideo={handleUploadSceneVideo}
          handleDeleteSceneVideo={handleDeleteSceneVideo}
          handleGenerateSceneVideo={handleGenerateSceneVideo}
          handleGenerateAllVideos={handleGenerateAllVideos}
        />
      )}

      {/* GLOBAL DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        mounted={mounted}
        deleteModal={deleteModal}
        closeDeleteModal={closeDeleteModal}
      />
    </div>
  );
}

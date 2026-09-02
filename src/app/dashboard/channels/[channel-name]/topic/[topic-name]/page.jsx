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
  Loader2,
  Clock
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

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

  // Studio Active Tab
  const [activeTab, setActiveTab] = useState("thumbnail");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [topicData, setTopicData] = useState(null);

  const effectivePillarSlug = rawPillarSlug || topicData?.pillarSlug || null;
  const effectivePillarName =
    topicData?.pillarName ||
    (effectivePillarSlug
      ? effectivePillarSlug
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ")
      : null);

  const backUrl = effectivePillarSlug
    ? `/dashboard/channels/${channelSlug}/content_pillar/${effectivePillarSlug}`
    : `/dashboard/channels/${channelSlug}`;

  const backLabel = effectivePillarName
    ? `Back to ${effectivePillarName}`
    : `Back to ${channelTitle}`;

  // 1. Thumbnail State
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [isEditingThumbPrompt, setIsEditingThumbPrompt] = useState(false);
  const [thumbPromptNotice, setThumbPromptNotice] = useState("");
  const [isGeneratingThumbPrompt, setIsGeneratingThumbPrompt] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // 2. Script State
  const [scriptContent, setScriptContent] = useState("");
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptNotice, setScriptNotice] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isUpdatingScript, setIsUpdatingScript] = useState(false);

  // 3. Scenes State
  const [scenesJson, setScenesJson] = useState("[]");
  const [isEditingScenes, setIsEditingScenes] = useState(false);
  const [scenesNotice, setScenesNotice] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isUpdatingScenes, setIsUpdatingScenes] = useState(false);

  // 4. Audio State
  const [selectedVoice, setSelectedVoice] = useState("af_heart");
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [bgMusic, setBgMusic] = useState("Ethereal Sub-bass & Ambient Wind");
  const [sceneAudios, setSceneAudios] = useState({});
  const [isGeneratingAllAudios, setIsGeneratingAllAudios] = useState(false);
  const [generatingSceneAudios, setGeneratingSceneAudios] = useState({});

  // 5. Images State
  const [sceneImages, setSceneImages] = useState({});

  // 6. SceneFrames (Video) State
  const [sceneVideos, setSceneVideos] = useState({});
  const [isGeneratingAllVideos, setIsGeneratingAllVideos] = useState(false);
  const [generatingSceneVideos, setGeneratingSceneVideos] = useState({});
  const [isGeneratingAllVideosModal, setIsGeneratingAllVideosModal] = useState(false);
  const [generatingSceneVideosModal, setGeneratingSceneVideosModal] = useState({});

  // 7. Completed Master Video & YouTube Publishing State
  const [completedMasterVideo, setCompletedMasterVideo] = useState(null);
  const [isRenderingMaster, setIsRenderingMaster] = useState(false);
  const [isMergingMasterModal, setIsMergingMasterModal] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [storyDescription, setStoryDescription] = useState("");
  const [postershiveApi, setPostershiveApi] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState(null);
  const [youtubePublishedAt, setYoutubePublishedAt] = useState(null);

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
            setTopicData(t);
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

            if (t.storyDescription) setStoryDescription(t.storyDescription);
            if (t.postershiveApi) setPostershiveApi(t.postershiveApi);
            if (t.youtubeVideoId) setYoutubeVideoId(t.youtubeVideoId);
            if (t.youtubeUrl) setYoutubeUrl(t.youtubeUrl);
            if (t.youtubePublishedAt) setYoutubePublishedAt(t.youtubePublishedAt);

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
                    key: asset.fileKey,
                    name: asset.fileName || `${topicSlug}-master.mp4`,
                  });
                } else if (asset.assetType === "audio" && asset.sceneIndex) {
                  audios[asset.sceneIndex] = {
                    url: asset.fileUrl,
                    key: asset.fileKey,
                    name: asset.fileName || `Scene ${asset.sceneIndex} Audio`,
                    duration: "00:20",
                  };
                } else if (asset.assetType === "image" && asset.sceneIndex) {
                  images[asset.sceneIndex] = {
                    url: asset.fileUrl,
                    key: asset.fileKey,
                    name: asset.fileName || `Scene ${asset.sceneIndex} Image`,
                  };
                } else if (asset.assetType === "video" && asset.sceneIndex) {
                  videos[asset.sceneIndex] = {
                    url: asset.fileUrl,
                    key: asset.fileKey,
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

        // Fetch channel default voice & postershive API key
        try {
          const channelRes = await fetch(`/api/channels/${channelSlug}`);
          if (channelRes.ok) {
            const cData = await channelRes.json();
            if (cData?.channel?.defaultVoice) {
              setSelectedVoice(cData.channel.defaultVoice);
            }
            if (cData?.channel?.postershiveApi) {
              setPostershiveApi(cData.channel.postershiveApi);
            }
          }
        } catch (cErr) {
          console.warn("Could not load channel configuration:", cErr);
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

  async function handleGenerateThumbPrompt() {
    setIsGeneratingThumbPrompt(true);
    try {
      const res = await fetch(
        `/api/channels/${channelSlug}/topics/${topicSlug}/generate-thumbnail-prompt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await res.json();
      if (res.ok && data.thumbnailPrompt) {
        setThumbnailPrompt(data.thumbnailPrompt);
        toast.success("Thumbnail prompt generated successfully!");
        triggerThumbPromptNotice("Thumbnail prompt generated.");
      } else {
        toast.error(data.error || "Failed to generate thumbnail prompt.");
      }
    } catch (err) {
      console.error("Error generating thumbnail prompt:", err);
      toast.error("Error generating prompt: " + err.message);
    } finally {
      setIsGeneratingThumbPrompt(false);
    }
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
    setTimeout(() => setScriptNotice(""), 4000);
  }

  function handleClearScript() {
    requestDelete({
      title: "Delete Entire Script",
      description: "Are you sure you want to delete the entire voiceover script text?",
      confirmLabel: "Delete Script",
      onConfirm: async () => {
        setScriptContent("");
        try {
          await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scriptContent: "" }),
          });
        } catch {}
        triggerScriptNotice("Script content cleared.");
      },
    });
  }

  async function handleUpdateScript() {
    setIsUpdatingScript(true);
    try {
      await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptContent }),
      });
      triggerScriptNotice("Script successfully updated.");
    } catch (err) {
      triggerScriptNotice("Update failed: " + err.message);
    } finally {
      setIsUpdatingScript(false);
    }
  }

  async function handleGenerateScript() {
    setIsGeneratingScript(true);
    triggerScriptNotice("Generating complete long-form script with Cloudflare AI...");
    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to autogenerate script");
      }

      if (data.scriptContent) {
        setScriptContent(data.scriptContent);
        triggerScriptNotice(`Script generated successfully using ${data.accountUsed || "LLM Account"} (${data.wordCount || 0} words).`);
      } else {
        throw new Error("No script content received from generator.");
      }
    } catch (err) {
      console.error("Script generation error:", err);
      triggerScriptNotice(`Generation failed: ${err.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  }

  // Scenes Handlers
  function triggerScenesNotice(msg) {
    setScenesNotice(msg);
    setTimeout(() => setScenesNotice(""), 4000);
  }

  function handleClearScenes() {
    requestDelete({
      title: "Delete All Scenes",
      description: "Are you sure you want to delete all structured scene definitions in this JSON array? It will be reset to an empty array.",
      confirmLabel: "Delete All Scenes",
      onConfirm: async () => {
        setScenesJson("[]");
        setJsonError("");
        try {
          await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenesJson: "[]" }),
          });
        } catch {}
        triggerScenesNotice("Scenes JSON cleared.");
      },
    });
  }

  async function handleUpdateScenes() {
    setIsUpdatingScenes(true);
    try {
      const parsed = JSON.parse(scenesJson);
      const formatted = JSON.stringify(parsed, null, 2);
      setScenesJson(formatted);
      setJsonError("");

      await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenesJson: formatted }),
      });

      triggerScenesNotice("Scenes JSON validated & updated in database.");
    } catch (err) {
      setJsonError("Invalid JSON: " + err.message);
      triggerScenesNotice("Validation failed: " + err.message);
    } finally {
      setIsUpdatingScenes(false);
    }
  }

  async function handleGenerateScenes() {
    setIsGeneratingScenes(true);
    triggerScenesNotice("Generating cinematic scenes & image prompts with Cloudflare AI...");
    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to autogenerate scenes");
      }

      if (Array.isArray(data.scenes) && data.scenes.length > 0) {
        const formatted = JSON.stringify(data.scenes, null, 2);
        setScenesJson(formatted);
        setJsonError("");
        triggerScenesNotice(`Successfully generated ${data.totalScenes || data.scenes.length} scenes using ${data.accountUsed || "LLM Account"}.`);
      } else {
        throw new Error("No scenes were returned by the generator.");
      }
    } catch (err) {
      console.error("Scenes generation error:", err);
      triggerScenesNotice(`Generation failed: ${err.message}`);
    } finally {
      setIsGeneratingScenes(false);
    }
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
      onConfirm: async () => {
        const audioData = sceneAudios[sceneNum] || sceneAudios[String(sceneNum)] || sceneAudios[Number(sceneNum)];
        if (audioData?.key || audioData?.url) {
          try {
            await fetch("/api/storage/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: audioData?.key,
                url: audioData?.url,
                channelSlug,
                topicSlug,
                assetType: "audio",
                sceneIndex: sceneNum,
              }),
            });
          } catch (err) {
            console.warn("Could not delete audio file from R2:", err);
          }
        }
        setSceneAudios((prev) => {
          const next = { ...prev };
          delete next[sceneNum];
          delete next[String(sceneNum)];
          delete next[Number(sceneNum)];
          return next;
        });
        toast.success(`Scene ${sceneNum} audio deleted.`);
      },
    });
  }

  function handleDeleteMultipleSceneAudios(sceneNumbers = []) {
    if (!sceneNumbers || sceneNumbers.length === 0) return;
    const count = sceneNumbers.length;

    requestDelete({
      title: `Delete ${count} Scene Audio Track${count > 1 ? "s" : ""}`,
      description: `Are you sure you want to delete narration audio for ${count} selected scene${count > 1 ? "s" : ""}? This will permanently remove the audio files from Cloudflare R2 and the database.`,
      confirmLabel: `Delete ${count} Audio Track${count > 1 ? "s" : ""}`,
      onConfirm: async () => {
        const deletePromises = sceneNumbers.map(async (sNum) => {
          const audioData = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
          if (audioData?.key || audioData?.url) {
            try {
              await fetch("/api/storage/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  key: audioData?.key,
                  url: audioData?.url,
                  channelSlug,
                  topicSlug,
                  assetType: "audio",
                  sceneIndex: sNum,
                }),
              });
            } catch (err) {
              console.warn(`Could not delete scene ${sNum} audio from R2:`, err);
            }
          }
        });

        await Promise.allSettled(deletePromises);

        setSceneAudios((prev) => {
          const next = { ...prev };
          sceneNumbers.forEach((sNum) => {
            delete next[sNum];
            delete next[String(sNum)];
            delete next[Number(sNum)];
          });
          return next;
        });

        toast.success(`Deleted ${count} scene audio track${count > 1 ? "s" : ""}.`);
      },
    });
  }

  async function handleGenerateSceneAudio(sceneNum) {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const scene = parsed.find((s) => Number(s.scene_number) === Number(sceneNum));
    const scriptText = scene?.audio_text || scene?.narration || scene?.script || scene?.text || "";

    if (!scriptText.trim()) {
      toast.error(`Scene ${sceneNum} has no narration text defined.`);
      return;
    }

    setGeneratingSceneAudios((prev) => ({ ...prev, [sceneNum]: true }));

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIndex: sceneNum,
          scriptText,
          voice: selectedVoice,
          speed: audioSpeed,
        }),
      });

      const data = await res.json();
      if (res.ok && data.audioUrl) {
        setSceneAudios((prev) => ({
          ...prev,
          [sceneNum]: {
            url: data.audioUrl,
            key: data.key,
            name: `Scene ${sceneNum} Audio.wav`,
            duration: data.durationEstimate || "00:20",
            endpointUsed: data.endpointUsed,
          },
        }));
        toast.success(`Scene ${sceneNum} narration synthesized!`);
      } else {
        toast.error(data.error || "Failed to synthesize audio narration.");
      }
    } catch (err) {
      console.error(`Error generating audio for Scene ${sceneNum}:`, err);
      toast.error("Error generating audio: " + err.message);
    } finally {
      setGeneratingSceneAudios((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  async function handleGenerateAllAudios() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }

    if (!parsed || parsed.length === 0) {
      toast.error("No scenes found in this topic.");
      return;
    }

    // Filter out scenes that already have audio
    const scenesToGenerate = parsed.filter((scene) => {
      const sNum = scene.scene_number;
      const existing = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
      return !existing || !existing.url;
    });

    if (scenesToGenerate.length === 0) {
      toast("All scenes already have audio narration synthesized.", {
        icon: "✨",
        style: {
          background: "#f0fdf4",
          color: "#166534",
          border: "1px solid #bbf7d0",
        },
      });
      return;
    }

    setIsGeneratingAllAudios(true);
    toast(`Synthesizing narration for ${scenesToGenerate.length} remaining scene(s)...`, {
      icon: "🎙️",
    });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesToGenerate,
          voice: selectedVoice,
          speed: audioSpeed,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        let successCount = 0;
        setSceneAudios((prev) => {
          const next = { ...prev };
          data.results.forEach((r) => {
            if (r.success && r.audioUrl) {
              successCount++;
              next[r.sceneIndex] = {
                url: r.audioUrl,
                key: r.key,
                name: `Scene ${r.sceneIndex} Audio.wav`,
                duration: r.durationEstimate || "00:20",
                endpointUsed: r.endpointUsed,
              };
            }
          });
          return next;
        });
        toast.success(`Synthesized ${successCount} scene narration track(s) successfully!`);
      } else {
        toast.error(data.error || "Failed to generate all audios.");
      }
    } catch (err) {
      console.error("Error generating all audios:", err);
      toast.error("Error generating audios: " + err.message);
    } finally {
      setIsGeneratingAllAudios(false);
    }
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
          key: result.key,
          name: file.name,
        },
      }));
      toast.success(`Scene ${sceneNum} image uploaded.`);
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
      onConfirm: async () => {
        const imgData = sceneImages[sceneNum] || sceneImages[String(sceneNum)] || sceneImages[Number(sceneNum)];
        
        // Physical file deletion from R2 and database cleanup
        if (imgData?.key || imgData?.url) {
          try {
            await fetch("/api/storage/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: imgData?.key,
                url: imgData?.url,
                channelSlug,
                topicSlug,
                assetType: "image",
                sceneIndex: sceneNum,
              }),
            });
          } catch (err) {
            console.warn("Could not delete file from R2:", err);
          }
        }

        setSceneImages((prev) => {
          const next = { ...prev };
          delete next[sceneNum];
          delete next[String(sceneNum)];
          delete next[Number(sceneNum)];
          return next;
        });

        toast.success(`Scene ${sceneNum} image deleted.`);
      },
    });
  }

  function handleDeleteMultipleSceneImages(sceneNumbers = []) {
    if (!sceneNumbers || sceneNumbers.length === 0) return;
    const count = sceneNumbers.length;

    requestDelete({
      title: `Delete ${count} Scene Image${count > 1 ? "s" : ""}`,
      description: `Are you sure you want to delete the images for ${count} selected scene${count > 1 ? "s" : ""}? This will permanently remove the files from Cloudflare R2 and the database.`,
      confirmLabel: `Delete ${count} Image${count > 1 ? "s" : ""}`,
      onConfirm: async () => {
        const deletePromises = sceneNumbers.map(async (sNum) => {
          const imgData = sceneImages[sNum] || sceneImages[String(sNum)] || sceneImages[Number(sNum)];
          if (imgData?.key || imgData?.url) {
            try {
              await fetch("/api/storage/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  key: imgData?.key,
                  url: imgData?.url,
                  channelSlug,
                  topicSlug,
                  assetType: "image",
                  sceneIndex: sNum,
                }),
              });
            } catch (err) {
              console.warn(`Could not delete image for scene ${sNum}:`, err);
            }
          }
        });

        await Promise.all(deletePromises);

        setSceneImages((prev) => {
          const next = { ...prev };
          sceneNumbers.forEach((sNum) => {
            delete next[sNum];
            delete next[String(sNum)];
            delete next[Number(sNum)];
          });
          return next;
        });

        toast.success(`Deleted ${count} scene image${count > 1 ? "s" : ""}.`);
      },
    });
  }

  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [generatingSceneImages, setGeneratingSceneImages] = useState({});
  const [isExtractingZip, setIsExtractingZip] = useState(false);

  async function handleUploadZipImages(file, onProgress) {
    if (!file) return;
    setIsExtractingZip(true);
    toast("Uploading ZIP to R2 and extracting scene images...", {
      icon: "📦",
    });

    try {
      let zipFileKey = null;

      // 1. Direct-to-R2 presigned upload with real-time byte tracking (essential for archives > 4MB)
      try {
        console.log(`[ZIP Upload] Requesting presigned URL for ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
        if (onProgress) {
          onProgress({
            percent: 0,
            stage: "Requesting R2 presigned upload URL...",
            status: "uploading",
          });
        }

        const presignRes = await fetch("/api/storage/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/zip",
            channelSlug,
            topicSlug,
            assetType: "temp_zip",
          }),
        });

        if (!presignRes.ok) {
          const presignError = await presignRes.json().catch(() => ({}));
          throw new Error(presignError.error || `Presign request failed (${presignRes.status})`);
        }

        const presignData = await presignRes.json();
        if (!presignData.uploadUrl || !presignData.key) {
          throw new Error("Invalid presigned URL received from server");
        }

        console.log("[ZIP Upload] Uploading directly from browser to Cloudflare R2 with real-time progress...");
        
        // Upload using XMLHttpRequest to get actual real-time byte progress
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignData.uploadUrl, true);
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
              const uploadedMB = (e.loaded / 1024 / 1024).toFixed(1);
              const totalMB = (e.total / 1024 / 1024).toFixed(1);
              if (onProgress) {
                onProgress({
                  percent,
                  stage: `Uploading to Cloudflare R2: ${uploadedMB}MB / ${totalMB}MB (${percent}%)`,
                  status: "uploading",
                });
              }
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`R2 direct upload failed (${xhr.status}). Check R2 CORS settings.`));
            }
          };

          xhr.onerror = () => {
            reject(new Error("R2 upload network error. Please ensure Cloudflare R2 CORS allows PUT requests."));
          };

          xhr.ontimeout = () => {
            reject(new Error("R2 upload timed out."));
          };

          xhr.send(file);
        });

        zipFileKey = presignData.key;
        console.log("[ZIP Upload] R2 upload successful, key:", zipFileKey);
      } catch (presignErr) {
        console.error("[ZIP Upload] Direct upload error:", presignErr);
        if (file.size > 4 * 1024 * 1024) {
          // File is too large for serverless relay fallback (Vercel 4.5MB limit)
          throw new Error(
            presignErr.message || "Failed to upload large ZIP to Cloudflare R2. Check your R2 bucket CORS settings."
          );
        }
      }

      if (onProgress) {
        onProgress({
          percent: 100,
          stage: "Upload to R2 complete! Trigger.dev worker unpacking & mapping images...",
          status: "processing",
        });
      }

      let res;
      if (zipFileKey) {
        // Dispatch task passing lightweight R2 key (<200 bytes JSON)
        console.log("[ZIP Upload] Dispatching extraction task via R2 key...");
        res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/extract-zip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zipFileKey }),
        });
      } else {
        // Small file fallback (<4MB only)
        console.log("[ZIP Upload] Falling back to serverless formData relay...");
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/extract-zip`, {
          method: "POST",
          body: formData,
        });
      }

      const data = await res.json();
      if (res.ok && (Array.isArray(data.images) || data.thumbnail)) {
        if (Array.isArray(data.images) && data.images.length > 0) {
          setSceneImages((prev) => {
            const next = { ...prev };
            data.images.forEach((img) => {
              next[img.sceneIndex] = {
                url: img.publicUrl,
                key: img.key,
                name: img.fileName || `Scene ${img.sceneIndex} Image`,
              };
            });
            return next;
          });
        }
        if (data.thumbnail?.publicUrl) {
          setThumbnailImage(data.thumbnail.publicUrl);
        }
        const thumbMsg = data.thumbnail ? " and thumbnail" : "";
        toast.success(`Successfully unpacked & mapped ${data.extractedCount || data.images?.length || 0} scene image(s)${thumbMsg}!`);
      } else {
        toast.error(data.error || "Failed to extract images from ZIP.");
      }
    } catch (err) {
      console.error("Error extracting ZIP:", err);
      toast.error("Error extracting ZIP: " + err.message);
    } finally {
      setIsExtractingZip(false);
    }
  }

  async function handleGenerateSceneImage(sceneNum) {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const scene = parsed.find((s) => Number(s.scene_number) === Number(sceneNum));
    const prompt = scene?.image_prompt || "";

    if (!prompt) {
      toast.error(`Scene ${sceneNum} has no image prompt defined.`);
      return;
    }

    setGeneratingSceneImages((prev) => ({ ...prev, [sceneNum]: true }));

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIndex: sceneNum,
          prompt,
        }),
      });

      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setSceneImages((prev) => ({
          ...prev,
          [sceneNum]: {
            url: data.imageUrl,
            key: data.key,
            name: `Scene ${sceneNum} Image`,
            endpointUsed: data.endpointUsed,
          },
        }));
        toast.success(`Scene ${sceneNum} image generated successfully!`);
      } else {
        toast.error(data.error || "Failed to generate image.");
      }
    } catch (err) {
      console.error(`Error generating image for Scene ${sceneNum}:`, err);
      toast.error("Error generating image: " + err.message);
    } finally {
      setGeneratingSceneImages((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  async function handleGenerateAllImages() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }

    if (!parsed || parsed.length === 0) {
      toast.error("No scenes found in this topic.");
      return;
    }

    // Filter out scenes that already have generated/uploaded images
    const scenesToGenerate = parsed.filter((scene) => {
      const sNum = scene.scene_number;
      const existing = sceneImages[sNum] || sceneImages[String(sNum)] || sceneImages[Number(sNum)];
      return !existing || !existing.url;
    });

    if (scenesToGenerate.length === 0) {
      toast("All scenes already have images generated.", {
        icon: "✨",
        style: {
          background: "#f0fdf4",
          color: "#166534",
          border: "1px solid #bbf7d0",
        },
      });
      return;
    }

    setIsGeneratingAllImages(true);
    toast(`Generating images for ${scenesToGenerate.length} remaining scene(s)...`, {
      icon: "🎨",
    });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesToGenerate,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        let successCount = 0;
        setSceneImages((prev) => {
          const next = { ...prev };
          data.results.forEach((r) => {
            if (r.success && r.imageUrl) {
              successCount++;
              next[r.sceneIndex] = {
                url: r.imageUrl,
                key: r.key,
                name: `Scene ${r.sceneIndex} Image`,
                endpointUsed: r.endpointUsed,
              };
            }
          });
          return next;
        });
        toast.success(`Generated ${successCount} scene image(s) successfully!`);
      } else {
        toast.error(data.error || "Failed to generate all images.");
      }
    } catch (err) {
      console.error("Error generating remaining images:", err);
      toast.error("Error generating images: " + err.message);
    } finally {
      setIsGeneratingAllImages(false);
    }
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
          key: result.key,
          name: file.name,
        },
      }));
      toast.success(`Scene ${sceneNum} video uploaded.`);
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
      onConfirm: async () => {
        const videoData = sceneVideos[sceneNum] || sceneVideos[String(sceneNum)] || sceneVideos[Number(sceneNum)];
        if (videoData?.key || videoData?.url) {
          try {
            await fetch("/api/storage/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: videoData?.key,
                url: videoData?.url,
                channelSlug,
                topicSlug,
                assetType: "video",
                sceneIndex: sceneNum,
              }),
            });
          } catch (err) {
            console.warn("Could not delete video file from R2:", err);
          }
        }
        setSceneVideos((prev) => {
          const next = { ...prev };
          delete next[sceneNum];
          delete next[String(sceneNum)];
          delete next[Number(sceneNum)];
          return next;
        });
        toast.success(`Scene ${sceneNum} video deleted.`);
      },
    });
  }

  async function handleGenerateSceneVideo(sceneNum) {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const scene = parsed.find((s) => Number(s.scene_number) === Number(sceneNum));
    const imgData = sceneImages[sceneNum] || sceneImages[String(sceneNum)] || sceneImages[Number(sceneNum)];
    const audioData = sceneAudios[sceneNum] || sceneAudios[String(sceneNum)] || sceneAudios[Number(sceneNum)];

    if (!imgData?.url || !audioData?.url) {
      toast.error(`Scene ${sceneNum} requires both an image and voice audio to render video.`);
      return;
    }

    setGeneratingSceneVideos((prev) => ({ ...prev, [sceneNum]: true }));
    toast(`Rendering Scene ${sceneNum} video clip via Trigger.dev...`, { icon: "🎬" });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-scene-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIndex: sceneNum,
          imageUrl: imgData.url,
          audioUrl: audioData.url,
          kenBurns: scene?.ken_burns || { direction: "zoom-in", intensity: 0.10 },
          transition: scene?.transition || "fade",
        }),
      });

      const data = await res.json();
      if (res.ok && data.videoUrl) {
        setSceneVideos((prev) => ({
          ...prev,
          [sceneNum]: {
            url: data.videoUrl,
            key: data.key,
            name: `Scene ${sceneNum} Video`,
            duration: data.duration,
          },
        }));
        toast.success(`Scene ${sceneNum} video rendered successfully!`);
      } else {
        toast.error(data.error || `Failed to render video for Scene ${sceneNum}.`);
      }
    } catch (err) {
      console.error(`Error rendering Scene ${sceneNum} video:`, err);
      toast.error("Error rendering video: " + err.message);
    } finally {
      setGeneratingSceneVideos((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  async function handleGenerateAllVideos() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }

    if (!parsed || parsed.length === 0) {
      toast.error("No scenes defined in this topic.");
      return;
    }

    // Filter to only scenes that have BOTH image and audio, and do NOT have video yet
    const scenesToRender = parsed.filter((scene) => {
      const sNum = scene.scene_number;
      const existing = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
      if (existing?.url) return false;
      const img = sceneImages[sNum] || sceneImages[String(sNum)] || sceneImages[Number(sNum)];
      const aud = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
      return !!img?.url && !!aud?.url;
    });

    if (scenesToRender.length === 0) {
      const unrenderedScenes = parsed.filter((scene) => {
        const sNum = scene.scene_number;
        const existing = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
        return !existing?.url;
      });

      if (unrenderedScenes.length > 0) {
        toast.error(
          `Cannot render: ${unrenderedScenes.length} remaining scene(s) are missing either an image or audio narration.`
        );
      } else {
        toast("All scene videos have already been rendered.", {
          icon: "✨",
          style: {
            background: "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
          },
        });
      }
      return;
    }

    setIsGeneratingAllVideos(true);
    toast(`Rendering videos for ${scenesToRender.length} eligible scene(s)...`, { icon: "🎬" });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/generate-scene-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesToRender,
          sceneImages,
          sceneAudios,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.videos)) {
        let successCount = 0;
        setSceneVideos((prev) => {
          const next = { ...prev };
          data.videos.forEach((v) => {
            if (v.success && v.videoUrl) {
              successCount++;
              next[v.sceneIndex] = {
                url: v.videoUrl,
                key: v.key,
                name: `Scene ${v.sceneIndex} Video`,
                duration: v.duration,
              };
            }
          });
          return next;
        });
        toast.success(`Rendered ${successCount} scene video(s) successfully!`);
      } else {
        toast.error(data.error || "Failed to render scene videos.");
      }
    } catch (err) {
      console.error("Error rendering remaining scene videos:", err);
      toast.error("Error rendering videos: " + err.message);
    } finally {
      setIsGeneratingAllVideos(false);
    }
  }

  // Modal Video Handlers (Testing)
  async function handleGenerateSceneVideoModal(sceneNum) {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }
    const scene = parsed.find((s) => Number(s.scene_number) === Number(sceneNum));
    const imgData = sceneImages[sceneNum] || sceneImages[String(sceneNum)] || sceneImages[Number(sceneNum)];
    const audioData = sceneAudios[sceneNum] || sceneAudios[String(sceneNum)] || sceneAudios[Number(sceneNum)];

    if (!imgData?.url || !audioData?.url) {
      toast.error(`Scene ${sceneNum} requires both an image and voice audio to render video on Modal.`);
      return;
    }

    setGeneratingSceneVideosModal((prev) => ({ ...prev, [sceneNum]: true }));
    toast(`[Modal Test] Rendering Scene ${sceneNum} video clip via Modal GPU...`, { icon: "⚡" });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/test-modal-scene-render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIndex: sceneNum,
          imageUrl: imgData.url,
          audioUrl: audioData.url,
          kenBurns: scene?.ken_burns || { direction: "zoom-in", intensity: 0.15 },
          transition: scene?.transition || "fade",
        }),
      });

      const data = await res.json();
      const outputVideo = data.videoUrl ? data : (Array.isArray(data.videos) && data.videos[0]) ? data.videos[0] : null;

      if (res.ok && outputVideo?.videoUrl) {
        setSceneVideos((prev) => ({
          ...prev,
          [sceneNum]: {
            url: outputVideo.videoUrl || outputVideo.publicUrl,
            key: outputVideo.key,
            name: outputVideo.fileName || `Scene ${sceneNum} Video`,
            duration: outputVideo.duration,
          },
        }));
        toast.success(`[Modal Test] Scene ${sceneNum} video rendered successfully on Modal!`);
      } else {
        toast.error(data.error || `Failed to render Scene ${sceneNum} on Modal.`);
      }
    } catch (err) {
      console.error(`[Modal Test] Error rendering Scene ${sceneNum}:`, err);
      toast.error("[Modal Test] Error: " + err.message);
    } finally {
      setGeneratingSceneVideosModal((prev) => ({ ...prev, [sceneNum]: false }));
    }
  }

  async function handleGenerateAllVideosModal() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }

    if (!parsed || parsed.length === 0) {
      toast.error("No scenes defined in this topic.");
      return;
    }

    // Filter to only scenes that have BOTH image and audio, and do NOT have video yet
    const scenesToRender = parsed.filter((scene) => {
      const sNum = scene.scene_number;
      const existing = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
      if (existing?.url) return false;
      const img = sceneImages[sNum] || sceneImages[String(sNum)] || sceneImages[Number(sNum)];
      const aud = sceneAudios[sNum] || sceneAudios[String(sNum)] || sceneAudios[Number(sNum)];
      return !!img?.url && !!aud?.url;
    });

    if (scenesToRender.length === 0) {
      const unrenderedScenes = parsed.filter((scene) => {
        const sNum = scene.scene_number;
        const existing = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
        return !existing?.url;
      });

      if (unrenderedScenes.length > 0) {
        toast.error(
          `Cannot render: ${unrenderedScenes.length} remaining scene(s) are missing either an image or audio narration.`
        );
      } else {
        toast("All scene videos have already been rendered.", {
          icon: "✨",
        });
      }
      return;
    }

    setIsGeneratingAllVideosModal(true);
    toast(`[Modal Test] Dispatching ${scenesToRender.length} scene(s) to Modal GPU renderer...`, { icon: "⚡" });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/test-modal-scene-render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesToRender,
          sceneImages,
          sceneAudios,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.videos)) {
        let successCount = 0;
        setSceneVideos((prev) => {
          const next = { ...prev };
          data.videos.forEach((v) => {
            if (v.success && (v.videoUrl || v.publicUrl)) {
              successCount++;
              next[v.sceneIndex] = {
                url: v.videoUrl || v.publicUrl,
                key: v.key,
                name: v.fileName || `Scene ${v.sceneIndex} Video`,
                duration: v.duration,
              };
            }
          });
          return next;
        });
        toast.success(`[Modal Test] Rendered ${successCount} scene video(s) on Modal successfully!`);
      } else {
        toast.error(data.error || "Failed to render scenes on Modal.");
      }
    } catch (err) {
      console.error("[Modal Test] Error rendering scene videos on Modal:", err);
      toast.error("[Modal Test] Error: " + err.message);
    } finally {
      setIsGeneratingAllVideosModal(false);
    }
  }

  // Master Video Handlers
  async function handleUploadMasterVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFileToR2(file, "completedvideo");
      setCompletedMasterVideo({
        url: result.publicUrl,
        key: result.key,
        name: file.name,
      });
      toast.success("Master video uploaded.");
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
      onConfirm: async () => {
        if (completedMasterVideo?.key) {
          try {
            await fetch("/api/storage/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileKey: completedMasterVideo.key, channelSlug }),
            });
          } catch {}
        }
        setCompletedMasterVideo(null);
        toast.success("Master video cut deleted.");
      },
    });
  }

  async function handleRenderMasterVideo() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }

    // Ensure all scene frames are rendered before merging
    if (!parsed || parsed.length === 0) {
      toast.error("No scenes defined in this topic.");
      return;
    }

    const missingScenes = parsed.filter((scene) => {
      const sNum = scene.scene_number;
      const v = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
      return !v?.url;
    });

    if (missingScenes.length > 0) {
      toast.error(
        `Cannot merge: All ${parsed.length} scene frames must be rendered first (${parsed.length - missingScenes.length}/${parsed.length} ready).`
      );
      return;
    }

    // Build scene videos array from current state
    const videosPayload = [];
    parsed.forEach((scene) => {
      const sNum = scene.scene_number;
      const videoData = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
      if (videoData?.url) {
        videosPayload.push({
          scene_number: Number(sNum),
          video_url: videoData.url,
        });
      }
    });

    setIsRenderingMaster(true);
    setRenderProgress(15);
    toast(`Merging ${videosPayload.length} scene frames into master video via Trigger.dev...`, { icon: "🎬" });

    // Progress simulation while background task runs
    const progressTimer = setInterval(() => {
      setRenderProgress((prev) => (prev < 90 ? prev + 5 : prev));
    }, 1500);

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/merge-scene-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneVideos: videosPayload,
          resolution: "1080p",
        }),
      });

      const data = await res.json();
      clearInterval(progressTimer);

      if (res.ok && data.videoUrl) {
        setRenderProgress(100);
        setCompletedMasterVideo({
          url: data.videoUrl,
          key: data.key,
          duration: data.duration,
          name: `${topicSlug}-master-1080p.mp4`,
        });
        toast.success("Master video merged and saved successfully! 🚀");
      } else {
        toast.error(data.error || "Failed to merge scene frames.");
      }
    } catch (err) {
      clearInterval(progressTimer);
      console.error("Error merging master video:", err);
      toast.error("Error merging master video: " + err.message);
    } finally {
      setIsRenderingMaster(false);
      setTimeout(() => setRenderProgress(0), 1000);
    }
  }

  async function handleMergeMasterVideoModal() {
    let parsed = [];
    try {
      parsed = JSON.parse(scenesJson);
    } catch {
      parsed = [];
    }

    // Ensure all scene frames are rendered before merging
    if (!parsed || parsed.length === 0) {
      toast.error("No scenes defined in this topic.");
      return;
    }

    const missingScenes = parsed.filter((scene) => {
      const sNum = scene.scene_number;
      const v = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
      return !v?.url;
    });

    if (missingScenes.length > 0) {
      toast.error(
        `Cannot merge: All ${parsed.length} scene frames must be rendered first (${parsed.length - missingScenes.length}/${parsed.length} ready).`
      );
      return;
    }

    // Build scene videos array from current state
    const videosPayload = [];
    parsed.forEach((scene) => {
      const sNum = scene.scene_number;
      const videoData = sceneVideos[sNum] || sceneVideos[String(sNum)] || sceneVideos[Number(sNum)];
      if (videoData?.url) {
        videosPayload.push({
          scene_number: Number(sNum),
          video_url: videoData.url,
          video_key: videoData.key || "",
        });
      }
    });

    setIsMergingMasterModal(true);
    toast(`[Modal Merger] Merging ${videosPayload.length} scene frames into master video via Modal service...`, { icon: "⚡" });

    try {
      const res = await fetch(`/api/channels/${channelSlug}/topics/${topicSlug}/merge-scene-frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneVideos: videosPayload,
          resolution: "1080p",
          useModal: true,
        }),
      });

      const data = await res.json();

      if (res.ok && data.videoUrl) {
        setCompletedMasterVideo({
          url: data.videoUrl,
          key: data.key,
          duration: data.duration,
          name: `${topicSlug}-master-1080p.mp4`,
        });
        toast.success("[Modal Merger] Master video merged and saved successfully! ⚡🚀");
      } else {
        toast.error(data.error || "Failed to merge scene frames on Modal.");
      }
    } catch (err) {
      console.error("[Modal Merger] Error merging master video on Modal:", err);
      toast.error("[Modal Merger] Error merging master video: " + err.message);
    } finally {
      setIsMergingMasterModal(false);
    }
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
        <div className="flex items-center gap-2 text-xs text-ink-muted mb-2 flex-wrap">
          <Link
            href="/dashboard"
            className="hover:text-ink transition-colors"
          >
            Channels
          </Link>
          <span>/</span>
          <Link
            href={`/dashboard/channels/${channelSlug}`}
            className="hover:text-ink transition-colors"
          >
            {channelTitle}
          </Link>
          {effectivePillarSlug && (
            <>
              <span>/</span>
              <Link
                href={`/dashboard/channels/${channelSlug}/content_pillar/${effectivePillarSlug}`}
                className="hover:text-ink transition-colors font-medium text-ink/80"
              >
                {effectivePillarName}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-ink font-semibold">{topicTitle}</span>
        </div>

        <Link
          href={backUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> {backLabel}
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
              {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
              <span>{saving ? "Saving..." : saved ? "State Saved" : "Save Studio State"}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-3 rounded-xl">
          <Loader2 size={24} className="animate-spin text-signal mx-auto" />
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
              triggerThumbPromptNotice={triggerThumbPromptNotice}
              isGeneratingThumbPrompt={isGeneratingThumbPrompt}
              handleGenerateThumbPrompt={handleGenerateThumbPrompt}
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
              topicData={topicData}
              channelName={channelTitle}
              scriptContent={scriptContent}
              setScriptContent={setScriptContent}
              isEditingScript={isEditingScript}
              setIsEditingScript={setIsEditingScript}
              scriptNotice={scriptNotice}
              triggerScriptNotice={triggerScriptNotice}
              isGeneratingScript={isGeneratingScript}
              isUpdatingScript={isUpdatingScript}
              handleClearScript={handleClearScript}
              handleUpdateScript={handleUpdateScript}
              handleGenerateScript={handleGenerateScript}
            />
          )}

          {/* TAB 3: SCENES (JSON) */}
          {activeTab === "scenes" && (
            <ScenesTab
              topicData={topicData}
              channelName={channelTitle}
              scriptContent={scriptContent}
              scenesJson={scenesJson}
              setScenesJson={setScenesJson}
              isEditingScenes={isEditingScenes}
              setIsEditingScenes={setIsEditingScenes}
              scenesNotice={scenesNotice}
              triggerScenesNotice={triggerScenesNotice}
              jsonError={jsonError}
              setJsonError={setJsonError}
              isGeneratingScenes={isGeneratingScenes}
              isUpdatingScenes={isUpdatingScenes}
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
              audioSpeed={audioSpeed}
              setAudioSpeed={setAudioSpeed}
              bgMusic={bgMusic}
              setBgMusic={setBgMusic}
              isGeneratingAllAudios={isGeneratingAllAudios}
              generatingSceneAudios={generatingSceneAudios}
              handleUploadSceneAudio={handleUploadSceneAudio}
              handleDeleteSceneAudio={handleDeleteSceneAudio}
              handleDeleteMultipleSceneAudios={handleDeleteMultipleSceneAudios}
              handleGenerateSceneAudio={handleGenerateSceneAudio}
              handleGenerateAllAudios={handleGenerateAllAudios}
            />
          )}

          {/* TAB 5: IMAGES */}
          {activeTab === "images" && (
            <ImagesTab
              scenesJson={scenesJson}
              setScenesJson={setScenesJson}
              sceneImages={sceneImages}
              isGeneratingAllImages={isGeneratingAllImages}
              generatingSceneImages={generatingSceneImages}
              isExtractingZip={isExtractingZip}
              handleUploadSceneImage={handleUploadSceneImage}
              handleUploadZipImages={handleUploadZipImages}
              handleDeleteSceneImage={handleDeleteSceneImage}
              handleDeleteMultipleSceneImages={handleDeleteMultipleSceneImages}
              handleGenerateSceneImage={handleGenerateSceneImage}
              handleGenerateAllImages={handleGenerateAllImages}
            />
          )}

          {/* TAB 6: SCENE FRAMES */}
          {activeTab === "scene_frames" && (
            <SceneFramesTab
              scenesJson={scenesJson}
              sceneVideos={sceneVideos}
              sceneImages={sceneImages}
              sceneAudios={sceneAudios}
              isGeneratingAllVideos={isGeneratingAllVideos}
              generatingSceneVideos={generatingSceneVideos}
              isGeneratingAllVideosModal={isGeneratingAllVideosModal}
              generatingSceneVideosModal={generatingSceneVideosModal}
              handleUploadSceneVideo={handleUploadSceneVideo}
              handleDeleteSceneVideo={handleDeleteSceneVideo}
              handleGenerateSceneVideo={handleGenerateSceneVideo}
              handleGenerateAllVideos={handleGenerateAllVideos}
              handleGenerateSceneVideoModal={handleGenerateSceneVideoModal}
              handleGenerateAllVideosModal={handleGenerateAllVideosModal}
            />
          )}

          {/* TAB 7: COMPLETED MASTER VIDEO */}
          {activeTab === "completed_video" && (
            <CompletedVideoTab
              topicTitle={topicTitle}
              topicSlug={topicSlug}
              channelSlug={channelSlug}
              channelName={channelTitle}
              postershiveApi={postershiveApi}
              scriptContent={scriptContent}
              storyDescription={storyDescription}
              setStoryDescription={setStoryDescription}
              scenesJson={scenesJson}
              sceneVideos={sceneVideos}
              sceneImages={sceneImages}
              sceneAudios={sceneAudios}
              thumbnailImage={thumbnailImage}
              completedMasterVideo={completedMasterVideo}
              setCompletedMasterVideo={setCompletedMasterVideo}
              isRenderingMaster={isRenderingMaster}
              isMergingMasterModal={isMergingMasterModal}
              renderProgress={renderProgress}
              handleUploadMasterVideo={handleUploadMasterVideo}
              handleDeleteMasterVideo={handleDeleteMasterVideo}
              handleRenderMasterVideo={handleRenderMasterVideo}
              handleMergeMasterVideoModal={handleMergeMasterVideoModal}
              youtubeVideoId={youtubeVideoId}
              youtubeUrl={youtubeUrl}
              youtubePublishedAt={youtubePublishedAt}
              onYoutubePublished={({ youtubeVideoId, youtubeUrl, youtubePublishedAt }) => {
                setYoutubeVideoId(youtubeVideoId);
                setYoutubeUrl(youtubeUrl);
                setYoutubePublishedAt(youtubePublishedAt);
              }}
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

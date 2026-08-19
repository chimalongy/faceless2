"use client";

import {
  Braces,
  Upload,
  Sparkles,
  Trash2,
  Copy,
  Plus,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function ScenesTab({
  scenesJson,
  setScenesJson,
  scenesNotice,
  jsonError,
  setJsonError,
  handleClearScenes,
  handleGenerateScenes,
  triggerScenesNotice,
}) {
  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  // Handle JSON file upload
  function handleJsonUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      try {
        const text = uploadEvent.target?.result;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON must be an array of scenes.");
        }
        // Normalize schema
        const normalized = parsed.map((item, idx) => ({
          scene_number: item.scene_number || idx + 1,
          audio_text: item.audio_text || item.narration || item.script || "",
          image_prompt: item.image_prompt || item.visual_prompt || item.prompt || "",
        }));

        setScenesJson(JSON.stringify(normalized, null, 2));
        setJsonError("");
        triggerScenesNotice(`Successfully loaded ${normalized.length} scenes from JSON.`);
      } catch (err) {
        setJsonError("Invalid JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Update a single scene field (audio_text or image_prompt)
  function handleUpdateSceneField(sceneIndex, field, value) {
    try {
      const current = [...parsedScenes];
      if (current[sceneIndex]) {
        current[sceneIndex] = {
          ...current[sceneIndex],
          [field]: value,
        };
        setScenesJson(JSON.stringify(current, null, 2));
        setJsonError("");
      }
    } catch (err) {
      setJsonError("Error updating scene: " + err.message);
    }
  }

  // Add a new scene to the array
  function handleAddNewScene() {
    try {
      const current = [...parsedScenes];
      const nextNum = current.length + 1;
      current.push({
        scene_number: nextNum,
        audio_text: "",
        image_prompt: "",
      });
      setScenesJson(JSON.stringify(current, null, 2));
      setJsonError("");
      triggerScenesNotice(`Added Scene ${nextNum}.`);
    } catch (err) {
      setJsonError("Error adding scene: " + err.message);
    }
  }

  // Delete an individual scene from the array
  function handleDeleteIndividualScene(sceneIndex) {
    try {
      const current = parsedScenes.filter((_, idx) => idx !== sceneIndex);
      // Renumber remaining scenes
      const renumbered = current.map((s, idx) => ({
        ...s,
        scene_number: idx + 1,
      }));
      setScenesJson(JSON.stringify(renumbered, null, 2));
      setJsonError("");
      triggerScenesNotice(`Scene removed.`);
    } catch (err) {
      setJsonError("Error deleting scene: " + err.message);
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Header Card */}
      <div className="p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Braces size={16} className="text-signal" /> Structured Scene Breakdown
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Upload a JSON file or edit individual audio narration lines and visual prompts below.
            </p>
          </div>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {scenesNotice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300">
                <CheckCircle2 size={12} /> {scenesNotice}
              </span>
            )}

            {/* Upload JSON file */}
            <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer">
              <Upload size={13} />
              <span>Upload JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleJsonUpload}
                className="hidden"
              />
            </label>

            {/* Copy JSON */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(scenesJson);
                triggerScenesNotice("Scenes JSON copied to clipboard.");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
              title="Copy raw JSON"
            >
              <Copy size={13} />
              <span>Copy JSON</span>
            </button>

            {/* Delete All Scenes */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={handleClearScenes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-ink-muted transition-all cursor-pointer"
                title="Clear all scenes"
              >
                <Trash2 size={13} />
                <span>Delete All</span>
              </button>
            )}

            {/* Autogenerate Scenes */}
            <button
              type="button"
              onClick={handleGenerateScenes}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
              title="AI autogenerate structured scenes"
            >
              <Sparkles size={13} />
              <span>Autogenerate Scenes</span>
            </button>
          </div>
        </div>
      </div>

      {jsonError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{jsonError}</span>
        </div>
      )}

      {/* Scene-by-Scene Visual Editor Cards */}
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
            Scene Items ({parsedScenes.length} Total)
          </h4>
        </div>

        {parsedScenes.length === 0 ? (
          <div className="p-10 border border-line bg-paper-card text-center space-y-3 text-ink-muted">
            <Braces size={36} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes created yet</p>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Upload a JSON file, click "Autogenerate Scenes", or add your first scene manually below.
            </p>
            <button
              type="button"
              onClick={handleAddNewScene}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer mt-2"
            >
              <Plus size={14} /> Add First Scene
            </button>
          </div>
        ) : (
          parsedScenes.map((scene, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 border border-line bg-paper-card space-y-4 hover:border-signal/40 transition-all"
            >
              {/* Scene Card Header */}
              <div className="flex items-center justify-between border-b border-line/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 bg-ink text-white font-mono text-xs font-bold flex items-center justify-center">
                    {scene.scene_number || idx + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold text-ink">
                    SCENE 0{scene.scene_number || idx + 1}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteIndividualScene(idx)}
                  className="p-1.5 text-ink-muted hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                  title="Delete this scene"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Audio Text Field */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase font-mono">
                    Audio Text (Narration Script):
                  </label>
                  <textarea
                    rows={4}
                    value={scene.audio_text || ""}
                    onChange={(e) => handleUpdateSceneField(idx, "audio_text", e.target.value)}
                    placeholder="Enter narration voice line for this scene..."
                    className="w-full p-3.5 border border-line bg-white font-sans text-xs text-ink leading-relaxed outline-none focus:border-signal resize-y"
                  />
                </div>

                {/* Image Prompt Field */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase font-mono">
                    Image Prompt (Visual Directive):
                  </label>
                  <textarea
                    rows={4}
                    value={scene.image_prompt || ""}
                    onChange={(e) => handleUpdateSceneField(idx, "image_prompt", e.target.value)}
                    placeholder="Enter visual imagery prompt and scenery details..."
                    className="w-full p-3.5 border border-line bg-white font-sans text-xs text-ink leading-relaxed outline-none focus:border-signal resize-y"
                  />
                </div>
              </div>
            </div>
          ))
        )}

        {/* Add Scene Button at bottom */}
        {parsedScenes.length > 0 && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={handleAddNewScene}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-dashed border-line hover:border-signal bg-white hover:bg-signal/5 text-xs font-semibold text-ink hover:text-signal transition-all cursor-pointer"
            >
              <Plus size={13} /> Add Another Scene
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

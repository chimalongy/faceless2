"use client";

import {
  Braces,
  ClipboardPaste,
  Sparkles,
  Trash2,
  Copy,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  FileCode,
  Loader2,
  Move,
  Sliders
} from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SCENE_GENERATION_SYSTEM_PROMPT } from "@/lib/LLMPrompts/SceneGenerationPrompt";

export default function ScenesTab({
  scenesJson,
  setScenesJson,
  scenesNotice,
  jsonError,
  setJsonError,
  handleClearScenes,
  handleGenerateScenes,
  triggerScenesNotice,
  isGeneratingScenes = false,
  isUpdatingScenes = false,
}) {
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  let parsedScenes = [];
  try {
    parsedScenes = JSON.parse(scenesJson || "[]");
  } catch (e) {
    parsedScenes = [];
  }

  // Handle Paste from Clipboard
  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedJsonText(text);
        setPasteError("");
      }
    } catch {
      // Ignore clipboard permission errors
    }
  }

  // Handle parsing and applying pasted JSON with ken_burns schema
  function handleApplyPastedJson(e) {
    if (e) e.preventDefault();
    setPasteError("");

    if (!pastedJsonText.trim()) {
      setPasteError("Please paste JSON into the text area before applying.");
      return;
    }

    try {
      const parsed = JSON.parse(pastedJsonText.trim());
      let scenesArray = null;

      if (Array.isArray(parsed)) {
        scenesArray = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.scenes)) {
          scenesArray = parsed.scenes;
        } else if (Array.isArray(parsed.scenes_json)) {
          scenesArray = parsed.scenes_json;
        } else if (Array.isArray(parsed.data)) {
          scenesArray = parsed.data;
        } else if (Array.isArray(parsed.items)) {
          scenesArray = parsed.items;
        }
      }

      if (!scenesArray || !Array.isArray(scenesArray) || scenesArray.length === 0) {
        throw new Error(
          "JSON must be an array of scenes (e.g. [{ scene_number, audio_text, image_prompt, ken_burns }])."
        );
      }

      const defaultDirections = ["zoom-in", "pan-right", "zoom-out", "pan-left", "pan-up", "pan-down"];

      // Normalize schema into standard format
      const normalized = scenesArray.map((item, idx) => {
        const kb = item.ken_burns || {};
        const direction = kb.direction || defaultDirections[idx % defaultDirections.length];
        const intensity = typeof kb.intensity === "number" ? kb.intensity : (parseFloat(kb.intensity) || 0.10);
        const transition = item.transition || "fade";

        return {
          scene_number: item.scene_number || item.sceneIndex || item.scene || idx + 1,
          audio_text: item.audio_text || item.narration || item.script || item.voiceover || item.text || "",
          image_prompt: item.image_prompt || item.visual_prompt || item.prompt || item.visual || item.image || "",
          transition,
          ken_burns: {
            direction,
            intensity: Number(intensity.toFixed(2)),
          },
        };
      });

      setScenesJson(JSON.stringify(normalized, null, 2));
      setJsonError("");
      setPasteModalOpen(false);
      setPastedJsonText("");
      triggerScenesNotice(`Successfully applied ${normalized.length} scenes from JSON.`);
    } catch (err) {
      setPasteError(err.message || "Failed to parse scenes JSON. Please check syntax.");
    }
  }

  // Update a single scene field (audio_text, image_prompt, transition, or ken_burns nested field)
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

  // Update ken_burns nested property
  function handleUpdateKenBurns(sceneIndex, kbField, value) {
    try {
      const current = [...parsedScenes];
      if (current[sceneIndex]) {
        const existingKb = current[sceneIndex].ken_burns || { direction: "zoom-in", intensity: 0.10 };
        current[sceneIndex] = {
          ...current[sceneIndex],
          ken_burns: {
            ...existingKb,
            [kbField]: kbField === "intensity" ? (parseFloat(value) || 0.10) : value,
          },
        };
        setScenesJson(JSON.stringify(current, null, 2));
        setJsonError("");
      }
    } catch (err) {
      setJsonError("Error updating Ken Burns effect: " + err.message);
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
        transition: "fade",
        ken_burns: {
          direction: "zoom-in",
          intensity: 0.10,
        },
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
      <div className="p-4 sm:p-6 border border-line bg-paper-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Braces size={16} className="text-signal" /> Structured Scene Breakdown
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Paste JSON or configure scene audio narration, visual prompts, and Ken Burns camera motion effects.
            </p>
          </div>

          {/* Action Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {scenesNotice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300">
                <CheckCircle2 size={12} /> {scenesNotice}
              </span>
            )}

            {/* Paste JSON button */}
            <button
              type="button"
              onClick={() => {
                setPasteError("");
                setPasteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
              title="Paste scenes JSON"
            >
              <ClipboardPaste size={13} />
              <span>Paste JSON</span>
            </button>

            {/* Copy JSON */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(scenesJson);
                triggerScenesNotice("Scenes JSON copied to clipboard.");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
              title="Copy raw JSON"
            >
              <Copy size={13} />
              <span>Copy JSON</span>
            </button>

            {/* Copy Scene Generation System Prompt */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(SCENE_GENERATION_SYSTEM_PROMPT);
                triggerScenesNotice("Scene generation system prompt copied to clipboard.");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
              title="Copy scene generation system prompt"
            >
              <Copy size={13} />
              <span>Copy System Prompt</span>
            </button>

            {/* Delete All Scenes */}
            {parsedScenes.length > 0 && (
              <button
                type="button"
                onClick={handleClearScenes}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-ink-muted transition-all cursor-pointer"
                title="Clear all scenes"
              >
                <Trash2 size={13} />
                <span>Delete All</span>
              </button>
            )}

            {/* Autogenerate Scenes */}
            <button
              type="button"
              disabled={isGeneratingScenes}
              onClick={handleGenerateScenes}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-60"
              title="AI autogenerate structured scenes"
            >
              {isGeneratingScenes ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Autogenerate Scenes</span>
                </>
              )}
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
          <div className="p-8 sm:p-10 border border-line bg-paper-card text-center space-y-3 text-ink-muted">
            <Braces size={36} className="mx-auto opacity-40 text-ink" />
            <p className="text-sm font-semibold text-ink">No scenes created yet</p>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Paste a JSON array with Ken Burns parameters, click "Autogenerate Scenes", or add your first scene manually below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => {
                  setPasteError("");
                  setPasteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
              >
                <ClipboardPaste size={14} /> Paste JSON
              </button>
              <button
                type="button"
                onClick={handleAddNewScene}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-line bg-white hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
              >
                <Plus size={14} /> Add Scene Manually
              </button>
            </div>
          </div>
        ) : (
          parsedScenes.map((scene, idx) => {
            const sceneNum = scene.scene_number || idx + 1;
            const kb = scene.ken_burns || { direction: "zoom-in", intensity: 0.12 };

            return (
              <div
                key={idx}
                className="p-4 sm:p-6 border border-line bg-paper-card space-y-4 hover:border-signal/40 transition-all"
              >
                {/* Scene Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 sm:w-7 sm:h-7 bg-ink text-white font-mono text-[11px] sm:text-xs font-bold flex items-center justify-center shrink-0">
                      {sceneNum}
                    </span>
                    <span className="font-mono text-xs font-semibold text-ink">
                      SCENE 0{sceneNum}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-sm">
                      <Move size={10} /> {kb.direction || "zoom-in"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 rounded-sm">
                      Transition: {scene.transition || "fade"}
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

                {/* Motion & Transition Directive Controls */}
                <div className="p-3 bg-paper-dark/50 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sliders size={13} className="text-signal" />
                    <span className="text-xs font-semibold text-ink font-mono">
                      Motion & Transition
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Direction Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-muted font-mono">Camera:</span>
                      <select
                        value={kb.direction || "zoom-in"}
                        onChange={(e) => handleUpdateKenBurns(idx, "direction", e.target.value)}
                        className="h-7 px-2 border border-line bg-white text-xs text-ink font-mono outline-none focus:border-signal cursor-pointer"
                      >
                        <option value="zoom-in">zoom-in</option>
                        <option value="zoom-out">zoom-out</option>
                        <option value="pan-right">pan-right</option>
                        <option value="pan-left">pan-left</option>
                        <option value="pan-up">pan-up</option>
                        <option value="pan-down">pan-down</option>
                      </select>
                    </div>

                    {/* Transition Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-muted font-mono">Transition:</span>
                      <select
                        value={scene.transition || "fade"}
                        onChange={(e) => handleUpdateSceneField(idx, "transition", e.target.value)}
                        className="h-7 px-2 border border-line bg-white text-xs text-ink font-mono outline-none focus:border-signal cursor-pointer"
                      >
                        <option value="fade">Fade to Black (Default)</option>
                        <option value="fade-to-white">Fade to White</option>
                        <option value="crossfade">Crossfade</option>
                        <option value="fade-in">Fade In</option>
                        <option value="fade-out">Fade Out</option>
                        <option value="cut">Direct Cut</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
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

      {/* Full-Screen Portaled Paste JSON Modal */}
      {mounted && pasteModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasteModalOpen(false);
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
                    Paste Scenes JSON
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Supports <code className="font-mono bg-ink/5 px-1 py-0.5 rounded text-[11px]">scene_number</code>, <code className="font-mono bg-ink/5 px-1 py-0.5 rounded text-[11px]">audio_text</code>, <code className="font-mono bg-ink/5 px-1 py-0.5 rounded text-[11px]">image_prompt</code>, <code className="font-mono bg-ink/5 px-1 py-0.5 rounded text-[11px]">transition</code>, and <code className="font-mono bg-ink/5 px-1 py-0.5 rounded text-[11px]">ken_burns</code>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyPastedJson} className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <label htmlFor="paste-scenes-json-textarea" className="font-semibold text-ink/80">
                    Scenes JSON Array *
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
                  id="paste-scenes-json-textarea"
                  required
                  rows={14}
                  value={pastedJsonText}
                  onChange={(e) => {
                    setPastedJsonText(e.target.value);
                    if (pasteError) setPasteError("");
                  }}
                  placeholder={`[\n  {\n    "scene_number": 1,\n    "audio_text": "Why does being broke cost so much more than having wealth?",\n    "image_prompt": "Cinematic 2D narrative frame: a worn leather wallet on a kitchen table next to an unpaid bill.",\n    "transition": "fade",\n    "ken_burns": {\n      "direction": "zoom-in"\n    }\n  },\n  {\n    "scene_number": 2,\n    "audio_text": "From overdraft fees to predatory loan interest, poverty carries a hidden tax.",\n    "image_prompt": "Cinematic visual breakdown: contrasting gold scales with floating interest percentages.",\n    "transition": "crossfade",\n    "ken_burns": {\n      "direction": "pan-right"\n    }\n  }\n]`}
                  className="w-full flex-1 min-h-[220px] p-3.5 border border-line-dark bg-white text-ink font-mono text-xs leading-relaxed outline-none focus:border-signal"
                />
              </div>

              {pasteError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{pasteError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-line">
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
                    <CheckCircle2 size={14} /> Apply Scenes JSON
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

"use client";

import {
  FileText,
  Film,
  Image as ImageIcon,
  Sparkles,
  Save,
  RotateCcw,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  HelpCircle,
  Info,
  CheckCircle2,
  Code2,
  Smartphone,
  Monitor,
  Terminal,
  Layers,
  Wand2,
  Undo2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

export default function ChannelPromptSettingsTab({ channelSlug, channelName }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active Category & Sub-type
  const [activeCategory, setActiveCategory] = useState("script"); // "script" | "scenes" | "thumbnail"
  const [scriptSubTab, setScriptSubTab] = useState("longform"); // "longform" | "shorts"
  const [sceneSubTab, setSceneSubTab] = useState("longform"); // "longform" | "shorts"

  // Prompts State
  const [prompts, setPrompts] = useState({
    scriptPrompt: "",
    shortScriptPrompt: "",
    scenePrompt: "",
    shortScenePrompt: "",
    thumbnailPrompt: "",
  });

  // System Defaults (loaded from server)
  const [defaults, setDefaults] = useState({
    scriptPrompt: "",
    shortScriptPrompt: "",
    scenePrompt: "",
    shortScenePrompt: "",
    thumbnailPrompt: "",
  });

  // Available Placeholders
  const [placeholders, setPlaceholders] = useState({
    script: [],
    scenes: [],
    thumbnail: [],
  });

  // Track original saved settings to detect unsaved changes
  const [savedPrompts, setSavedPrompts] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  // Active textarea ref to insert variables at cursor position
  const activeTextareaRef = useRef(null);

  useEffect(() => {
    if (channelSlug) {
      loadPromptSettings();
    }
  }, [channelSlug]);

  async function loadPromptSettings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelSlug}/prompt-settings`);
      if (!res.ok) {
        throw new Error(`Failed to load prompt settings (HTTP ${res.status})`);
      }
      const data = await res.json();
      const serverDefaults = data.defaults || {};
      const serverSettings = data.promptSettings || {};

      setDefaults(serverDefaults);
      if (data.placeholders) {
        setPlaceholders(data.placeholders);
      }

      const initialPrompts = {
        scriptPrompt: serverSettings.scriptPrompt || serverDefaults.scriptPrompt || "",
        shortScriptPrompt: serverSettings.shortScriptPrompt || serverDefaults.shortScriptPrompt || "",
        scenePrompt: serverSettings.scenePrompt || serverDefaults.scenePrompt || "",
        shortScenePrompt: serverSettings.shortScenePrompt || serverDefaults.shortScenePrompt || "",
        thumbnailPrompt: serverSettings.thumbnailPrompt || serverDefaults.thumbnailPrompt || "",
      };

      setPrompts(initialPrompts);
      setSavedPrompts(serverSettings);
    } catch (err) {
      console.error("Error loading prompt settings:", err);
      toast.error(err.message || "Failed to load channel prompt settings");
    } finally {
      setLoading(false);
    }
  }

  // Derive which prompt key is currently being viewed
  function getCurrentKey() {
    if (activeCategory === "script") {
      return scriptSubTab === "longform" ? "scriptPrompt" : "shortScriptPrompt";
    }
    if (activeCategory === "scenes") {
      return sceneSubTab === "longform" ? "scenePrompt" : "shortScenePrompt";
    }
    return "thumbnailPrompt";
  }

  const currentKey = getCurrentKey();
  const currentValue = prompts[currentKey] || "";
  const defaultForCurrent = defaults[currentKey] || "";
  const isCustomized = Boolean(savedPrompts[currentKey]);
  const isDirty = (prompts[currentKey] || "") !== (savedPrompts[currentKey] || defaultForCurrent || "");

  // Update prompt value
  function handleTextChange(val) {
    setPrompts((prev) => ({
      ...prev,
      [currentKey]: val,
    }));
  }

  // Insert variable tag at cursor
  function handleInsertTag(tag) {
    const textarea = activeTextareaRef.current;
    if (!textarea) {
      handleTextChange(currentValue + " " + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentValue;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newText = before + tag + after;
    handleTextChange(newText);

    // Reposition cursor right after inserted tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);

    toast.success(`Inserted ${tag}`, { id: "tag-insert", duration: 1500 });
  }

  // Copy current prompt to clipboard
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentValue);
      setCopiedKey(currentKey);
      setTimeout(() => setCopiedKey(null), 2000);
      toast.success("Copied prompt to clipboard");
    } catch {
      toast.error("Failed to copy text");
    }
  }

  // Reset current prompt to built-in default
  function handleResetToDefault() {
    const def = defaults[currentKey] || "";
    setPrompts((prev) => ({
      ...prev,
      [currentKey]: def,
    }));
    toast.success("Reset editor to built-in system default");
  }

  // Clear customization (revert back to server default without custom override)
  function handleRevertSaved() {
    const saved = savedPrompts[currentKey] || defaults[currentKey] || "";
    setPrompts((prev) => ({
      ...prev,
      [currentKey]: saved,
    }));
    toast.success("Reverted to saved prompt");
  }

  // Save all prompts
  async function handleSave() {
    setSaving(true);
    try {
      // Determine clean payload: if prompt matches system default, we can store it or keep it
      const payload = {
        scriptPrompt: prompts.scriptPrompt?.trim() === defaults.scriptPrompt?.trim() ? null : prompts.scriptPrompt?.trim() || null,
        shortScriptPrompt: prompts.shortScriptPrompt?.trim() === defaults.shortScriptPrompt?.trim() ? null : prompts.shortScriptPrompt?.trim() || null,
        scenePrompt: prompts.scenePrompt?.trim() === defaults.scenePrompt?.trim() ? null : prompts.scenePrompt?.trim() || null,
        shortScenePrompt: prompts.shortScenePrompt?.trim() === defaults.shortScenePrompt?.trim() ? null : prompts.shortScenePrompt?.trim() || null,
        thumbnailPrompt: prompts.thumbnailPrompt?.trim() === defaults.thumbnailPrompt?.trim() ? null : prompts.thumbnailPrompt?.trim() || null,
      };

      const res = await fetch(`/api/channels/${channelSlug}/prompt-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptSettings: payload }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save prompt settings");
      }

      const data = await res.json();
      setSavedPrompts(data.promptSettings || payload);
      toast.success("Channel prompt settings saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save prompt settings");
    } finally {
      setSaving(false);
    }
  }

  // Count words & lines
  const wordCount = currentValue.trim() ? currentValue.trim().split(/\s+/).length : 0;
  const lineCount = currentValue ? currentValue.split("\n").length : 0;

  // Active variables for this tab
  const activeVariables =
    activeCategory === "script"
      ? placeholders.script
      : activeCategory === "scenes"
      ? placeholders.scenes
      : placeholders.thumbnail;

  if (loading) {
    return (
      <div className="p-16 border border-line bg-paper-card text-center space-y-3">
        <Loader2 size={24} className="animate-spin text-signal mx-auto" />
        <p className="text-xs text-ink-muted">Loading channel prompt directives...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="border border-line bg-paper-card p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-signal/10 border border-signal/30 text-signal">
                <Code2 size={16} />
              </span>
              <h2 className="text-base sm:text-lg font-display font-semibold text-ink">
                Channel Prompt Settings
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 border border-line bg-paper text-ink-muted">
                {channelName || channelSlug}
              </span>
            </div>
            <p className="text-xs text-ink-muted max-w-2xl">
              Customize the AI system prompts for this specific channel. Custom prompts override the built-in defaults for script generation, scene storyboard breakdown, and thumbnail art direction.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-signal text-paper font-semibold text-xs transition-all hover:bg-signal/90 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save All Prompts</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="border border-line bg-paper-card shadow-sm">
        {/* Category Navigation Tabs */}
        <div className="flex border-b border-line bg-paper overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveCategory("script")}
            className={`px-4 sm:px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === "script"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <FileText size={14} />
            <span>1. Script Generation Prompt</span>
            {(savedPrompts.scriptPrompt || savedPrompts.shortScriptPrompt) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Custom prompt active" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("scenes")}
            className={`px-4 sm:px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === "scenes"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <Film size={14} />
            <span>2. Scene Generation Prompt</span>
            {(savedPrompts.scenePrompt || savedPrompts.shortScenePrompt) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Custom prompt active" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("thumbnail")}
            className={`px-4 sm:px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === "thumbnail"
                ? "border-signal text-signal font-bold bg-signal/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <ImageIcon size={14} />
            <span>3. Thumbnail Prompt</span>
            {savedPrompts.thumbnailPrompt && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Custom prompt active" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Sub-format toggles for Script and Scenes */}
          {activeCategory === "script" && (
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-line">
              <div className="inline-flex p-1 bg-paper border border-line gap-1">
                <button
                  type="button"
                  onClick={() => setScriptSubTab("longform")}
                  className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    scriptSubTab === "longform"
                      ? "bg-signal text-paper shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Monitor size={13} />
                  <span>Long-form (16:9)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScriptSubTab("shorts")}
                  className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    scriptSubTab === "shorts"
                      ? "bg-signal text-paper shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Smartphone size={13} />
                  <span>Shorts / TikTok (9:16)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {savedPrompts[currentKey] ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 font-medium">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    Channel Custom Prompt Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper text-ink-muted border border-line">
                    <Info size={12} />
                    Using Built-in System Default
                  </span>
                )}
              </div>
            </div>
          )}

          {activeCategory === "scenes" && (
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-line">
              <div className="inline-flex p-1 bg-paper border border-line gap-1">
                <button
                  type="button"
                  onClick={() => setSceneSubTab("longform")}
                  className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sceneSubTab === "longform"
                      ? "bg-signal text-paper shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Monitor size={13} />
                  <span>Long-form Scenes (16:9)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSceneSubTab("shorts")}
                  className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    sceneSubTab === "shorts"
                      ? "bg-signal text-paper shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Smartphone size={13} />
                  <span>Shorts Scenes (9:16)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {savedPrompts[currentKey] ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 font-medium">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    Channel Custom Prompt Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper text-ink-muted border border-line">
                    <Info size={12} />
                    Using Built-in System Default
                  </span>
                )}
              </div>
            </div>
          )}

          {activeCategory === "thumbnail" && (
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">
                  16:9 YouTube Thumbnail Prompt Directive
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {savedPrompts[currentKey] ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 font-medium">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    Channel Custom Prompt Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-paper text-ink-muted border border-line">
                    <Info size={12} />
                    Using Built-in System Default
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3 py-1">
            <div className="flex items-center gap-3 text-xs text-ink-muted font-mono">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{currentValue.length} characters</span>
              <span>•</span>
              <span>{lineCount} lines</span>
              {isDirty && (
                <span className="text-amber-600 font-sans font-semibold">
                  (Unsaved changes)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-line bg-paper text-ink hover:border-signal/40 transition-all cursor-pointer"
                title="Copy current prompt to clipboard"
              >
                {copiedKey === currentKey ? (
                  <>
                    <Check size={13} className="text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {isDirty && (
                <button
                  type="button"
                  onClick={handleRevertSaved}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-line bg-paper text-ink hover:text-amber-600 transition-all cursor-pointer"
                  title="Discard changes and revert to last saved state"
                >
                  <Undo2 size={13} />
                  <span>Revert</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-line bg-paper text-ink hover:text-signal transition-all cursor-pointer"
                title="Populate editor with the built-in system default prompt"
              >
                <RotateCcw size={13} />
                <span>Reset to Default</span>
              </button>
            </div>
          </div>

          {/* Prompt Text Editor */}
          <div className="relative">
            <textarea
              ref={activeTextareaRef}
              value={currentValue}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full font-mono text-xs leading-relaxed bg-paper border border-line p-4 text-ink focus:outline-none focus:border-signal transition-all resize-y shadow-inner selection:bg-signal/20 selection:text-signal"
              placeholder="Enter custom prompt template here..."
            />
          </div>

          {/* Variable Injection Helper Bar */}
          <div className="p-4 border border-line bg-paper space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Wand2 size={13} className="text-signal" />
                <span>Available Template Variables:</span>
                <span className="text-ink-muted font-normal text-[11px]">
                  (Click any badge to insert at cursor)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeVariables?.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertTag(v.tag)}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-line bg-paper-card text-ink hover:border-signal hover:text-signal hover:bg-signal/5 transition-all cursor-pointer font-mono"
                  title={`${v.desc} — Click to insert`}
                >
                  <span className="text-signal font-semibold">{v.tag}</span>
                  <span className="text-ink-muted text-[10px] group-hover:text-signal/80">
                    ({v.label})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-4 sm:px-6 bg-paper border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-signal shrink-0" />
            <span>
              Variables enclosed in <code className="font-mono text-signal">{"{brackets}"}</code> will automatically be replaced with this channel's values during background generation.
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-signal text-paper font-semibold text-xs transition-all hover:bg-signal/90 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save Prompt Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


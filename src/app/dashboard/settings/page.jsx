"use client";

import {
  Sliders,
  Image as ImageIcon,
  Volume2,
  KeyRound,
  Save,
  CheckCircle2,
  AtSign,
  Globe,
  Hash,
  Plus,
  Trash2,
  Pencil,
  Lock,
  Unlock,
  Check,
  Inbox,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";

const SETTINGS_STORAGE_KEY = "faceless_studio_settings";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [saved, setSaved] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [isSavingDb, setIsSavingDb] = useState(false);

  // Tab 1: General Settings State
  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [triggerSecretKey, setTriggerSecretKey] = useState("");
  const [r2BucketName, setR2BucketName] = useState("faceless-media");
  const [editingGeneral, setEditingGeneral] = useState(false);

  // Tab 2: Multiple Image Endpoints State (Strictly: account-email, gen-url, usage)
  const [imageEndpoints, setImageEndpoints] = useState([]);
  const [editingImageIds, setEditingImageIds] = useState({});

  // Tab 3: Multiple Audio Endpoints State (Strictly: account-email, gen-url, usage)
  const [audioEndpoints, setAudioEndpoints] = useState([]);
  const [editingAudioIds, setEditingAudioIds] = useState({});

  // Load saved settings from Neon DB on initial mount
  useEffect(() => {
    async function loadEndpointsFromDb() {
      setLoadingDb(true);
      try {
        const res = await fetch("/api/settings/endpoints");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.imageEndpoints)) {
            setImageEndpoints(
              data.imageEndpoints.map((item) => ({
                id: item.id ? String(item.id) : `img-${Date.now()}-${Math.random()}`,
                accountEmail: item.accountEmail || "",
                genUrl: item.genUrl || "",
                usage: parseInt(item.usage, 10) || 0,
              }))
            );
          }
          if (Array.isArray(data.audioEndpoints)) {
            setAudioEndpoints(
              data.audioEndpoints.map((item) => ({
                id: item.id ? String(item.id) : `aud-${Date.now()}-${Math.random()}`,
                accountEmail: item.accountEmail || "",
                genUrl: item.genUrl || "",
                usage: parseInt(item.usage, 10) || 0,
              }))
            );
          }
        }
      } catch (err) {
        console.warn("Could not fetch endpoints from DB:", err);
      } finally {
        setLoadingDb(false);
      }
    }

    loadEndpointsFromDb();

    // Fallback/sync General Keys from localStorage
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored);
        if (p.openAiKey !== undefined) setOpenAiKey(p.openAiKey);
        if (p.anthropicKey !== undefined) setAnthropicKey(p.anthropicKey);
        if (p.triggerSecretKey !== undefined) setTriggerSecretKey(p.triggerSecretKey);
        if (p.r2BucketName !== undefined) setR2BucketName(p.r2BucketName);
      }
    } catch {}
  }, []);

  // Image Endpoints Handlers
  function handleAddImageEndpoint() {
    const newId = `img-${Date.now()}`;
    setImageEndpoints((prev) => [
      ...prev,
      {
        id: newId,
        accountEmail: "",
        genUrl: "",
        usage: 0,
      },
    ]);
    // Automatically make newly added endpoint editable
    setEditingImageIds((prev) => ({ ...prev, [newId]: true }));
  }

  function handleToggleEditImage(id) {
    setEditingImageIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function handleUpdateImageEndpoint(id, field, value) {
    setImageEndpoints((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === "usage" ? (value === "" ? "" : parseInt(value, 10) || 0) : value,
          };
        }
        return item;
      })
    );
  }

  function handleDeleteImageEndpoint(id) {
    setImageEndpoints((prev) => prev.filter((item) => item.id !== id));
    setEditingImageIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Audio Endpoints Handlers
  function handleAddAudioEndpoint() {
    const newId = `aud-${Date.now()}`;
    setAudioEndpoints((prev) => [
      ...prev,
      {
        id: newId,
        accountEmail: "",
        genUrl: "",
        usage: 0,
      },
    ]);
    // Automatically make newly added endpoint editable
    setEditingAudioIds((prev) => ({ ...prev, [newId]: true }));
  }

  function handleToggleEditAudio(id) {
    setEditingAudioIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function handleUpdateAudioEndpoint(id, field, value) {
    setAudioEndpoints((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === "usage" ? (value === "" ? "" : parseInt(value, 10) || 0) : value,
          };
        }
        return item;
      })
    );
  }

  function handleDeleteAudioEndpoint(id) {
    setAudioEndpoints((prev) => prev.filter((item) => item.id !== id));
    setEditingAudioIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setIsSavingDb(true);

    const formattedImageEndpoints = imageEndpoints.map((item) => ({
      id: item.id,
      "account-email": item.accountEmail.trim(),
      accountEmail: item.accountEmail.trim(),
      "gen-url": item.genUrl.trim(),
      genUrl: item.genUrl.trim(),
      usage: parseInt(item.usage, 10) || 0,
    }));

    const formattedAudioEndpoints = audioEndpoints.map((item) => ({
      id: item.id,
      "account-email": item.accountEmail.trim(),
      accountEmail: item.accountEmail.trim(),
      "gen-url": item.genUrl.trim(),
      genUrl: item.genUrl.trim(),
      usage: parseInt(item.usage, 10) || 0,
    }));

    const payload = {
      openAiKey,
      anthropicKey,
      triggerSecretKey,
      r2BucketName,
      imageEndpoints: formattedImageEndpoints,
      audioEndpoints: formattedAudioEndpoints,
    };

    // Save to Database
    try {
      const res = await fetch("/api/settings/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageEndpoints: formattedImageEndpoints,
          audioEndpoints: formattedAudioEndpoints,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.imageEndpoints)) {
          setImageEndpoints(
            data.imageEndpoints.map((item) => ({
              id: item.id ? String(item.id) : `img-${Date.now()}`,
              accountEmail: item.accountEmail || "",
              genUrl: item.genUrl || "",
              usage: parseInt(item.usage, 10) || 0,
            }))
          );
        }
        if (Array.isArray(data.audioEndpoints)) {
          setAudioEndpoints(
            data.audioEndpoints.map((item) => ({
              id: item.id ? String(item.id) : `aud-${Date.now()}`,
              accountEmail: item.accountEmail || "",
              genUrl: item.genUrl || "",
              usage: parseInt(item.usage, 10) || 0,
            }))
          );
        }
      }
    } catch (dbErr) {
      console.warn("Could not persist endpoints to DB:", dbErr);
    } finally {
      setIsSavingDb(false);
    }

    // Save to localStorage as backup
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    // Lock all fields after successful save to protect content
    setEditingGeneral(false);
    setEditingImageIds({});
    setEditingAudioIds({});

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const tabs = [
    {
      id: "general",
      label: "General Settings",
      icon: Sliders,
    },
    {
      id: "image-endpoints",
      label: `Image Endpoints (${imageEndpoints.length})`,
      icon: ImageIcon,
    },
    {
      id: "audio-endpoints",
      label: `Audio Endpoints (${audioEndpoints.length})`,
      icon: Volume2,
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl animate-card-rise pb-20">
      {/* Header */}
      <div className="pb-6 border-b border-line">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
            System Operations
          </span>
          <span className="text-xs font-mono text-ink-muted">/studio-settings</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
          Studio Settings
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
          Configure core intelligence pipeline keys, image generation endpoints, and audio generation endpoints in Neon PostgreSQL.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-line overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-signal text-signal bg-signal/5"
                  : "border-transparent text-ink-muted hover:text-ink hover:bg-ink/[0.02]"
              }`}
            >
              <Icon size={14} className={isActive ? "text-signal" : "text-ink-muted"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center justify-between animate-fade-in rounded-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            Settings and endpoints saved to database and locked against accidental changes!
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-emerald-700">Protected</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: GENERAL SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === "general" && (
          <div className="space-y-6 animate-slide-in">
            <section className="p-6 border border-line bg-paper-card space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
                  <span className="p-1.5 bg-signal/10 text-signal">
                    <KeyRound size={16} />
                  </span>
                  <span>Core Intelligence & Task Pipeline Keys</span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingGeneral((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                    editingGeneral
                      ? "bg-signal text-white border-signal shadow-xs"
                      : "bg-paper border-line text-ink hover:border-signal/40"
                  }`}
                >
                  {editingGeneral ? (
                    <>
                      <Unlock size={13} />
                      <span>Editing Enabled</span>
                    </>
                  ) : (
                    <>
                      <Pencil size={13} className="text-signal" />
                      <span>Edit Keys</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="openai-key">
                    OpenAI / LLM API Key
                  </label>
                  <input
                    id="openai-key"
                    type="password"
                    readOnly={!editingGeneral}
                    disabled={!editingGeneral}
                    value={openAiKey}
                    onChange={(e) => setOpenAiKey(e.target.value)}
                    placeholder="sk-proj-••••••••••••••••••••••••"
                    className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                      editingGeneral
                        ? "bg-white border-line-dark focus:border-signal"
                        : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                    }`}
                  />
                  <p className="text-[10px] text-ink-muted mt-1 font-mono">Used for script breakdowns and scene JSON prompts.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="anthropic-key">
                    Anthropic API Key (Claude)
                  </label>
                  <input
                    id="anthropic-key"
                    type="password"
                    readOnly={!editingGeneral}
                    disabled={!editingGeneral}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-••••••••••••••••••••••••"
                    className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                      editingGeneral
                        ? "bg-white border-line-dark focus:border-signal"
                        : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                    }`}
                  />
                  <p className="text-[10px] text-ink-muted mt-1 font-mono">Alternative model for narrative scripts.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="trigger-key">
                    Trigger.dev Secret Key
                  </label>
                  <input
                    id="trigger-key"
                    type="password"
                    readOnly={!editingGeneral}
                    disabled={!editingGeneral}
                    value={triggerSecretKey}
                    onChange={(e) => setTriggerSecretKey(e.target.value)}
                    placeholder="tr_dev_••••••••••••••••••••••••"
                    className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                      editingGeneral
                        ? "bg-white border-line-dark focus:border-signal"
                        : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                    }`}
                  />
                  <p className="text-[10px] text-ink-muted mt-1 font-mono">Background tasks execution engine.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="r2-bucket">
                    Cloudflare R2 Bucket Name
                  </label>
                  <input
                    id="r2-bucket"
                    type="text"
                    readOnly={!editingGeneral}
                    disabled={!editingGeneral}
                    value={r2BucketName}
                    onChange={(e) => setR2BucketName(e.target.value)}
                    placeholder="faceless-media"
                    className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                      editingGeneral
                        ? "bg-white border-line-dark focus:border-signal"
                        : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                    }`}
                  />
                  <p className="text-[10px] text-ink-muted mt-1 font-mono">Target S3-compatible asset storage bucket.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MULTIPLE IMAGE ENDPOINTS (ONLY: account-email, gen-url, usage) */}
        {/* ========================================================================= */}
        {activeTab === "image-endpoints" && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper-card p-4 border border-line">
              <div>
                <h3 className="text-xs font-semibold text-ink flex items-center gap-2">
                  <ImageIcon size={15} className="text-signal" />
                  <span>Image Endpoints Pool ({imageEndpoints.length})</span>
                </h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Saved endpoints are locked by default to prevent accidental edits. Click <strong>Edit</strong> on any endpoint to modify values.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddImageEndpoint}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Add Image Endpoint</span>
              </button>
            </div>

            {loadingDb ? (
              <div className="p-12 border border-line bg-paper-card text-center space-y-3">
                <Loader2 size={24} className="animate-spin text-signal mx-auto" />
                <p className="text-xs font-mono text-ink-muted">Loading image endpoints from database...</p>
              </div>
            ) : imageEndpoints.length === 0 ? (
              /* EMPTY STATE WHEN NO DATA IN DATABASE */
              <div className="p-12 border border-line bg-paper-card text-center space-y-4 rounded-xs">
                <div className="w-12 h-12 rounded-full bg-signal/10 border border-signal/20 text-signal flex items-center justify-center mx-auto">
                  <Inbox size={22} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-sm font-semibold text-ink">No Image Endpoints in Database</h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    There are currently no image generation endpoint records saved in the database. Add your first endpoint account to begin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddImageEndpoint}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add First Image Endpoint</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {imageEndpoints.map((endpoint, index) => {
                  const isEditing = !!editingImageIds[endpoint.id];
                  return (
                    <section
                      key={endpoint.id}
                      className={`p-4 sm:p-5 border transition-all space-y-4 relative ${
                        isEditing
                          ? "bg-white border-signal shadow-xs"
                          : "bg-paper-card border-line"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span
                            className="text-xs font-semibold text-ink truncate max-w-[140px] sm:max-w-[280px]"
                            title={endpoint.accountEmail || `Image Endpoint #${index + 1}`}
                          >
                            {endpoint.accountEmail || `Image Endpoint #${index + 1}`}
                          </span>
                          {isEditing ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              Editing
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider bg-paper-dark text-ink-muted border border-line flex items-center gap-1 shrink-0">
                              <Lock size={9} /> Locked
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleToggleEditImage(endpoint.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border transition-all cursor-pointer ${
                              isEditing
                                ? "bg-signal text-white border-signal font-semibold"
                                : "bg-paper border-line text-ink hover:border-signal/40"
                            }`}
                            title={isEditing ? "Finish editing and lock" : "Unlock and edit fields"}
                          >
                            {isEditing ? (
                              <>
                                <Check size={12} />
                                <span>Done</span>
                              </>
                            ) : (
                              <>
                                <Pencil size={11} className="text-signal" />
                                <span>Edit</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteImageEndpoint(endpoint.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-muted hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                            title="Delete this endpoint"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        {/* 1. account-email (5 cols) */}
                        <div className="sm:col-span-5">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`image-email-${endpoint.id}`}
                          >
                            <AtSign size={13} className="text-signal" />
                            <span>account-email</span>
                          </label>
                          <input
                            id={`image-email-${endpoint.id}`}
                            name="account-email"
                            type="email"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={endpoint.accountEmail}
                            onChange={(e) => handleUpdateImageEndpoint(endpoint.id, "accountEmail", e.target.value)}
                            placeholder="e.g. account@domain.com"
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>

                        {/* 2. gen-url (5 cols) */}
                        <div className="sm:col-span-5">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`image-url-${endpoint.id}`}
                          >
                            <Globe size={13} className="text-signal" />
                            <span>gen-url</span>
                          </label>
                          <input
                            id={`image-url-${endpoint.id}`}
                            name="gen-url"
                            type="url"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={endpoint.genUrl}
                            onChange={(e) => handleUpdateImageEndpoint(endpoint.id, "genUrl", e.target.value)}
                            placeholder="https://..."
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>

                        {/* 3. usage (integer) (2 cols) */}
                        <div className="sm:col-span-2">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`image-usage-${endpoint.id}`}
                          >
                            <Hash size={13} className="text-signal" />
                            <span>usage</span>
                          </label>
                          <input
                            id={`image-usage-${endpoint.id}`}
                            name="usage"
                            type="number"
                            step="1"
                            min="0"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={endpoint.usage}
                            onChange={(e) => handleUpdateImageEndpoint(endpoint.id, "usage", e.target.value)}
                            placeholder="0"
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {!loadingDb && imageEndpoints.length > 0 && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleAddImageEndpoint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Another Image Endpoint</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MULTIPLE AUDIO ENDPOINTS (ONLY: account-email, gen-url, usage) */}
        {/* ========================================================================= */}
        {activeTab === "audio-endpoints" && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper-card p-4 border border-line">
              <div>
                <h3 className="text-xs font-semibold text-ink flex items-center gap-2">
                  <Volume2 size={15} className="text-signal" />
                  <span>Audio Endpoints Pool ({audioEndpoints.length})</span>
                </h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Saved endpoints are locked by default to prevent accidental edits. Click <strong>Edit</strong> on any endpoint to modify values.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddAudioEndpoint}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Add Audio Endpoint</span>
              </button>
            </div>

            {loadingDb ? (
              <div className="p-12 border border-line bg-paper-card text-center space-y-3">
                <Loader2 size={24} className="animate-spin text-signal mx-auto" />
                <p className="text-xs font-mono text-ink-muted">Loading audio endpoints from database...</p>
              </div>
            ) : audioEndpoints.length === 0 ? (
              /* EMPTY STATE WHEN NO DATA IN DATABASE */
              <div className="p-12 border border-line bg-paper-card text-center space-y-4 rounded-xs">
                <div className="w-12 h-12 rounded-full bg-signal/10 border border-signal/20 text-signal flex items-center justify-center mx-auto">
                  <Inbox size={22} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-sm font-semibold text-ink">No Audio Endpoints in Database</h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    There are currently no audio generation endpoint records saved in the database. Add your first endpoint account to begin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAudioEndpoint}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add First Audio Endpoint</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {audioEndpoints.map((endpoint, index) => {
                  const isEditing = !!editingAudioIds[endpoint.id];
                  return (
                    <section
                      key={endpoint.id}
                      className={`p-4 sm:p-5 border transition-all space-y-4 relative ${
                        isEditing
                          ? "bg-white border-signal shadow-xs"
                          : "bg-paper-card border-line"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span
                            className="text-xs font-semibold text-ink truncate max-w-[140px] sm:max-w-[280px]"
                            title={endpoint.accountEmail || `Audio Endpoint #${index + 1}`}
                          >
                            {endpoint.accountEmail || `Audio Endpoint #${index + 1}`}
                          </span>
                          {isEditing ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              Editing
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider bg-paper-dark text-ink-muted border border-line flex items-center gap-1 shrink-0">
                              <Lock size={9} /> Locked
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleToggleEditAudio(endpoint.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border transition-all cursor-pointer ${
                              isEditing
                                ? "bg-signal text-white border-signal font-semibold"
                                : "bg-paper border-line text-ink hover:border-signal/40"
                            }`}
                            title={isEditing ? "Finish editing and lock" : "Unlock and edit fields"}
                          >
                            {isEditing ? (
                              <>
                                <Check size={12} />
                                <span>Done</span>
                              </>
                            ) : (
                              <>
                                <Pencil size={11} className="text-signal" />
                                <span>Edit</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAudioEndpoint(endpoint.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-muted hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                            title="Delete this endpoint"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        {/* 1. account-email (5 cols) */}
                        <div className="sm:col-span-5">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`audio-email-${endpoint.id}`}
                          >
                            <AtSign size={13} className="text-signal" />
                            <span>account-email</span>
                          </label>
                          <input
                            id={`audio-email-${endpoint.id}`}
                            name="account-email"
                            type="email"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={endpoint.accountEmail}
                            onChange={(e) => handleUpdateAudioEndpoint(endpoint.id, "accountEmail", e.target.value)}
                            placeholder="e.g. account@domain.com"
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>

                        {/* 2. gen-url (5 cols) */}
                        <div className="sm:col-span-5">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`audio-url-${endpoint.id}`}
                          >
                            <Globe size={13} className="text-signal" />
                            <span>gen-url</span>
                          </label>
                          <input
                            id={`audio-url-${endpoint.id}`}
                            name="gen-url"
                            type="url"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={endpoint.genUrl}
                            onChange={(e) => handleUpdateAudioEndpoint(endpoint.id, "genUrl", e.target.value)}
                            placeholder="https://..."
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>

                        {/* 3. usage (integer) (2 cols) */}
                        <div className="sm:col-span-2">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`audio-usage-${endpoint.id}`}
                          >
                            <Hash size={13} className="text-signal" />
                            <span>usage</span>
                          </label>
                          <input
                            id={`audio-usage-${endpoint.id}`}
                            name="usage"
                            type="number"
                            step="1"
                            min="0"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={endpoint.usage}
                            onChange={(e) => handleUpdateAudioEndpoint(endpoint.id, "usage", e.target.value)}
                            placeholder="0"
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {!loadingDb && audioEndpoints.length > 0 && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleAddAudioEndpoint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Another Audio Endpoint</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-6 border-t border-line">
          <div>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-sm border border-emerald-200">
                <CheckCircle2 size={14} /> All settings and endpoints saved to database
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSavingDb}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {isSavingDb ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

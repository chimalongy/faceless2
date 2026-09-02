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
  AlertCircle,
  Bot,
  Eye,
  EyeOff,
  Cpu,
  Calendar
} from "lucide-react";
import { useState, useEffect } from "react";

const SETTINGS_STORAGE_KEY = "faceless_studio_settings";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [saved, setSaved] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [isSavingDb, setIsSavingDb] = useState(false);

  // Tab 1: General Settings State
  const [defaultLlmSource, setDefaultLlmSource] = useState("gemini");
  const [defaultLlmModel, setDefaultLlmModel] = useState("gemini-2.5-flash");

  const [scriptGenSource, setScriptGenSource] = useState("gemini");
  const [scriptGenStrictSource, setScriptGenStrictSource] = useState(false);
  const [scriptGenModel, setScriptGenModel] = useState("gemini-2.5-flash");
  const [scriptGenStrictModel, setScriptGenStrictModel] = useState(false);

  const [sceneGenSource, setSceneGenSource] = useState("gemini");
  const [sceneGenStrictSource, setSceneGenStrictSource] = useState(false);
  const [sceneGenModel, setSceneGenModel] = useState("gemini-2.5-flash");
  const [sceneGenStrictModel, setSceneGenStrictModel] = useState(false);

  const [gemmaBaseUrl, setGemmaBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta/openai/");
  const [openRouterBaseUrl, setOpenRouterBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [modalVideoRenderUrl, setModalVideoRenderUrl] = useState("https://me-chimaobi--faceless-video-renderer-api.modal.run");
  const [modalSceneMergerUrl, setModalSceneMergerUrl] = useState("https://chima-geniusdomains--faceless-scene-merger-api.modal.run");
  const [editingGeneral, setEditingGeneral] = useState(false);

  // Tab 2: LLM Accounts State (Strictly: account_email, source, account_id, api_token, created, updated)
  const [llmAccounts, setLlmAccounts] = useState([]);
  const [editingLlmIds, setEditingLlmIds] = useState({});
  const [showTokens, setShowTokens] = useState({});

  // Tab 3: Multiple Image Endpoints State (Strictly: account-email, gen-url, usage)
  const [imageEndpoints, setImageEndpoints] = useState([]);
  const [editingImageIds, setEditingImageIds] = useState({});

  // Tab 4: Multiple Audio Endpoints State (Strictly: account-email, gen-url, usage)
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
          if (data.defaultLlmSource !== undefined) setDefaultLlmSource(data.defaultLlmSource);
          if (data.defaultLlmModel) setDefaultLlmModel(data.defaultLlmModel);

          if (data.scriptGenSource !== undefined) setScriptGenSource(data.scriptGenSource);
          if (data.scriptGenStrictSource !== undefined) setScriptGenStrictSource(Boolean(data.scriptGenStrictSource));
          if (data.scriptGenModel) setScriptGenModel(data.scriptGenModel);
          if (data.scriptGenStrictModel !== undefined) setScriptGenStrictModel(Boolean(data.scriptGenStrictModel));

          if (data.sceneGenSource !== undefined) setSceneGenSource(data.sceneGenSource);
          if (data.sceneGenStrictSource !== undefined) setSceneGenStrictSource(Boolean(data.sceneGenStrictSource));
          if (data.sceneGenModel) setSceneGenModel(data.sceneGenModel);
          if (data.sceneGenStrictModel !== undefined) setSceneGenStrictModel(Boolean(data.sceneGenStrictModel));

          if (data.gemmaBaseUrl) setGemmaBaseUrl(data.gemmaBaseUrl);
          if (data.openRouterBaseUrl) setOpenRouterBaseUrl(data.openRouterBaseUrl);
          if (data.modalVideoRenderUrl) setModalVideoRenderUrl(data.modalVideoRenderUrl);
          if (data.modalSceneMergerUrl) setModalSceneMergerUrl(data.modalSceneMergerUrl);

          if (Array.isArray(data.llmAccounts)) {
            setLlmAccounts(
              data.llmAccounts.map((item) => ({
                id: item.id ? String(item.id) : `llm-${Date.now()}-${Math.random()}`,
                accountEmail: item.accountEmail || item.account_email || "",
                source: item.source || "gemini",
                accountId: item.accountId || item.account_id || "",
                apiToken: item.apiToken || item.api_token || "",
                created: item.created || item.createdAt || null,
                updated: item.updated || item.updatedAt || null,
              }))
            );
          }
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

    // Fallback/sync General Settings from localStorage
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored);
        if (p.defaultLlmSource !== undefined) setDefaultLlmSource(p.defaultLlmSource);
        if (p.defaultLlmModel !== undefined) setDefaultLlmModel(p.defaultLlmModel);
        if (p.scriptGenSource !== undefined) setScriptGenSource(p.scriptGenSource);
        if (p.scriptGenStrictSource !== undefined) setScriptGenStrictSource(Boolean(p.scriptGenStrictSource));
        if (p.scriptGenModel !== undefined) setScriptGenModel(p.scriptGenModel);
        if (p.scriptGenStrictModel !== undefined) setScriptGenStrictModel(Boolean(p.scriptGenStrictModel));
        if (p.sceneGenSource !== undefined) setSceneGenSource(p.sceneGenSource);
        if (p.sceneGenStrictSource !== undefined) setSceneGenStrictSource(Boolean(p.sceneGenStrictSource));
        if (p.sceneGenModel !== undefined) setSceneGenModel(p.sceneGenModel);
        if (p.sceneGenStrictModel !== undefined) setSceneGenStrictModel(Boolean(p.sceneGenStrictModel));
        if (p.gemmaBaseUrl !== undefined) setGemmaBaseUrl(p.gemmaBaseUrl);
        if (p.openRouterBaseUrl !== undefined) setOpenRouterBaseUrl(p.openRouterBaseUrl);
        if (p.modalVideoRenderUrl !== undefined) setModalVideoRenderUrl(p.modalVideoRenderUrl);
        if (p.modalSceneMergerUrl !== undefined) setModalSceneMergerUrl(p.modalSceneMergerUrl);
      }
    } catch {}
  }, []);

  // LLM Accounts Handlers
  function handleAddLlmAccount() {
    const newId = `llm-${Date.now()}`;
    setLlmAccounts((prev) => [
      ...prev,
      {
        id: newId,
        accountEmail: "",
        source: defaultLlmSource || "gemini",
        accountId: "",
        apiToken: "",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    ]);
    // Automatically make newly added account editable
    setEditingLlmIds((prev) => ({ ...prev, [newId]: true }));
  }

  function handleToggleEditLlm(id) {
    setEditingLlmIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function handleToggleShowToken(id) {
    setShowTokens((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function handleUpdateLlmAccount(id, field, value) {
    setLlmAccounts((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: value,
          };
        }
        return item;
      })
    );
  }

  function handleDeleteLlmAccount(id) {
    setLlmAccounts((prev) => prev.filter((item) => item.id !== id));
    setEditingLlmIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setShowTokens((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

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

    const formattedLlmAccounts = llmAccounts.map((item) => ({
      id: item.id,
      "account-email": item.accountEmail.trim(),
      accountEmail: item.accountEmail.trim(),
      account_email: item.accountEmail.trim(),
      source: (item.source || "gemini").trim(),
      "account-id": item.accountId.trim(),
      accountId: item.accountId.trim(),
      account_id: item.accountId.trim(),
      "api-token": item.apiToken.trim(),
      apiToken: item.apiToken.trim(),
      api_token: item.apiToken.trim(),
    }));

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
      defaultLlmSource,
      defaultLlmModel,
      scriptGenSource,
      scriptGenStrictSource,
      scriptGenModel,
      scriptGenStrictModel,
      sceneGenSource,
      sceneGenStrictSource,
      sceneGenModel,
      sceneGenStrictModel,
      gemmaBaseUrl,
      openRouterBaseUrl,
      modalVideoRenderUrl,
      modalSceneMergerUrl,
      llmAccounts: formattedLlmAccounts,
      imageEndpoints: formattedImageEndpoints,
      audioEndpoints: formattedAudioEndpoints,
    };

    // Save to Database
    try {
      const res = await fetch("/api/settings/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.defaultLlmSource !== undefined) setDefaultLlmSource(data.defaultLlmSource);
        if (data.defaultLlmModel) setDefaultLlmModel(data.defaultLlmModel);

        if (data.scriptGenSource !== undefined) setScriptGenSource(data.scriptGenSource);
        if (data.scriptGenStrictSource !== undefined) setScriptGenStrictSource(Boolean(data.scriptGenStrictSource));
        if (data.scriptGenModel) setScriptGenModel(data.scriptGenModel);
        if (data.scriptGenStrictModel !== undefined) setScriptGenStrictModel(Boolean(data.scriptGenStrictModel));

        if (data.sceneGenSource !== undefined) setSceneGenSource(data.sceneGenSource);
        if (data.sceneGenStrictSource !== undefined) setSceneGenStrictSource(Boolean(data.sceneGenStrictSource));
        if (data.sceneGenModel) setSceneGenModel(data.sceneGenModel);
        if (data.sceneGenStrictModel !== undefined) setSceneGenStrictModel(Boolean(data.sceneGenStrictModel));

        if (data.gemmaBaseUrl) setGemmaBaseUrl(data.gemmaBaseUrl);
        if (data.openRouterBaseUrl) setOpenRouterBaseUrl(data.openRouterBaseUrl);
        if (data.modalVideoRenderUrl) setModalVideoRenderUrl(data.modalVideoRenderUrl);
        if (data.modalSceneMergerUrl) setModalSceneMergerUrl(data.modalSceneMergerUrl);
        if (Array.isArray(data.llmAccounts)) {
          setLlmAccounts(
            data.llmAccounts.map((item) => ({
              id: item.id ? String(item.id) : `llm-${Date.now()}`,
              accountEmail: item.accountEmail || item.account_email || "",
              accountId: item.accountId || item.account_id || "",
              apiToken: item.apiToken || item.api_token || "",
              created: item.created || item.createdAt || null,
              updated: item.updated || item.updatedAt || null,
            }))
          );
        }
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
    setEditingLlmIds({});
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
      id: "llm-accounts",
      label: `LLMs Accounts (${llmAccounts.length})`,
      icon: Bot,
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
          Configure default LLM models, LLM provider accounts, image generation endpoints, and audio generation endpoints in Neon PostgreSQL.
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
            {/* General Settings: Default Models & Pipeline Config */}
            <section className="p-6 border border-line bg-paper-card space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
                  <span className="p-1.5 bg-signal/10 text-signal">
                    <Sliders size={16} />
                  </span>
                  <span>General Model & Provider Configuration (general_settings)</span>
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
                      <span>Edit Settings</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-6">
                {/* 1. Global Default LLM Fallback */}
                <div className="p-5 border border-line/70 bg-paper/50 rounded-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="flex items-center gap-2">
                      <Bot size={15} className="text-signal" />
                      <span className="text-xs font-semibold text-ink">Global Default Fallback LLM</span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-muted">general_settings.default_llm</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="block text-xs font-semibold text-ink">Default Provider</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!editingGeneral}
                          onClick={() => setDefaultLlmSource("gemini")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xs border transition-all cursor-pointer ${
                            defaultLlmSource === "gemini"
                              ? "bg-signal text-white border-signal shadow-xs"
                              : "bg-white border-line text-ink-muted hover:text-ink"
                          } ${!editingGeneral ? "opacity-80 cursor-not-allowed" : ""}`}
                        >
                          Google Gemini
                        </button>
                        <button
                          type="button"
                          disabled={!editingGeneral}
                          onClick={() => setDefaultLlmSource("openrouter")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xs border transition-all cursor-pointer ${
                            defaultLlmSource === "openrouter"
                              ? "bg-signal text-white border-signal shadow-xs"
                              : "bg-white border-line text-ink-muted hover:text-ink"
                          } ${!editingGeneral ? "opacity-80 cursor-not-allowed" : ""}`}
                        >
                          OpenRouter
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-8 space-y-1.5">
                      <label className="block text-xs font-semibold text-ink" htmlFor="default-llm-model">
                        Default Fallback Model
                      </label>
                      <input
                        id="default-llm-model"
                        type="text"
                        readOnly={!editingGeneral}
                        disabled={!editingGeneral}
                        value={defaultLlmModel}
                        onChange={(e) => setDefaultLlmModel(e.target.value)}
                        placeholder="e.g. gemini-2.5-flash"
                        className={`w-full h-10 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                          editingGeneral
                            ? "bg-white border-line-dark focus:border-signal"
                            : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-ink-muted font-mono">
                    Fallback AI provider and model used across workflows when no specialized pipeline configuration is defined.
                  </p>
                </div>

                {/* 2. Script Generation Pipeline */}
                <div className="p-5 border border-line/70 bg-paper/50 rounded-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="flex items-center gap-2">
                      <Bot size={15} className="text-signal" />
                      <span className="text-xs font-semibold text-ink">Script Generation Configuration</span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-muted">general_settings.script_gen</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Source Provider & Strict Source */}
                    <div className="sm:col-span-5 space-y-2">
                      <label className="block text-xs font-semibold text-ink">Provider Source</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!editingGeneral}
                          onClick={() => setScriptGenSource("gemini")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xs border transition-all cursor-pointer ${
                            scriptGenSource === "gemini"
                              ? "bg-signal text-white border-signal shadow-xs"
                              : "bg-white border-line text-ink-muted hover:text-ink"
                          } ${!editingGeneral ? "opacity-80 cursor-not-allowed" : ""}`}
                        >
                          Google Gemini
                        </button>
                        <button
                          type="button"
                          disabled={!editingGeneral}
                          onClick={() => setScriptGenSource("openrouter")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xs border transition-all cursor-pointer ${
                            scriptGenSource === "openrouter"
                              ? "bg-signal text-white border-signal shadow-xs"
                              : "bg-white border-line text-ink-muted hover:text-ink"
                          } ${!editingGeneral ? "opacity-80 cursor-not-allowed" : ""}`}
                        >
                          OpenRouter
                        </button>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          disabled={!editingGeneral}
                          checked={scriptGenStrictSource}
                          onChange={(e) => setScriptGenStrictSource(e.target.checked)}
                          className="w-3.5 h-3.5 text-signal border-line rounded-xs focus:ring-signal"
                        />
                        <span className="text-[11px] font-medium text-ink">
                          Strictly use API keys from this provider
                        </span>
                      </label>
                    </div>

                    {/* Model & Strict Model */}
                    <div className="sm:col-span-7 space-y-2">
                      <label className="block text-xs font-semibold text-ink" htmlFor="script-gen-model">
                        Script Generation Model
                      </label>
                      <input
                        id="script-gen-model"
                        type="text"
                        readOnly={!editingGeneral}
                        disabled={!editingGeneral}
                        value={scriptGenModel}
                        onChange={(e) => setScriptGenModel(e.target.value)}
                        placeholder="e.g. gemini-2.5-pro"
                        className={`w-full h-10 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                          editingGeneral
                            ? "bg-white border-line-dark focus:border-signal"
                            : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                        }`}
                      />

                      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          disabled={!editingGeneral}
                          checked={scriptGenStrictModel}
                          onChange={(e) => setScriptGenStrictModel(e.target.checked)}
                          className="w-3.5 h-3.5 text-signal border-line rounded-xs focus:ring-signal"
                        />
                        <span className="text-[11px] font-medium text-ink">
                          Strictly use this model for script generation
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Scene Breakdown & Generation Pipeline */}
                <div className="p-5 border border-line/70 bg-paper/50 rounded-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="flex items-center gap-2">
                      <Bot size={15} className="text-signal" />
                      <span className="text-xs font-semibold text-ink">Scene Generation Configuration</span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-muted">general_settings.scene_gen</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Source Provider & Strict Source */}
                    <div className="sm:col-span-5 space-y-2">
                      <label className="block text-xs font-semibold text-ink">Provider Source</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!editingGeneral}
                          onClick={() => setSceneGenSource("gemini")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xs border transition-all cursor-pointer ${
                            sceneGenSource === "gemini"
                              ? "bg-signal text-white border-signal shadow-xs"
                              : "bg-white border-line text-ink-muted hover:text-ink"
                          } ${!editingGeneral ? "opacity-80 cursor-not-allowed" : ""}`}
                        >
                          Google Gemini
                        </button>
                        <button
                          type="button"
                          disabled={!editingGeneral}
                          onClick={() => setSceneGenSource("openrouter")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xs border transition-all cursor-pointer ${
                            sceneGenSource === "openrouter"
                              ? "bg-signal text-white border-signal shadow-xs"
                              : "bg-white border-line text-ink-muted hover:text-ink"
                          } ${!editingGeneral ? "opacity-80 cursor-not-allowed" : ""}`}
                        >
                          OpenRouter
                        </button>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          disabled={!editingGeneral}
                          checked={sceneGenStrictSource}
                          onChange={(e) => setSceneGenStrictSource(e.target.checked)}
                          className="w-3.5 h-3.5 text-signal border-line rounded-xs focus:ring-signal"
                        />
                        <span className="text-[11px] font-medium text-ink">
                          Strictly use API keys from this provider
                        </span>
                      </label>
                    </div>

                    {/* Model & Strict Model */}
                    <div className="sm:col-span-7 space-y-2">
                      <label className="block text-xs font-semibold text-ink" htmlFor="scene-gen-model">
                        Scene Generation Model
                      </label>
                      <input
                        id="scene-gen-model"
                        type="text"
                        readOnly={!editingGeneral}
                        disabled={!editingGeneral}
                        value={sceneGenModel}
                        onChange={(e) => setSceneGenModel(e.target.value)}
                        placeholder="e.g. gemini-2.5-flash"
                        className={`w-full h-10 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                          editingGeneral
                            ? "bg-white border-line-dark focus:border-signal"
                            : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                        }`}
                      />

                      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          disabled={!editingGeneral}
                          checked={sceneGenStrictModel}
                          onChange={(e) => setSceneGenStrictModel(e.target.checked)}
                          className="w-3.5 h-3.5 text-signal border-line rounded-xs focus:ring-signal"
                        />
                        <span className="text-[11px] font-medium text-ink">
                          Strictly use this model for scene generation
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. Base URLs Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 border border-line/70 bg-paper/50 rounded-xs space-y-2">
                    <label className="block text-xs font-semibold text-ink flex items-center justify-between" htmlFor="gemma-base-url">
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-signal" />
                        <span>Gemini / Gemma Base URL</span>
                      </span>
                    </label>
                    <input
                      id="gemma-base-url"
                      type="text"
                      readOnly={!editingGeneral}
                      disabled={!editingGeneral}
                      value={gemmaBaseUrl}
                      onChange={(e) => setGemmaBaseUrl(e.target.value)}
                      placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
                      className={`w-full h-9 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                        editingGeneral
                          ? "bg-white border-line-dark focus:border-signal"
                          : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                      }`}
                    />
                    <p className="text-[10px] text-ink-muted font-mono">
                      Google Generative Language OpenAI-compatible endpoint.
                    </p>
                  </div>

                  <div className="p-4 border border-line/70 bg-paper/50 rounded-xs space-y-2">
                    <label className="block text-xs font-semibold text-ink flex items-center justify-between" htmlFor="open-router-base-url">
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-signal" />
                        <span>OpenRouter Base URL</span>
                      </span>
                    </label>
                    <input
                      id="open-router-base-url"
                      type="text"
                      readOnly={!editingGeneral}
                      disabled={!editingGeneral}
                      value={openRouterBaseUrl}
                      onChange={(e) => setOpenRouterBaseUrl(e.target.value)}
                      placeholder="https://openrouter.ai/api/v1"
                      className={`w-full h-9 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                        editingGeneral
                          ? "bg-white border-line-dark focus:border-signal"
                          : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                      }`}
                    />
                    <p className="text-[10px] text-ink-muted font-mono">
                      OpenRouter API Base URL for multi-model routing.
                    </p>
                  </div>

                  <div className="p-4 border border-line/70 bg-paper/50 rounded-xs space-y-2 md:col-span-2">
                    <label className="block text-xs font-semibold text-ink flex items-center justify-between" htmlFor="modal-video-render-url">
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-signal" />
                        <span>Modal Video Render Endpoint</span>
                      </span>
                    </label>
                    <input
                      id="modal-video-render-url"
                      type="text"
                      readOnly={!editingGeneral}
                      disabled={!editingGeneral}
                      value={modalVideoRenderUrl}
                      onChange={(e) => setModalVideoRenderUrl(e.target.value)}
                      placeholder="https://me-chimaobi--faceless-video-renderer-api.modal.run"
                      className={`w-full h-9 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                        editingGeneral
                          ? "bg-white border-line-dark focus:border-signal"
                          : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                      }`}
                    />
                    <p className="text-[10px] text-ink-muted font-mono">
                      Modal FastAPI video renderer base URL for GPU-accelerated Ken Burns scene rendering.
                    </p>
                  </div>

                  <div className="p-4 border border-line/70 bg-paper/50 rounded-xs space-y-2 md:col-span-2">
                    <label className="block text-xs font-semibold text-ink flex items-center justify-between" htmlFor="modal-scene-merger-url">
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-signal" />
                        <span>Modal Scene Merger Endpoint</span>
                      </span>
                    </label>
                    <input
                      id="modal-scene-merger-url"
                      type="text"
                      readOnly={!editingGeneral}
                      disabled={!editingGeneral}
                      value={modalSceneMergerUrl}
                      onChange={(e) => setModalSceneMergerUrl(e.target.value)}
                      placeholder="https://chima-geniusdomains--faceless-scene-merger-api.modal.run"
                      className={`w-full h-9 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                        editingGeneral
                          ? "bg-white border-line-dark focus:border-signal"
                          : "bg-paper-dark/60 border-line text-ink/70 cursor-not-allowed"
                      }`}
                    />
                    <p className="text-[10px] text-ink-muted font-mono">
                      Modal FastAPI scene merger base URL for high-performance FFmpeg master video concatenation.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LLM ACCOUNTS (account_email, source, account_id, api_token, created, updated) */}
        {/* ========================================================================= */}
        {activeTab === "llm-accounts" && (
          <div className="space-y-6 animate-slide-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper-card p-4 border border-line">
              <div>
                <h3 className="text-xs font-semibold text-ink flex items-center gap-2">
                  <Bot size={15} className="text-signal" />
                  <span>LLM Accounts Pool ({llmAccounts.length})</span>
                </h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Configure multiple Gemini & OpenRouter API accounts. Saved accounts are locked by default.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddLlmAccount}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Add LLM Account</span>
              </button>
            </div>

            {loadingDb ? (
              <div className="p-12 border border-line bg-paper-card text-center space-y-3">
                <Loader2 size={24} className="animate-spin text-signal mx-auto" />
                <p className="text-xs font-mono text-ink-muted">Loading LLM accounts from database...</p>
              </div>
            ) : llmAccounts.length === 0 ? (
              /* EMPTY STATE WHEN NO DATA IN DATABASE */
              <div className="p-12 border border-line bg-paper-card text-center space-y-4 rounded-xs">
                <div className="w-12 h-12 rounded-full bg-signal/10 border border-signal/20 text-signal flex items-center justify-center mx-auto">
                  <Bot size={22} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-sm font-semibold text-ink">No LLM Accounts in Database</h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    There are currently no LLM account records saved in the database. Add your first Gemini or OpenRouter account to begin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLlmAccount}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add First LLM Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {llmAccounts.map((account, index) => {
                  const isEditing = !!editingLlmIds[account.id];
                  const showToken = !!showTokens[account.id];
                  const sourceVal = account.source || "gemini";
                  return (
                    <section
                      key={account.id}
                      className={`p-4 sm:p-5 border transition-all space-y-4 relative ${
                        isEditing
                          ? "bg-white border-signal shadow-xs"
                          : "bg-paper-card border-line"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-line pb-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span
                            className="text-xs font-semibold text-ink truncate max-w-[140px] sm:max-w-[280px]"
                            title={account.accountEmail || `LLM Account #${index + 1}`}
                          >
                            {account.accountEmail || `LLM Account #${index + 1}`}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-xs border shrink-0 ${
                              sourceVal === "openrouter"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {sourceVal === "openrouter" ? "OpenRouter" : "Gemini"}
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
                            onClick={() => handleToggleEditLlm(account.id)}
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
                            onClick={() => handleDeleteLlmAccount(account.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-muted hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                            title="Delete this LLM account"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        {/* 1. source (3 cols) */}
                        <div className="sm:col-span-3">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`llm-source-${account.id}`}
                          >
                            <Cpu size={13} className="text-signal" />
                            <span>Source Provider</span>
                          </label>
                          <select
                            id={`llm-source-${account.id}`}
                            disabled={!isEditing}
                            value={account.source || "gemini"}
                            onChange={(e) => handleUpdateLlmAccount(account.id, "source", e.target.value)}
                            className={`w-full h-10 px-3 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          >
                            <option value="gemini">Google Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                          </select>
                        </div>

                        {/* 2. account_email (4 cols) */}
                        <div className="sm:col-span-4">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center gap-1.5"
                            htmlFor={`llm-email-${account.id}`}
                          >
                            <AtSign size={13} className="text-signal" />
                            <span>account_email</span>
                          </label>
                          <input
                            id={`llm-email-${account.id}`}
                            name="account_email"
                            type="email"
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={account.accountEmail}
                            onChange={(e) => handleUpdateLlmAccount(account.id, "accountEmail", e.target.value)}
                            placeholder="e.g. user@gmail.com"
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>

                        {/* 3. api_token (text) (5 cols) */}
                        <div className="sm:col-span-5">
                          <label
                            className="block text-xs font-semibold text-ink/80 mb-1.5 flex items-center justify-between"
                            htmlFor={`llm-token-${account.id}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <KeyRound size={13} className="text-signal" />
                              <span>API Key / Token</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleShowToken(account.id)}
                              className="text-[11px] text-ink-muted hover:text-signal flex items-center gap-1 cursor-pointer"
                            >
                              {showToken ? (
                                <>
                                  <EyeOff size={12} />
                                  <span>Hide</span>
                                </>
                              ) : (
                                <>
                                  <Eye size={12} />
                                  <span>Show</span>
                                </>
                              )}
                            </button>
                          </label>
                          <input
                            id={`llm-token-${account.id}`}
                            name="api_token"
                            type={showToken ? "text" : "password"}
                            readOnly={!isEditing}
                            disabled={!isEditing}
                            value={account.apiToken}
                            onChange={(e) => handleUpdateLlmAccount(account.id, "apiToken", e.target.value)}
                            placeholder="e.g. AIzaSy... or sk-or-v1-..."
                            className={`w-full h-10 px-3.5 border text-xs font-mono text-ink outline-none transition-all ${
                              isEditing
                                ? "bg-white border-line-dark focus:border-signal"
                                : "bg-paper-dark/60 border-line text-ink/80 cursor-not-allowed"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Timestamps if available */}
                      {(account.created || account.updated) && (
                        <div className="pt-2 border-t border-line/60 flex items-center gap-4 text-[10px] font-mono text-ink-muted">
                          {account.created && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              Created: {new Date(account.created).toLocaleString()}
                            </span>
                          )}
                          {account.updated && (
                            <span>
                              Updated: {new Date(account.updated).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {!loadingDb && llmAccounts.length > 0 && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleAddLlmAccount}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-line bg-paper-card hover:bg-ink/5 text-xs font-semibold text-ink transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Another LLM Account</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MULTIPLE IMAGE ENDPOINTS (ONLY: account-email, gen-url, usage) */}
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

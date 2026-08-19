"use client";

import { KeyRound, Youtube, Sliders, CheckCircle2, Save } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [openAiKey, setOpenAiKey] = useState("••••••••••••••••••••••••••••");
  const [elevenLabsKey, setElevenLabsKey] = useState("••••••••••••••••••••••••••••");
  const [autoPublish, setAutoPublish] = useState(false);
  const [defaultResolution, setDefaultResolution] = useState("4K (2160p)");
  const [aspectRatio, setAspectRatio] = useState("16:9 (Landscape)");

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-8 max-w-4xl animate-card-rise">
      {/* Header */}
      <div className="pb-6 border-b border-line">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
          Studio Settings
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted mt-1">
          Configure API credentials, YouTube publishing channels, and render defaults.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* API Credentials */}
        <section className="p-6 rounded-xl border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
            <span className="p-1.5 rounded-md bg-signal/10 text-signal">
              <KeyRound size={16} />
            </span>
            <span>AI & Engine Keys</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="openai-key">
                OpenAI / Anthropic API Key
              </label>
              <input
                id="openai-key"
                type="password"
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="elevenlabs-key">
                ElevenLabs Voice API Key
              </label>
              <input
                id="elevenlabs-key"
                type="password"
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all"
              />
            </div>
          </div>
        </section>

        {/* YouTube Integration */}
        <section className="p-6 rounded-xl border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
            <span className="p-1.5 rounded-md bg-rose/10 text-rose">
              <Youtube size={16} />
            </span>
            <span>YouTube Direct Publishing</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-paper-dark border border-line">
            <div>
              <p className="text-xs font-semibold text-ink">Auto-upload generated masters</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Automatically push rendered videos to unlisted status on YouTube for review.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-ink/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-signal"></div>
            </label>
          </div>
        </section>

        {/* Render Defaults */}
        <section className="p-6 rounded-xl border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm">
            <span className="p-1.5 rounded-md bg-signal/10 text-signal">
              <Sliders size={16} />
            </span>
            <span>Render Pipeline Presets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="resolution">
                Default Master Resolution
              </label>
              <select
                id="resolution"
                value={defaultResolution}
                onChange={(e) => setDefaultResolution(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg border border-line-dark bg-white text-xs font-medium text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all"
              >
                <option>4K (2160p)</option>
                <option>1440p (QHD)</option>
                <option>1080p (Full HD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="aspect">
                Primary Aspect Ratio
              </label>
              <select
                id="aspect"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg border border-line-dark bg-white text-xs font-medium text-ink outline-none focus:border-signal focus:ring-2 focus:ring-signal/15 transition-all"
              >
                <option>16:9 (Landscape)</option>
                <option>9:16 (Shorts / Reels)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-4">
          <div>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
                <CheckCircle2 size={14} /> Settings successfully saved
              </span>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
          >
            <Save size={15} /> Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}


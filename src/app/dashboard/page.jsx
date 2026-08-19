"use client";

import { Plus, X, Video, Sparkles, ArrowUpRight, Trash2, AlertTriangle, Layers, Edit3, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

// Initial fallback channels with all 16 canonical fields
const dummyChannels = [
  {
    name: "The Quiet Ledger",
    slug: "the-quiet-ledger",
    handle: "@thequietledger",
    channelUrl: "https://youtube.com/@thequietledger",
    description: "Deep historical breakdowns of financial collapses, sovereign debt crises, central bank liquidity flows, and wealth preservation strategies.",
    tagline: "Uncovering the silent mechanics of sovereign wealth and monetary history.",
    niche: "Personal Finance",
    subNiche: "Macroeconomics & Monetary History",
    contentCategory: "Education & Documentaries",
    targetAudience: "Macro investors, finance professionals, sovereign wealth analysts, economic history enthusiasts",
    mission: "To demystify complex macroeconomic phenomena through immersive historical storytelling and visual documentary narratives.",
    valueProposition: "Actionable macro-historical context without clickbait noise or surface-level speculation.",
    personality: "Analytical, calm, authoritative, investigative, and deeply research-driven.",
    brandPositioning: "The premier quiet intelligence desk for long-form financial documentaries.",
    brandPromise: "Every episode delivers rigorous historical accuracy, high-fidelity visual analysis, and zero hyperbole.",
    imageTheme: "Monochromatic dark slate, gold bullion accents, archival parchment textures, vintage banking ledgers, volumetric rim lighting, 8k cinematic macro documentary",
    thumbnailTheme: "Bold golden typography, dramatic high-contrast ledger close-up with red financial crash charts, dark obsidian background, mysterious vault lighting",
    audioTheme: "Deep baritone narrator, subtle low-frequency drone (-20dB), acoustic cello swells, vintage clockwork ticks",
    videos: 24,
    status: "Active",
  },
  {
    name: "Stoic Signal",
    slug: "stoic-signal",
    handle: "@stoicsignal",
    channelUrl: "https://youtube.com/@stoicsignal",
    description: "Applied classical philosophy, mental models, and ancient wisdom distilled for modern high-stakes decision makers.",
    tagline: "Ancient clarity for modern chaos.",
    niche: "Applied Philosophy",
    subNiche: "Stoicism & Mental Models",
    contentCategory: "Self-Improvement & Philosophy",
    targetAudience: "Entrepreneurs, leaders, thinkers seeking emotional resilience and cognitive mastery",
    mission: "To translate timeless Greco-Roman philosophical tenets into actionable frameworks for contemporary life.",
    valueProposition: "Timeless mental models condensed into cinematic thought experiments.",
    personality: "Contemplative, grounded, direct, stoic, and philosophical.",
    brandPositioning: "The intellectual sanctuary for modern practitioners of classical thought.",
    brandPromise: "Practical wisdom that tempers the mind and sharpens clarity under pressure.",
    imageTheme: "Chiseled marble statues, Greco-Roman architectural ruins, dramatic chiaroscuro lighting, deep stone gray and terracotta tones, 8k documentary cinematography",
    thumbnailTheme: "Chiseled stone statue of Marcus Aurelius in split lighting, bold glowing white/yellow serif keywords, deep shadow vignettes, intense philosophical stare",
    audioTheme: "Warm acoustic piano notes, resonant orator voice, distant atmospheric storm ambience",
    videos: 41,
    status: "Active",
  },
  {
    name: "Late Byte",
    slug: "late-byte",
    handle: "@latebyte",
    channelUrl: "https://youtube.com/@latebyte",
    description: "Deep investigative explorations of computing history, semiconductor wars, distributed systems, and forgotten software paradigms.",
    tagline: "Behind the silicon and the code that shaped the world.",
    niche: "Technology",
    subNiche: "Computing History & Systems Architecture",
    contentCategory: "Science & Technology",
    targetAudience: "Software engineers, hardware enthusiasts, computer science students, tech history buffs",
    mission: "To chronicle the untold breakthroughs, engineering tradeoffs, and eccentric geniuses behind digital infrastructure.",
    valueProposition: "Deep-dive technical rigor presented with narrative drama and visual clarity.",
    personality: "Curious, technical, nostalgic, fastidious, and insightful.",
    brandPositioning: "The definitive chronicle of computational breakthroughs and silicon architecture.",
    brandPromise: "Complex hardware and algorithmic concepts explained without dumbing down the engineering.",
    imageTheme: "Retro CRT scanlines, neon amber on dark obsidian, microchip silicon dies under microscope, blue schematic wireframes, cyberpunk documentary aesthetic",
    thumbnailTheme: "Extreme close-up macro of an illuminated CPU die, neon amber and cyan terminal text overlay, retro wireframe grid, bold single-word hook",
    audioTheme: "Subtle analog synthesizer pads, vintage mechanical keyboard clicks, crisp clear modern narrator",
    videos: 12,
    status: "Draft",
  },
  {
    name: "Field Notes",
    slug: "field-notes",
    handle: "@fieldnotes",
    channelUrl: "https://youtube.com/@fieldnotes",
    description: "Unraveling rare ecological phenomena, subterranean biological intelligence, primeval botany, and planetary cycles.",
    tagline: "Expeditions into the unseen machinery of the living planet.",
    niche: "Nature & Science",
    subNiche: "Primeval Botany & Mycology",
    contentCategory: "Nature & Environment",
    targetAudience: "Nature documentarians, biology researchers, ambient science enthusiasts",
    mission: "To illuminate the intricate, silent biological systems that sustain our biosphere.",
    valueProposition: "Immersive scientific expeditions that make the invisible wonders of nature tangible.",
    personality: "Reverent, inquisitive, naturalist, poetic, and authoritative.",
    brandPositioning: "The naturalist's field desk for deep ecological and subterranean biology documentaries.",
    brandPromise: "Breathtaking macro-cinematography coupled with rigorous biological storytelling.",
    imageTheme: "Bioluminescent fungal spores, ancient primeval forest moss, rich dark fertile humus loam, macro botanical photography, 8k Unreal Engine nature render",
    thumbnailTheme: "Ultra-vibrant macro bioluminescent mushroom spore or carnivorous plant, electric emerald and violet highlights, clean minimalist title card, high depth-of-field",
    audioTheme: "Deep resonant naturalist narration, gentle subterranean water drips, rustling primeval leaves, ethereal wind drones",
    videos: 8,
    status: "Active",
  },
  {
    name: "Cold Open",
    slug: "cold-open",
    handle: "@coldopen",
    channelUrl: "https://youtube.com/@coldopen",
    description: "Methodical investigations into unresolved maritime mysteries, cold case forensic science, and espionage history.",
    tagline: "Where the evidence speaks and the trail goes cold.",
    niche: "True Crime & History",
    subNiche: "Forensics & Maritime Mysteries",
    contentCategory: "Documentary & Crime",
    targetAudience: "Investigative documentary fans, forensic science enthusiasts, mystery researchers",
    mission: "To present forensic facts and historical timelines with sober journalistic integrity.",
    valueProposition: "Fact-based, evidence-first investigations free of sensationalist melodrama.",
    personality: "Somber, methodical, objective, gripping, and respectful.",
    brandPositioning: "The forensic archive for unsolved mysteries and historical enigmas.",
    brandPromise: "Zero exploitation—pure timeline analysis, verified records, and forensic breakdown.",
    imageTheme: "Archival newspaper clippings, forensic microfiche, noir rain-slicked city streets, moody cyan and desaturated monochrome lighting, 35mm film grain",
    thumbnailTheme: "Noir forensic evidence board with red strings, high-contrast cyan spotlight, redacted black marker documents, chilling investigative question hook",
    audioTheme: "Low ominous cello bowings, subtle typewriter clicks, rain on glass ambience, crisp noir voiceover",
    videos: 33,
    status: "Paused",
  },
  {
    name: "Low Light",
    slug: "low-light",
    handle: "@lowlight",
    channelUrl: "https://youtube.com/@lowlight",
    description: "Atmospheric visual soundscapes, nighttime urban architecture, and hypnotic ambient sleep documentaries.",
    tagline: "Soundscapes and visual poetry for the quiet hours.",
    niche: "Sleep & Ambience",
    subNiche: "Urban Nightscapes & Deep Ambient",
    contentCategory: "Music & Ambience",
    targetAudience: "Night owls, creative workers, students seeking focus, sleep and meditation seekers",
    mission: "To provide an auditory and visual sanctuary for focus, de-stressing, and restorative rest.",
    valueProposition: "High-production ambient environments crafted with audiophile-grade binaural sound.",
    personality: "Tranquil, hypnotic, comforting, minimalist, and serene.",
    brandPositioning: "The premier nocturnal audio-visual aesthetic engine.",
    brandPromise: "Seamless, loopable sonic mastery designed to induce deep flow or serene sleep.",
    imageTheme: "Rain on neon skyscraper windows, misty Tokyo alleyways at 3 AM, soft bokeh orbs, warm amber interior glow against midnight navy, cinematic anamorphic lens",
    thumbnailTheme: "Gleaming rain-slicked Tokyo neon storefront at midnight, deep cinematic blue ambient bokeh, ultra-clean aesthetic sans-serif typography, cozy mood",
    audioTheme: "Tape-saturated binaural rain sounds, distant train rumbles, ultra-soft warm voiceover, 432Hz ambient synthesizer pads",
    videos: 19,
    status: "Active",
  },
];

const STORAGE_KEY = "faceless_channels";

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getStatusBadge(status) {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "paused":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    default:
      return "bg-ink/5 text-ink-muted border-line";
  }
}

export default function OverviewPage() {
  const [openComposer, setOpenComposer] = useState(false);
  const [channels, setChannels] = useState(dummyChannels);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [name, setName] = useState("");
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [mounted, setMounted] = useState(false);

  function handleCopyChannelJson(channel, e) {
    e.stopPropagation();
    e.preventDefault();
    const nestedData = {
      channel: {
        name: channel.name,
        slug: channel.slug,
        handle: channel.handle || `@${channel.slug}`,
        channel_url: channel.channelUrl || `https://youtube.com/@${channel.slug}`,
        tagline: channel.tagline || "",
        description: channel.description || "",
        status: channel.status || "Active",
        videos: channel.videos || 0
      },
      niche_and_audience: {
        niche: channel.niche || "Documentaries",
        sub_niche: channel.subNiche || "",
        content_category: channel.contentCategory || "Education & Documentaries",
        target_audience: channel.targetAudience || ""
      },
      brand_strategy: {
        mission: channel.mission || "",
        value_proposition: channel.valueProposition || "",
        personality: channel.personality || "",
        brand_positioning: channel.brandPositioning || "",
        brand_promise: channel.brandPromise || ""
      },
      creative_themes: {
        image_theme: channel.imageTheme || "",
        thumbnail_theme: channel.thumbnailTheme || "",
        audio_theme: channel.audioTheme || ""
      }
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(nestedData, null, 2));
      setCopiedSlug(channel.slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // Fallback
    }
  }

  // Load channels from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChannels(parsed);
        } else {
          setChannels(dummyChannels);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dummyChannels));
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dummyChannels));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save to localStorage
  function persistChannels(newList) {
    setChannels(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignore localStorage errors
    }
  }

  // Dismiss modals on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpenComposer(false);
        setChannelToDelete(null);
      }
    }
    if (openComposer || channelToDelete) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [openComposer, channelToDelete]);

  function submitChannel(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const cleanSlug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const cleanHandle = `@${cleanSlug.replace(/-/g, "")}`;
    const defaultNiche = "Documentaries";
    const defaultTagline = `Cinematic documentary investigations and narratives for ${trimmed}.`;

    const newChannel = {
      name: trimmed,
      slug: cleanSlug,
      handle: cleanHandle,
      channelUrl: `https://youtube.com/${cleanHandle}`,
      description: `Automated long-form narrative production engine for ${trimmed}.`,
      tagline: defaultTagline,
      niche: defaultNiche,
      subNiche: "Investigative Documentaries",
      contentCategory: "Education & Documentaries",
      targetAudience: "Curious minds, documentary enthusiasts, and industry analysts",
      mission: `To produce meticulously researched, visually captivating documentaries on ${trimmed}.`,
      valueProposition: "High-retention storytelling backed by rigorous research and visual mastery.",
      personality: "Analytical, calm, authoritative, investigative",
      brandPositioning: `The premier documentary desk for ${trimmed}.`,
      brandPromise: "Uncompromising factual rigor, zero sensationalism, and cinematic production values.",
      imageTheme: "Cinematic 8K documentary, volumetric lighting, Unreal Engine 5 render, rim lighting",
      thumbnailTheme: "High-contrast bold focal typography, dramatic visual contrast, vibrant hook lighting",
      audioTheme: "Deep baritone narrator, subtle low-frequency drone (-18dB)",
      videos: 0,
      status: "Draft",
    };
    const updated = [...channels, newChannel];
    persistChannels(updated);
    setName("");
    setOpenComposer(false);
  }

  function handleConfirmDelete() {
    if (!channelToDelete) return;
    const updated = channels.filter((c) => c.slug !== channelToDelete.slug);
    persistChannels(updated);
    setChannelToDelete(null);
  }

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
            Your channels
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1">
            Manage your automated YouTube channels, story systems, and scheduled rendering desks.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-signal hover:bg-signal-hover active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer shrink-0"
          type="button"
          onClick={() => setOpenComposer(true)}
        >
          Create a channel <Plus size={16} />
        </button>
      </section>

      {/* Grid of Channels */}
      {channels.length === 0 ? (
        <section className="p-12 border border-line bg-paper-card text-center space-y-4 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-signal/10 text-signal flex items-center justify-center mx-auto">
            <Layers size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink">No channels found</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Get started by creating your first automated production channel and story system.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenComposer(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-signal hover:bg-signal-hover text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus size={15} /> Create a channel
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {channels.map((channel) => (
            <div
              key={channel.slug}
              className="group block p-5 border border-line bg-paper-card hover:border-signal/40 hover:shadow-md hover:shadow-signal/5 hover:-translate-y-0.5 transition-all relative"
            >
              <div className="flex items-start justify-between mb-4">
                <Link
                  href={`/dashboard/channels/${channel.slug}`}
                  className="w-10 h-10 bg-signal/10 text-signal font-bold text-xs font-mono flex items-center justify-center group-hover:bg-signal group-hover:text-white transition-colors cursor-pointer"
                >
                  {initials(channel.name)}
                </Link>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleCopyChannelJson(channel, e)}
                    className="p-1.5 rounded-md text-ink-muted/60 hover:text-signal hover:bg-signal/5 transition-colors cursor-pointer"
                    title={`Copy JSON for "${channel.name}"`}
                    aria-label={`Copy JSON for ${channel.name}`}
                  >
                    {copiedSlug === channel.slug ? (
                      <Check size={15} className="text-emerald-600" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <Link
                    href={`/dashboard/channels/${channel.slug}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md text-ink-muted/60 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                    title={`Edit channel "${channel.name}"`}
                    aria-label={`Edit channel ${channel.name}`}
                  >
                    <Edit3 size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setChannelToDelete(channel);
                    }}
                    className="p-1.5 rounded-md text-ink-muted/60 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title={`Delete channel "${channel.name}"`}
                    aria-label={`Delete channel ${channel.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                  <Link
                    href={`/dashboard/channels/${channel.slug}`}
                    className="p-1.5 text-ink-muted/50 group-hover:text-signal transition-colors cursor-pointer"
                    title="Open channel workspace"
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </div>

              <Link href={`/dashboard/channels/${channel.slug}`} className="block">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink group-hover:text-signal transition-colors">
                    {channel.name}
                  </h3>
                  {channel.handle && (
                    <span className="font-mono text-[11px] text-ink-muted/80">
                      {channel.handle}
                    </span>
                  )}
                </div>
                <p className="text-xs text-signal font-medium mt-0.5">
                  {channel.niche} {channel.subNiche ? `• ${channel.subNiche}` : ""}
                </p>
                <p className="text-xs text-ink-muted mt-2 mb-4 line-clamp-2 leading-relaxed">
                  {channel.tagline || channel.description || "Automated production engine desk."}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-line/60 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <Video size={13} /> {channel.videos} videos
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${getStatusBadge(
                      channel.status
                    )}`}
                  >
                    {channel.status}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* Delete Channel Confirmation Modal */}
      {channelToDelete && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 animate-card-rise"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChannelToDelete(null);
          }}
        >
          <div className="w-full max-w-md bg-paper-card p-6 sm:p-8 rounded-2xl border border-line shadow-2xl relative animate-modal-pop">
            <button
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              aria-label="Close"
              onClick={() => setChannelToDelete(null)}
            >
              <X size={18} />
            </button>

            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-200">
              <Trash2 size={20} />
            </div>

            <h2 id="delete-dialog-title" className="text-xl font-display font-semibold text-ink tracking-tight">
              Delete channel?
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
              Are you sure you want to delete <strong className="text-ink font-semibold">{channelToDelete.name}</strong>? This will remove the channel, its content pillars, and active video pipelines.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg border border-line text-xs font-semibold text-ink/70 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                onClick={() => setChannelToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} /> Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Composer Modal */}
      {openComposer && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 animate-card-rise"
          role="dialog"
          aria-modal="true"
          aria-labelledby="composer-title"
        >
          <form
            className="w-full max-w-md bg-paper-card p-6 sm:p-8 rounded-2xl border border-white/80 shadow-2xl relative animate-modal-pop"
            onSubmit={submitChannel}
          >
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-signal/10 text-signal font-mono text-[10px] font-semibold tracking-wider uppercase mb-3">
              <Sparkles size={13} /> NEW ENGINE DESK
            </div>

            <h2 id="composer-title" className="text-2xl font-display font-semibold text-ink tracking-tight">
              Create Channel
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 mb-6">
              Enter a name for your new automated channel to establish its workspace.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="channel-name">
                  Channel name *
                </label>
                <input
                  id="channel-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. The Quiet Ledger"
                  autoFocus
                  required
                  className="w-full h-11 px-3.5 rounded-lg border border-line-dark bg-white text-sm text-ink outline-none focus:border-signal focus:ring-3 focus:ring-signal/15 transition-all"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg border border-line text-xs font-semibold text-ink/70 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                onClick={() => {
                  setName("");
                  setOpenComposer(false);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
              >
                Create Channel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

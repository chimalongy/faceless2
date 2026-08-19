"use client";

import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Trash2,
  Tv,
  Sparkles,
  Sliders,
  Mic,
  Palette,
  Layers,
  Youtube,
  AlertTriangle,
  Radio,
  Check,
  Globe,
  AtSign,
  Target,
  Compass,
  Bookmark,
  Shield,
  HeartHandshake,
  MessageSquareQuote,
  Eye,
  Volume2,
  ImageIcon,
  Copy
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const STORAGE_KEY = "faceless_channels";

// Comprehensive fallback channel profiles
const defaultChannels = [
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

export default function EditChannelPage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.["channel-name"] || "the-quiet-ledger";
  const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [saved, setSaved] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [channels, setChannels] = useState([]);

  // Canonical Channel Fields
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState("");
  const [niche, setNiche] = useState("");
  const [subNiche, setSubNiche] = useState("");
  const [contentCategory, setContentCategory] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [mission, setMission] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [personality, setPersonality] = useState("");
  const [brandPositioning, setBrandPositioning] = useState("");
  const [brandPromise, setBrandPromise] = useState("");
  const [imageTheme, setImageTheme] = useState("");
  const [thumbnailTheme, setThumbnailTheme] = useState("");
  const [audioTheme, setAudioTheme] = useState("");

  // Supporting status
  const [status, setStatus] = useState("Active");

  // Load channel data on mount
  useEffect(() => {
    try {
      let storedList = [];
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        storedList = JSON.parse(raw);
      } else {
        storedList = defaultChannels;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultChannels));
      }
      setChannels(storedList);

      const found = storedList.find((c) => c.slug === channelSlug);
      if (found) {
        setName(found.name || "");
        setHandle(found.handle || `@${found.slug || channelSlug}`);
        setChannelUrl(found.channelUrl || `https://youtube.com/@${found.slug || channelSlug}`);
        setDescription(found.description || "");
        setTagline(found.tagline || "");
        setNiche(found.niche || "");
        setSubNiche(found.subNiche || "");
        setContentCategory(found.contentCategory || "Documentaries & Education");
        setTargetAudience(found.targetAudience || "");
        setMission(found.mission || "");
        setValueProposition(found.valueProposition || "");
        setPersonality(found.personality || "");
        setBrandPositioning(found.brandPositioning || "");
        setBrandPromise(found.brandPromise || "");
        setImageTheme(found.imageTheme || found.visualStyle || "8k cinematic documentary, volumetric rim lighting");
        setThumbnailTheme(found.thumbnailTheme || "Bold high-contrast typography, dramatic close-up focal point, vibrant key accents");
        setAudioTheme(found.audioTheme || found.voiceProfile || "Deep authoritative narration with low ambient drone");
        setStatus(found.status || "Active");
      } else {
        const formattedTitle = channelSlug
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ");
        setName(formattedTitle);
        setHandle(`@${channelSlug.replace(/[^a-z0-9]/g, "")}`);
        setChannelUrl(`https://youtube.com/@${channelSlug.replace(/[^a-z0-9]/g, "")}`);
        setNiche("Documentaries");
        setSubNiche("Investigative Stories");
        setContentCategory("Education & Entertainment");
        setDescription(`Automated narrative production engine for ${formattedTitle}.`);
        setTagline(`Exploring the fascinating depth of ${formattedTitle}.`);
        setTargetAudience("Inquisitive learners and documentary viewers");
        setMission(`To produce visually stunning, meticulously researched documentaries.`);
        setValueProposition("Unmatched visual fidelity and narrative depth.");
        setPersonality("Analytical, calm, objective, engaging");
        setBrandPositioning("The authoritative desk for in-depth topic breakdowns.");
        setBrandPromise("High-retention storytelling backed by rigorous research.");
        setImageTheme("Cinematic 8K documentary, volumetric lighting, Unreal Engine 5 render, rim lighting");
        setThumbnailTheme("Bold high-contrast typography, dramatic close-up focal point, vibrant key accents");
        setAudioTheme("Deep baritone narrator, subtle low-frequency ambience (-18dB)");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [channelSlug]);

  const [copiedJson, setCopiedJson] = useState(false);

  function handleCopyJson() {
    const nestedData = {
      channel: {
        name: name.trim() || channelSlug,
        slug: channelSlug,
        handle: handle.trim() || `@${channelSlug}`,
        channel_url: channelUrl.trim() || `https://youtube.com/@${channelSlug}`,
        tagline: tagline.trim(),
        description: description.trim(),
        status: status,
        videos: channels.find((c) => c.slug === channelSlug)?.videos || 0
      },
      niche_and_audience: {
        niche: niche.trim() || "Unassigned",
        sub_niche: subNiche.trim(),
        content_category: contentCategory.trim(),
        target_audience: targetAudience.trim()
      },
      brand_strategy: {
        mission: mission.trim(),
        value_proposition: valueProposition.trim(),
        personality: personality.trim(),
        brand_positioning: brandPositioning.trim(),
        brand_promise: brandPromise.trim()
      },
      creative_themes: {
        image_theme: imageTheme.trim(),
        thumbnail_theme: thumbnailTheme.trim(),
        audio_theme: audioTheme.trim()
      }
    };

    try {
      navigator.clipboard.writeText(JSON.stringify(nestedData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleSave(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const newSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || channelSlug;

    const updatedChannel = {
      name: trimmedName,
      slug: newSlug,
      handle: handle.trim() || `@${newSlug}`,
      channelUrl: channelUrl.trim() || `https://youtube.com/@${newSlug}`,
      description: description.trim(),
      tagline: tagline.trim(),
      niche: niche.trim() || "Unassigned",
      subNiche: subNiche.trim(),
      contentCategory: contentCategory.trim(),
      targetAudience: targetAudience.trim(),
      mission: mission.trim(),
      valueProposition: valueProposition.trim(),
      personality: personality.trim(),
      brandPositioning: brandPositioning.trim(),
      brandPromise: brandPromise.trim(),
      imageTheme: imageTheme.trim(),
      thumbnailTheme: thumbnailTheme.trim(),
      audioTheme: audioTheme.trim(),
      status,
      videos: channels.find((c) => c.slug === channelSlug)?.videos || 0,
    };

    let updatedList = [];
    const exists = channels.some((c) => c.slug === channelSlug);
    if (exists) {
      updatedList = channels.map((c) => (c.slug === channelSlug ? updatedChannel : c));
    } else {
      updatedList = [...channels, updatedChannel];
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      setChannels(updatedList);
    } catch {
      // Ignore
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      if (newSlug !== channelSlug) {
        router.push(`/dashboard/channels/${newSlug}`);
      }
    }, 1200);
  }

  function handleDeleteChannel() {
    try {
      const filtered = channels.filter((c) => c.slug !== channelSlug);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
    router.push("/dashboard");
  }

  return (
    <div className="space-y-8 max-w-4xl animate-card-rise pb-20">
      {/* Back Button & Top Header */}
      <div>
        <Link
          href={`/dashboard/channels/${channelSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to {name || "Channel Workspace"}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-signal/10 text-signal border border-signal/20">
                Channel Brand Architecture
              </span>
              <span className="text-xs font-mono text-ink-muted">/{channelSlug}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
              Edit Channel: {name || channelSlug}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Configure brand positioning, mission, persona, image styling, thumbnail themes, audio directives, and identity parameters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-line bg-paper-card text-ink hover:text-signal hover:border-signal/40 text-xs font-semibold transition-all cursor-pointer"
              title="Copy full nested JSON schema of channel brand architecture"
            >
              {copiedJson ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-700">Copied JSON!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              {saved ? <Check size={15} /> : <Save size={15} />}
              <span>{saved ? "Changes Saved" : "Save All Fields"}</span>
            </button>
          </div>
        </div>
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fade-in">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600" />
            Channel brand architecture & fields saved successfully!
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-emerald-700">Updated</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: CORE IDENTITY & SOCIALS */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Tv size={16} />
            </span>
            <span>1. Core Identity & Web Presence</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-channel-name">
                Channel Name *
              </label>
              <input
                id="field-channel-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Quiet Ledger"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-handle">
                Handle (@channelname) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-ink-muted text-xs">@</span>
                <input
                  id="field-handle"
                  type="text"
                  required
                  value={handle.startsWith("@") ? handle.slice(1) : handle}
                  onChange={(e) => setHandle(`@${e.target.value.replace(/^@/, "")}`)}
                  placeholder="thequietledger"
                  className="w-full h-10 pl-8 pr-3.5 border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-channel-url">
                Channel URL
              </label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-3 text-ink-muted" />
                <input
                  id="field-channel-url"
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  placeholder="https://youtube.com/@thequietledger"
                  className="w-full h-10 pl-9 pr-3.5 border border-line-dark bg-white text-xs font-mono text-ink outline-none focus:border-signal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-status">
                Engine Status
              </label>
              <select
                id="field-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal cursor-pointer"
              >
                <option value="Active">Active (Automated Production On)</option>
                <option value="Paused">Paused (Temporary Standby)</option>
                <option value="Draft">Draft (Incubation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-tagline">
              Channel Tagline
            </label>
            <input
              id="field-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Uncovering the silent mechanics of sovereign wealth and monetary history."
              className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-description">
              Channel Description
            </label>
            <textarea
              id="field-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed channel overview and 'About' bio for audience search indexing..."
              className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal"
            />
          </div>
        </section>

        {/* SECTION 2: NICHE & AUDIENCE CATEGORIZATION */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Compass size={16} />
            </span>
            <span>2. Niche, Sub-Niche & Audience Focus</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-niche">
                Niche *
              </label>
              <input
                id="field-niche"
                type="text"
                required
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Personal Finance"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-subniche">
                Sub-niche
              </label>
              <input
                id="field-subniche"
                type="text"
                value={subNiche}
                onChange={(e) => setSubNiche(e.target.value)}
                placeholder="e.g. Monetary History & Central Banking"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-content-category">
                Content Category
              </label>
              <input
                id="field-content-category"
                type="text"
                value={contentCategory}
                onChange={(e) => setContentCategory(e.target.value)}
                placeholder="e.g. Education & Documentaries"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-target-audience">
              Target Audience
            </label>
            <input
              id="field-target-audience"
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Macro investors, finance professionals, economic history enthusiasts, long-form documentary viewers"
              className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
            />
          </div>
        </section>

        {/* SECTION 3: BRAND STRATEGY & VALUE PROPOSITION */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Shield size={16} />
            </span>
            <span>3. Brand Strategy & Positioning Architecture</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-mission">
                Channel Mission
              </label>
              <textarea
                id="field-mission"
                rows={3}
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="e.g. To demystify complex macroeconomic phenomena through immersive historical storytelling..."
                className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-value-prop">
                Channel Value Proposition
              </label>
              <textarea
                id="field-value-prop"
                rows={3}
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                placeholder="e.g. Actionable macro-historical context without clickbait noise or surface-level speculation."
                className="w-full p-3 border border-line-dark bg-white text-xs text-ink leading-relaxed outline-none focus:border-signal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-personality">
                Channel Personality
              </label>
              <input
                id="field-personality"
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g. Analytical, calm, authoritative, investigative"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-brand-positioning">
                Brand Positioning
              </label>
              <input
                id="field-brand-positioning"
                type="text"
                value={brandPositioning}
                onChange={(e) => setBrandPositioning(e.target.value)}
                placeholder="e.g. The premier quiet intelligence desk for financial history"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/80 mb-1.5" htmlFor="field-brand-promise">
                Brand Promise
              </label>
              <input
                id="field-brand-promise"
                type="text"
                value={brandPromise}
                onChange={(e) => setBrandPromise(e.target.value)}
                placeholder="e.g. Rigorous historical accuracy and zero hyperbole"
                className="w-full h-10 px-3.5 border border-line-dark bg-white text-xs text-ink outline-none focus:border-signal"
              />
            </div>
          </div>
        </section>

        {/* SECTION 4: IMAGE_THEME, THUMBNAIL_THEME & AUDIO_THEME DIRECTIVES */}
        <section className="p-6 border border-line bg-paper-card space-y-5">
          <div className="flex items-center gap-2.5 text-ink font-semibold text-sm border-b border-line pb-3">
            <span className="p-1.5 bg-signal/10 text-signal">
              <Palette size={16} />
            </span>
            <span>4. Creative Themes & Studio Audio-Visual Directives</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-image-theme">
                <Eye size={13} className="text-signal" />
                <span>Image_Theme</span>
              </label>
              <span className="text-[10px] font-mono text-ink-muted uppercase">Scene Visual Aesthetics</span>
            </div>
            <textarea
              id="field-image-theme"
              rows={3}
              value={imageTheme}
              onChange={(e) => setImageTheme(e.target.value)}
              placeholder="e.g. Monochromatic dark slate, gold bullion accents, archival parchment textures, vintage banking ledgers, volumetric rim lighting, 8k cinematic macro documentary"
              className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Overarching visual style, lighting, texture, and aesthetic rules applied to all generated scene frames for this channel.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-thumbnail-theme">
                <ImageIcon size={13} className="text-signal" />
                <span>Thumbnail_Theme</span>
              </label>
              <span className="text-[10px] font-mono text-ink-muted uppercase">High-CTR Cover Directives</span>
            </div>
            <textarea
              id="field-thumbnail-theme"
              rows={3}
              value={thumbnailTheme}
              onChange={(e) => setThumbnailTheme(e.target.value)}
              placeholder="e.g. Bold golden typography, dramatic high-contrast ledger close-up with red financial crash charts, dark obsidian background, mysterious vault lighting"
              className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Thumbnail composition, focal contrast, typography styling, high-CTR color accents, and hook imagery rules.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink/80 flex items-center gap-1.5" htmlFor="field-audio-theme">
                <Volume2 size={13} className="text-signal" />
                <span>Audio_theme</span>
              </label>
              <span className="text-[10px] font-mono text-ink-muted uppercase">Voice & Acoustic Atmosphere</span>
            </div>
            <textarea
              id="field-audio-theme"
              rows={3}
              value={audioTheme}
              onChange={(e) => setAudioTheme(e.target.value)}
              placeholder="e.g. Deep baritone narrator, subtle low-frequency drone (-20dB), acoustic cello swells, vintage clockwork ticks"
              className="w-full p-3 border border-line-dark bg-white text-xs font-mono text-ink leading-relaxed outline-none focus:border-signal"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Voice actor directives, cadence, pacing, background ambience track, sound effects, and auditory master texture.
            </p>
          </div>
        </section>

        {/* SECTION 5: SAVE BAR & DANGER ZONE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-line">
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-line bg-paper-card text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trash2 size={14} /> Delete Channel
          </button>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Link
              href={`/dashboard/channels/${channelSlug}`}
              className="px-4 py-2.5 border border-line bg-paper-card text-xs font-semibold text-ink hover:bg-ink/5 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-signal hover:bg-signal-hover text-white text-xs font-semibold shadow-xs shadow-signal/20 transition-all cursor-pointer"
            >
              <Save size={15} /> Save Channel Profile
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-md bg-paper border border-line p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-in text-ink my-auto">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2 border border-rose-200">
              <Trash2 size={20} />
            </div>

            <div>
              <h3 className="text-xl font-display font-semibold text-ink tracking-tight">
                Delete {name || channelSlug}?
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                Are you sure you want to delete this channel? All associated content pillars, story topics, and settings will be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-line bg-paper-card text-xs font-medium text-ink hover:bg-ink/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteChannel}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-rose-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

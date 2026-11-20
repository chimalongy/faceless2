/**
 * High-CTR YouTube Thumbnail Archetypes & Architecture
 *
 * Designed specifically to maximize Click-Through Rate (CTR) and visual consistency
 * across AI image diffusion models (Qwen-Image, Nano Banana, Flux, SDXL).
 */

export const THUMBNAIL_ARCHETYPES = {
  documentary_noir: {
    id: "documentary_noir",
    name: "Documentary Noir",
    badge: "Magnates & James Jani Style",
    description: "Deep dark obsidian backdrop, 1/3 character silhouette on the right with intense rim lighting, and a high-contrast curiosity focal hook.",
    compositionFormula: "Rule of thirds. Primary subject occupying the right 35% of the frame with sharp rim light. Left 65% deep negative space with a single high-contrast curiosity element. Extreme chiaroscuro.",
    recommendedFor: "Finance breakdowns, investigative documentaries, corporate scandals, power dynamics.",
  },
  split_dilemma: {
    id: "split_dilemma",
    name: "The Split Dilemma",
    badge: "Contrast / The Fork",
    description: "50/50 vertical or diagonal division contrasting two polar realities (Poor vs Rich, 0% vs 29.9%, Decay vs Victory).",
    compositionFormula: "Vertical split division. Left side desaturated, cold or decaying; right side warm, hyper-vibrant, victorious. Sharp visual dividing line.",
    recommendedFor: "Comparisons, 'Why X Failed vs Why Y Won', before/after, strategic dilemmas.",
  },
  colossal_anomaly: {
    id: "colossal_anomaly",
    name: "The Colossal Monolith",
    badge: "Scale Disparity",
    description: "Tiny human silhouette standing before an impossibly massive vault, corporate monument, or looming financial institution.",
    compositionFormula: "Extreme scale disparity. Protagonist in lower third silhouetted against a towering, colossal monolith or monumental architectural structure with ambient fog.",
    recommendedFor: "Macroeconomics, global banking, systemic crises, deep-dive investigations.",
  },
  extreme_eye_contact: {
    id: "extreme_eye_contact",
    name: "The Editorial Gaze",
    badge: "High-Tension Focus",
    description: "Tight 85mm medium close-up, dramatic rim lighting, intense contemplative gaze directly into viewer's eyes with a single curious object.",
    compositionFormula: "Medium close-up portrait, shallow depth of field (f/1.8), direct piercing eye contact with the camera, holding or inspecting a mysterious focal artifact.",
    recommendedFor: "Personal psychology, cautionary tales, confessions, insider reveals.",
  },
  redacted_secret: {
    id: "redacted_secret",
    name: "The Classified Vault",
    badge: "Mystery & Intrigue",
    description: "High-value asset (vault, executive contract, gold bars) with an eye-grabbing graphic badge or warning stamp ('CLASSIFIED', '0%', 'WARNING').",
    compositionFormula: "Centered high-value asset in dramatic moody lighting, stamped with a bold high-contrast graphic badge or red seal creating an unresolved curiosity gap.",
    recommendedFor: "Hidden hacks, government/institutional secrets, loophole reveals.",
  },
};

export const THUMBNAIL_ACCENT_COLORS = {
  golden_amber: {
    id: "golden_amber",
    name: "Golden Amber",
    hex: "#F59E0B",
    label: "Wealth & Status",
    promptModifier: "vibrant glowing golden amber rim light, warm luxury highlights, radiant amber ambient glow",
  },
  crimson_alert: {
    id: "crimson_alert",
    name: "Crimson Alert",
    hex: "#EF4444",
    label: "Urgency & Crisis",
    promptModifier: "intense high-voltage crimson red rim light, dramatic emergency red backlight, sharp warnings",
  },
  toxic_emerald: {
    id: "toxic_emerald",
    name: "Toxic Emerald",
    hex: "#10B981",
    label: "Secret Fortune",
    promptModifier: "luminous neon emerald green backlight, sharp radiant highlights, rich jade reflections",
  },
  cyber_cyan: {
    id: "cyber_cyan",
    name: "Cyber Cyan",
    hex: "#06B6D4",
    label: "Tech & Disruption",
    promptModifier: "electric cyan edge lighting, crisp technological glow, cool futuristic highlights",
  },
  pure_white: {
    id: "pure_white",
    name: "Stark Monochrome",
    hex: "#FFFFFF",
    label: "Editorial Minimal",
    promptModifier: "pure stark white high-contrast rim lighting, clean monochromatic separation, crisp specular edges",
  },
};

export const DEFAULT_THUMBNAIL_CONFIG = Object.freeze({
  archetype: "documentary_noir",
  accentColor: "golden_amber",
  useMainCharacter: true,
  includeTextHook: false,
  customRules: "",
});

/**
 * Builds the modular 5-block prompt for modern diffusion models (Qwen-Image, Nano Banana, Flux).
 */
export function buildModularThumbnailPrompt({
  archetypeKey = "documentary_noir",
  accentColorKey = "golden_amber",
  character = null,
  topicTitle = "",
  imageTheme = null,
  customRules = "",
  concept = null,
  includeTextHook = false,
  textHook = "",
} = {}) {
  const archetype = THUMBNAIL_ARCHETYPES[archetypeKey] || THUMBNAIL_ARCHETYPES.documentary_noir;
  const accent = THUMBNAIL_ACCENT_COLORS[accentColorKey] || THUMBNAIL_ACCENT_COLORS.golden_amber;

  const subjectParts = [];
  if (character && (character.name || character.physicalSpec || character.physical_spec)) {
    const charName = character.name || "Protagonist";
    const charSpec = character.physicalSpec || character.physical_spec || "";
    const charSig = character.signatureFeature || character.signature_feature || "";
    const charWardrobe = character.wardrobe || "";
    subjectParts.push(`${charName} (${charSpec})`);
    if (charSig) subjectParts.push(`with ${charSig}`);
    if (charWardrobe) subjectParts.push(`wearing ${charWardrobe}`);
  } else {
    subjectParts.push("Central dramatic protagonist with intense, focused expression");
  }

  const hookText = concept?.focal_hook || `High-contrast curiosity hook representing "${topicTitle}"`;
  const resolvedTextHook = textHook || concept?.text_hook || "";
  const visualStyle = imageTheme?.visualStyle || (typeof imageTheme === "string" ? imageTheme : "Modern 2D clean illustration with crisp linework");

  return [
    `16:9 YouTube thumbnail in ${archetype.name} composition.`,
    `PRIMARY SUBJECT: ${subjectParts.join(", ")}. Positioned according to ${archetype.compositionFormula}.`,
    `LIGHTING & CONTRAST: ${accent.promptModifier}. Deep obsidian shadows, intense foreground-to-background contrast, 3D subject separation.`,
    `THE CURIOSITY HOOK: ${hookText}. Single clear focal anomaly designed for instant mobile comprehension.`,
    resolvedTextHook
      ? `TYPOGRAPHY & TEXT HOOK: Bold, punchy high-contrast typography reading "${resolvedTextHook}" positioned in negative space with strong drop shadow.`
      : !includeTextHook
      ? `Zero text overlays, zero typography, clean cinematic visual.`
      : "",
    `BACKGROUND: Deep dark obsidian negative space with subtle atmospheric depth and minimal cinematic fog. Zero visual clutter.`,
    `STYLE & RENDERING: ${visualStyle}. Clean uniform linework, mobile-optimized focal clarity, high-resolution rendering.`,
    customRules ? `ADDITIONAL RULES: ${customRules}` : "",
  ].filter(Boolean).join(" ");
}

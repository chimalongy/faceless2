import {
  THUMBNAIL_ARCHETYPES,
  THUMBNAIL_ACCENT_COLORS,
} from "../thumbnail-archetypes.js";

export const HIGH_CTR_THUMBNAIL_SYSTEM_PROMPT = `You are a world-class YouTube thumbnail creative director and AI image prompt engineer.
Your specialty is designing high-CTR (Click-Through Rate), visually stunning 16:9 thumbnails for top documentary, finance, and storytelling channels (inspired by MagnatesMedia, James Jani, Vox, and Johnny Harris).

## CORE MISSION
Generate exactly 3 DISTINCT, HIGH-CLICKABILITY thumbnail concepts for the video topic.
Each concept MUST represent a different psychological curiosity angle:
1. Concept 1 (The Character & Psychological Tension): Focuses on the primary character/protagonist confronting the central conflict or dilemma of the topic with intense, contemplative expression and dramatic lighting.
2. Concept 2 (The Visual Metaphor / Shock Value): Focuses on an impossible, colossal, or surreal physical symbol that immediately stops the viewer mid-scroll (e.g., a massive ticking debt clock, a collapsing gold vault, a puppet master silhouette).
3. Concept 3 (The Split Dilemma / The Fork): Focuses on a stark, high-contrast side-by-side comparison (Before vs After, 0% vs 29.9%, Decay vs Victory, Trap vs Freedom).

## CHANNEL SIGNATURE ARCHETYPE
Name: {archetype_name}
Formula: {archetype_formula}

## ACCENT COLOR & CONTRAST FORMULA
Color: {accent_color_name}
Lighting Rule: {accent_color_lighting}
Background Rule: 60% deep obsidian/dark negative space with subtle cinematic depth. Zero clutter. Subject and hook must have a 3D "pop" off the screen.

## CHANNEL CHARACTER (IF APPLICABLE)
{character_spec}

## CHANNEL ARTISTIC VISUAL IDENTITY
{channel_image_theme}

## TOPIC & NARRATIVE
Topic: "{topic}"
Context: {context_summary}

## TYPOGRAPHY & TEXT HOOK DIRECTIVE
{text_hook_guideline}

## ADDITIONAL CHANNEL RULES
{custom_rules}

## OUTPUT FORMAT SPECIFICATION
You MUST return ONLY a valid raw JSON array containing exactly 3 concept objects. Do NOT wrap in markdown fences, do NOT include conversational commentary, explanations, or thinking tags.

JSON Schema:
[
  {
    "id": 1,
    "angle": "Character Tension & Eye Contact",
    "title": "Short Punchy Concept Title",
    "text_hook": "Ultra-punchy 1-3 word text hook (e.g. 'THE TRAP', '0%', 'EXPOSED') or '' if pure visual",
    "focal_hook": "Specific 1-sentence description of the central anomaly or curiosity hook",
    "prompt": "Full 16:9 prompt formatted with [16:9 YOUTUBE THUMBNAIL] followed by PRIMARY SUBJECT, LIGHTING & CONTRAST, THE CURIOSITY HOOK, BACKGROUND, and STYLE & RENDERING."
  },
  {
    "id": 2,
    "angle": "The Visual Metaphor / Shock Value",
    "title": "Short Punchy Concept Title",
    "text_hook": "Ultra-punchy 1-3 word text hook (e.g. 'THE TRAP', '0%', 'EXPOSED') or '' if pure visual",
    "focal_hook": "Specific 1-sentence description of the central anomaly or curiosity hook",
    "prompt": "Full 16:9 prompt formatted with [16:9 YOUTUBE THUMBNAIL] followed by PRIMARY SUBJECT, LIGHTING & CONTRAST, THE CURIOSITY HOOK, BACKGROUND, and STYLE & RENDERING."
  },
  {
    "id": 3,
    "angle": "The Split Dilemma / The Fork",
    "title": "Short Punchy Concept Title",
    "text_hook": "Ultra-punchy 1-3 word text hook (e.g. 'THE TRAP', '0%', 'EXPOSED') or '' if pure visual",
    "focal_hook": "Specific 1-sentence description of the central anomaly or curiosity hook",
    "prompt": "Full 16:9 prompt formatted with [16:9 YOUTUBE THUMBNAIL] followed by PRIMARY SUBJECT, LIGHTING & CONTRAST, THE CURIOSITY HOOK, BACKGROUND, and STYLE & RENDERING."
  }
]`;

export function getThumbnailPromptGeneration({
  channelImageGenerationTheme = "",
  channelThumbnailGenerationTheme = "",
  topic = "",
  storyDescription = "",
  scriptContent = "",
  archetypeKey = "documentary_noir",
  accentColorKey = "golden_amber",
  character = null,
  includeTextHook = false,
  customRules = "",
  promptTemplate = null,
} = {}) {
  const effectiveTopic = (topic || "").trim();
  if (!effectiveTopic) {
    throw new Error("Cannot generate thumbnail prompt: Topic Title is required.");
  }

  const archetype = THUMBNAIL_ARCHETYPES[archetypeKey] || THUMBNAIL_ARCHETYPES.documentary_noir;
  const accent = THUMBNAIL_ACCENT_COLORS[accentColorKey] || THUMBNAIL_ACCENT_COLORS.golden_amber;

  let characterSpec = "No recurring character specified. Feature a compelling anonymous protagonist appropriate to the topic.";
  if (character && (character.name || character.physicalSpec || character.physical_spec)) {
    const name = character.name || "Protagonist";
    const spec = character.physicalSpec || character.physical_spec || "";
    const signature = character.signatureFeature || character.signature_feature || "";
    const wardrobe = character.wardrobe || "";
    characterSpec = `Featured Character: ${name}. Physical Spec: ${spec}. Signature Feature: ${signature}. Wardrobe: ${wardrobe}. Ensure this exact character identity is maintained.`;
  }

  const effectiveImageTheme = (channelImageGenerationTheme || "Modern 2D clean illustration with crisp linework, deep chiaroscuro, cinematic atmospheric lighting").trim();
  const effectiveCustomRules = (customRules || channelThumbnailGenerationTheme || "").trim() || "Design for mobile readability. Maximum 3 visual elements. High subject-to-background separation.";

  const textHookGuideline = includeTextHook
    ? "Include a bold, punchy 1-3 word text hook (e.g. 'THE TRAP', '0%', 'EXPOSED') formatted in quotation marks inside the prompt in clean negative space with high-contrast typography and deep shadow."
    : "Design for pure visual storytelling with zero text overlays or typography inside the image.";

  const contextSnippet = (storyDescription || (scriptContent ? scriptContent.slice(0, 500) : "") || "Engaging documentary breakdown of the topic.").trim();

  const basePrompt = typeof promptTemplate === "string" && promptTemplate.trim().length > 0
    ? promptTemplate
    : HIGH_CTR_THUMBNAIL_SYSTEM_PROMPT;

  return basePrompt
    .replaceAll("{archetype_name}", archetype.name)
    .replaceAll("{archetype_formula}", archetype.compositionFormula)
    .replaceAll("{accent_color_name}", accent.name)
    .replaceAll("{accent_color_lighting}", accent.promptModifier)
    .replaceAll("{character_spec}", characterSpec)
    .replaceAll("{channel_image_theme}", effectiveImageTheme)
    .replaceAll("{channel_image_generation_theme}", effectiveImageTheme)
    .replaceAll("{channel_thumbnail_generation_theme}", effectiveCustomRules)
    .replaceAll("{text_hook_guideline}", textHookGuideline)
    .replaceAll("{topic}", effectiveTopic)
    .replaceAll("{context_summary}", contextSnippet)
    .replaceAll("{custom_rules}", effectiveCustomRules);
}

// Backwards compatibility alias
export const THUMBNAIL_PROMPT_SYSTEM_PROMPT = HIGH_CTR_THUMBNAIL_SYSTEM_PROMPT;

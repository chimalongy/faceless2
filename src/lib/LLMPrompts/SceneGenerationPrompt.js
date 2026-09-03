export const SCENE_GENERATION_SYSTEM_PROMPT = `You are an expert cinematic storyboard director and AI image prompt engineer a faceless youtube channel named {CHANNEL_NAME}.

Your job is to transform the provided SCRIPT into a chronological sequence of scenes for the faceless YouTube video. Each static image is displayed on screen while its scene's \`audio_text\` is spoken.

## CHANNEL & STYLE
Channel: {CHANNEL_NAME} ({CHANNEL_NICHE})
Description: {CHANNEL_DESCRIPTION}
Mission: {CHANNEL_MISSION}
Image Theme: {CHANNEL_IMAGE_THEME}
Every image must strictly follow this visual universe (style, realism, lighting, cinematography, color grading).

## CONTENT PILLAR
Pillar: {CONTENT_PILLAR_NAME} ({CONTENT_PILLAR_CATEGORY_TAG})
Tone: {CONTENT_PILLAR_TONE}
Description: {CONTENT_PILLAR_DESCRIPTION}
Use the pillar and tone as the strategic visual lens for mood and thematic emphasis.

## MAIN CHARACTER
Enabled: {USE_MAIN_CHARACTER}
Description: {MAIN_CHARACTER_DESCRIPTION}
If enabled, keep character appearance (face, hair, age, clothing) consistent across all appearances. If disabled, do not introduce a recurring character.

## SCRIPT
{ACTIVE_SCRIPT}

## RULES
1. AUDIO TEXT (EXACT PRESERVATION):
   Divide the script into logical scenes (roughly 1–3 short sentences per scene).
   \`audio_text\` must contain the exact, verbatim narration for that scene without any rewriting, omission, or duplication. All script words must be accounted for once in exact sequence.

2. IMAGE PROMPTS:
   Each \`image_prompt\` must be a concise, vivid cinematic prompt that visualizes the spoken words.
   Include subject, action/expression, environment, camera angle/framing, and lighting matching the Image Theme.
   Do not include text, subtitles, captions, headlines, or watermarks.

3. TRANSITIONS:
   Choose from: \`fade\` (default), \`crossfade\`, \`fade-to-black\`, \`fade-to-white\`, \`fade-in\`, \`fade-out\`, or \`cut\` (use \`cut\` when the next scene directly continues the current thought).

4. KEN BURNS:
   Choose one motion direction: \`zoom-in\`, \`zoom-out\`, \`pan-left\`, \`pan-right\`, \`pan-up\`, or \`pan-down\`.

## OUTPUT FORMAT
Return ONLY a valid raw JSON array. Start directly with [ and end with ]. No markdown fences, no explanation.

[
  {
    "scene_number": 1,
    "audio_text": "Exact verbatim narration from script...",
    "image_prompt": "Cinematic visual prompt...",
    "transition": "fade",
    "ken_burns": {
      "direction": "zoom-in"
    }
  }
]`;

export function getSceneGenerationPrompt({
  channelName,
  channelNiche,
  channelSubNiche,
  channelDescription,
  channelMission,
  channelImageTheme,
  visualTheme,
  contentPillarName,
  contentPillarCategoryTag,
  contentPillarTone,
  contentPillarDescription,
  useMainCharacter = false,
  mainCharacterDescription,
  activeScript,
} = {}) {
  const missingFields = [];

  const effectiveChannelName = (channelName || "").trim();
  const effectiveNiche = (channelNiche || channelSubNiche || "").trim();
  const effectiveDescription = (channelDescription || "").trim();
  const effectiveMission = (channelMission || "").trim();
  const effectiveImageTheme = (visualTheme || channelImageTheme || "").trim();
  const effectivePillarName = (contentPillarName || "").trim();
  const effectivePillarTag = (contentPillarCategoryTag || "").trim();
  const effectivePillarTone = (contentPillarTone || "").trim();
  const effectivePillarDescription = (contentPillarDescription || "").trim();
  const effectiveScript = (activeScript || "").trim();

  if (!effectiveChannelName) missingFields.push("Channel Name");
  if (!effectiveNiche) missingFields.push("Channel Niche");
  if (!effectiveDescription) missingFields.push("Channel Description");
  if (!effectiveMission) missingFields.push("Channel Mission");
  if (!effectiveImageTheme) missingFields.push("Channel Image Theme");
  if (!effectivePillarName) missingFields.push("Content Pillar Name");
  if (!effectivePillarTag) missingFields.push("Content Pillar Tag");
  if (!effectivePillarTone) missingFields.push("Content Pillar Tone");
  if (!effectivePillarDescription) missingFields.push("Content Pillar Description");
  if (!effectiveScript) missingFields.push("Script Narration");
  if (useMainCharacter && !(mainCharacterDescription || "").trim()) {
    missingFields.push("Main Character Description (Main Character is enabled)");
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Cannot generate scenes. The following required field(s) are missing: ${missingFields.join(", ")}.`
    );
  }

  const resolvedMainCharDesc =
    useMainCharacter && (mainCharacterDescription || "").trim()
      ? mainCharacterDescription.trim()
      : "None";

  return SCENE_GENERATION_SYSTEM_PROMPT.replaceAll("{CHANNEL_NAME}", effectiveChannelName)
    .replaceAll("{CHANNEL_NICHE}", effectiveNiche)
    .replaceAll("{CHANNEL_DESCRIPTION}", effectiveDescription)
    .replaceAll("{CHANNEL_MISSION}", effectiveMission)
    .replaceAll("{CHANNEL_IMAGE_THEME}", effectiveImageTheme)
    .replaceAll("{CONTENT_PILLAR_NAME}", effectivePillarName)
    .replaceAll("{CONTENT_PILLAR_CATEGORY_TAG}", effectivePillarTag)
    .replaceAll("{CONTENT_PILLAR_TONE}", effectivePillarTone)
    .replaceAll("{CONTENT_PILLAR_DESCRIPTION}", effectivePillarDescription)
    .replaceAll("{USE_MAIN_CHARACTER}", useMainCharacter ? "Yes" : "No")
    .replaceAll("{MAIN_CHARACTER_DESCRIPTION}", resolvedMainCharDesc)
    .replaceAll("{ACTIVE_SCRIPT}", effectiveScript);
}

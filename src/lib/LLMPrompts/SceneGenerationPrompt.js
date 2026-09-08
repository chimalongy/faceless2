export const SCENE_GENERATION_SYSTEM_PROMPT = `You are an expert storyboard director and AI image prompt engineer for a faceless YouTube channel named {CHANNEL_NAME}.

Your job is to transform the provided SCRIPT into a chronological sequence of scenes for the faceless YouTube video. Each static image is displayed on screen while its scene's \`audio_text\` is spoken.

## CHANNEL & STYLE
Channel: {CHANNEL_NAME} ({CHANNEL_NICHE})
Description: {CHANNEL_DESCRIPTION}
Mission: {CHANNEL_MISSION}
Image Theme: {CHANNEL_IMAGE_THEME}
Every image must strictly follow this visual universe (style, realism, lighting, framing, color grading).

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

Break the script into as many scenes as naturally fit — do not force a fixed number.
Each scene should cover ONE coherent visual moment or narrative beat from the script.
Determine the number of images required to visualize each scene.
Distribute screen time intentionally: high-tension or emotionally heavy moments get more images and longer durations.
Images must align with the content/context of the voice text (what is being spoken in the scene).

Each scene must have:

1. AUDIO TEXT (EXACT PRESERVATION):
   \`audio_text\` must contain the exact, verbatim narration for that scene without any rewriting, omission, or duplication. All script words must be accounted for once, in exact sequence.

2. NUMBER OF IMAGES (number_of_images):
   The total count of images for this scene, matching the length of the \`images\` array.

3. IMAGE PROMPTS:
   Each \`image_prompt\` must be a concise, vivid image prompt that visualizes the spoken words.
   Include subject, action/expression, environment, camera angle/framing, and lighting matching the Image Theme.
   Do not include text, subtitles, captions, headlines, or watermarks.

4. TRANSITIONS (for each scene):
   Choose from: \`fade\` (default), \`crossfade\`, \`fade-to-black\`, \`fade-to-white\`, \`fade-in\`, \`fade-out\`, or \`cut\` (use \`cut\` when the next scene directly continues the current thought).

5. KEN BURNS:
   Choose one motion direction: \`zoom-in\`, \`zoom-out\`, \`pan-left\`, \`pan-right\`, \`pan-up\`, or \`pan-down\`.

## OUTPUT FORMAT
Return ONLY a valid raw JSON array. Start directly with [ and end with ]. No markdown fences, no comments, no trailing commas, no explanation — the output must pass a strict JSON parser as-is.

[
  {
    "scene_number": 1,
    "audio_text": "Exact verbatim narration from script...",
    "number_of_images": 2,
    "images": [
      {
        "image_number": 1,
        "image_prompt": "Visual prompt matching the scene..."
      },
      {
        "image_number": 2,
        "image_prompt": "Visual prompt matching the scene..."
      }
    ],
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
  if (!effectivePillarDescription)
    missingFields.push("Content Pillar Description");
  if (!effectiveScript) missingFields.push("Script Narration");
  if (useMainCharacter && !(mainCharacterDescription || "").trim()) {
    missingFields.push(
      "Main Character Description (Main Character is enabled)",
    );
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Cannot generate scenes. The following required field(s) are missing: ${missingFields.join(", ")}.`,
    );
  }

  const resolvedMainCharDesc =
    useMainCharacter && (mainCharacterDescription || "").trim()
      ? mainCharacterDescription.trim()
      : "None";

  const placeholderMap = {
    "{CHANNEL_NAME}": effectiveChannelName,
    "{CHANNEL_NICHE}": effectiveNiche,
    "{CHANNEL_DESCRIPTION}": effectiveDescription,
    "{CHANNEL_MISSION}": effectiveMission,
    "{CHANNEL_IMAGE_THEME}": effectiveImageTheme,
    "{CONTENT_PILLAR_NAME}": effectivePillarName,
    "{CONTENT_PILLAR_CATEGORY_TAG}": effectivePillarTag,
    "{CONTENT_PILLAR_TONE}": effectivePillarTone,
    "{CONTENT_PILLAR_DESCRIPTION}": effectivePillarDescription,
    "{USE_MAIN_CHARACTER}": useMainCharacter ? "Yes" : "No",
    "{MAIN_CHARACTER_DESCRIPTION}": resolvedMainCharDesc,
    "{ACTIVE_SCRIPT}": effectiveScript,
  };

  // Use split/join (not replaceAll(str, str)) so values containing "$&", "$$",
  // "$`", "$'" — e.g. a script mentioning a dollar amount — are inserted
  // literally instead of being interpreted as special replacement patterns.
  let prompt = SCENE_GENERATION_SYSTEM_PROMPT;
  for (const [placeholder, value] of Object.entries(placeholderMap)) {
    prompt = prompt.split(placeholder).join(value);
  }

  return prompt;
}

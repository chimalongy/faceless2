import { formatScriptStructureForPrompt } from "../defaultScriptStructure.js";

export const SHORT_SCRIPT_GENERATION_SYSTEM_PROMPT = `You are an elite YouTube scriptwriter and audience retention director specialized in high-retention vertical short-form videos (YouTube Shorts, TikTok, Reels).

Your task is to write a high-retention, deeply engaging short-form narration based on the provided TOPIC, CHANNEL, CONTENT PILLAR, and the CHANNEL'S SCRIPT STRUCTURE DIRECTIVES.

## CHANNEL
Name: {channel_name}
Niche: {channel_niche} ({channel_sub_niche})
Description: {channel_description}
Mission: {channel_mission}

Make the script native to this channel's authority, visual universe, and target audience.

## CONTENT PILLAR
Pillar: {content_pillar_name} ({content_pillar_category_tag})
Tone: {content_pillar_tone}
Target Length: {content_pillar_length}
Target Word Count: {content_pillar_words_count}
Description: {content_pillar_description}

Use this pillar as the strategic narrative lens. Its Tone ("{content_pillar_tone}") is the authoritative, singular tone directive that dictates the voice, intellectual depth, emotional stakes, and pacing of the narration. Do not mention the pillar's name in the narration.

## TOPIC
{topic}

Build the entire script around this specific topic. Do not alter the title or discuss it as a title. Deliver on its core promise with uncompromising depth.

---

## CHANNEL SCRIPT STRUCTURE & CONTENT BLUEPRINT
You MUST strictly follow this channel's content structure and delivery blueprint below to design and pace the script. It is the authoritative blueprint for your hook formula, content flow, pacing rules, retention techniques, and prohibited words (executed entirely within the Content Pillar Tone):

{channel_script_structure_block}

Also, remember that the content_pillar_tone superceeds the channel script structure tone. You should only use the channel script structure tone if and only if the content pillar tone is not available.

---

## TARGET LENGTH & WORD COUNT
You MUST write a complete short-form narration matching the target:
- Target: {content_pillar_words_count} ({content_pillar_length})
- Every single word must fight for its place. Strip all fluff and filler words.
- Do NOT abbreviate, truncate, or leave placeholders like "[continue explaining here]". Deliver the full, comprehensive narration from beginning to end.

## OUTPUT FORMAT
Return ONLY the raw spoken narration text.
- Do NOT include title suggestions, intro labels ("Narrator:", "SCRIPT:"), stage directions, visual cues, scene numbers, or markdown code fences.
- Do NOT include <think>, <thought>, or reasoning tags.
- Begin immediately with the very first spoken word of the hook and end with the final spoken word.`;

export function getShortScriptGenerationSystemPrompt({
  channelName,
  channelNiche,
  channelSubNiche,
  channelDescription,
  channelMission,
  contentPillarName,
  contentPillarCategoryTag,
  contentPillarTone,
  contentPillarLength,
  contentLength,
  content_length,
  contentPillarWordsCount,
  contentWordsCount,
  content_words_count,
  wordsCount,
  wordCount,
  contentPillarDescription,
  topic,
  scriptStructure,
  script_structure,
  channelScriptStructure,
} = {}) {
  const missingFields = [];

  const effectiveChannelName = (channelName || "").trim();
  const effectiveNiche = (channelNiche || channelSubNiche || "").trim();
  const effectiveDescription = (channelDescription || "").trim();
  const effectiveMission = (channelMission || "").trim();
  const effectivePillarName = (contentPillarName || "").trim();
  const effectivePillarTag = (contentPillarCategoryTag || "").trim();
  const effectivePillarTone = (
    contentPillarTone || "Punchy, engaging, authoritative"
  ).trim();
  const effectivePillarDesc = (contentPillarDescription || "").trim();
  const effectiveTopic = (topic || "").trim();

  const resolvedLength = (
    contentLength ||
    content_length ||
    contentPillarLength ||
    "35–50 seconds"
  ).trim();

  const resolvedWordsCount = (
    contentWordsCount ||
    content_words_count ||
    wordsCount ||
    wordCount ||
    contentPillarWordsCount ||
    "250-300 words"
  ).trim();

  if (!effectiveChannelName) missingFields.push("Channel Name");
  if (!effectiveNiche) missingFields.push("Channel Niche");
  if (!effectiveDescription) missingFields.push("Channel Description");
  if (!effectiveMission) missingFields.push("Channel Mission");
  if (!effectivePillarName) missingFields.push("Content Pillar Name");
  if (!effectivePillarTag) missingFields.push("Content Pillar Tag");
  if (!effectiveTopic) missingFields.push("Topic Title");

  if (missingFields.length > 0) {
    throw new Error(
      `Cannot generate short script. The following required field(s) are missing: ${missingFields.join(", ")}.`,
    );
  }

  const effectiveStructure =
    scriptStructure || script_structure || channelScriptStructure;
  const formattedStructureBlock =
    formatScriptStructureForPrompt(effectiveStructure, { includeTone: true });

  const placeholderMap = {
    "{channel_name}": effectiveChannelName,
    "{channel_niche}": effectiveNiche,
    "{channel_sub_niche}": (channelSubNiche || "").trim(),
    "{channel_description}": effectiveDescription,
    "{channel_mission}": effectiveMission,
    "{content_pillar_name}": effectivePillarName,
    "{content_pillar_category_tag}": effectivePillarTag,
    "{content_pillar_tone}": effectivePillarTone,
    "{content_pillar_length}": resolvedLength,
    "{content_pillar_words_count}": resolvedWordsCount,
    "{content_pillar_description}": effectivePillarDesc,
    "{topic}": effectiveTopic,
    "{channel_script_structure_block}": formattedStructureBlock,
  };

  let prompt = SHORT_SCRIPT_GENERATION_SYSTEM_PROMPT;
  for (const [placeholder, value] of Object.entries(placeholderMap)) {
    prompt = prompt.split(placeholder).join(value);
  }

  return prompt;
}

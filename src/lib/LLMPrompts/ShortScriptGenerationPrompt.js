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

Use this pillar as the strategic narrative lens. It dictates the intellectual depth, emotional stakes, pacing, and angle of insight. Do not mention the pillar's name in the narration.

## TOPIC
{topic}

Build the entire script around this specific topic. Do not alter the title or discuss it as a title. Deliver on its core promise with uncompromising depth.

---

## CHANNEL SCRIPT STRUCTURE & CONTENT BLUEPRINT
You MUST strictly follow this channel's content structure and delivery blueprint below. It guides the content flow, hook formula, pacing rules, and prohibited words:

{channel_script_structure_block}

---

## CRITICAL RETENTION & PACING RULES

### 1. THE 0–3 SECOND ULTRA-HOOK (MANDATORY)
Viewers swipe away within 1.5 seconds if you hesitate.
- **LINE 1 MUST HIT LIKE LIGHTNING**: Start with a startling fact, question or a bold statement.
- **ZERO THROAT-CLEARING**:
  - NEVER open with greetings ("Hey guys", "In this video",  "Today we explore").
  - NEVER open with poetic scene-setting ("Pour a cup...", "Imagine...").
  - NEVER open with dictionary definitions or academic hedging.
  - Plunge the viewer straight into the action, high-stakes paradox, or mechanism.

### 2. SCRIPT FOR THE EAR, NOT A MAGAZINE ESSAY
This is spoken narration for an engaging, fast-paced vertical video.
- Short, punchy sentences with rapid information density.
- Direct second-person address ("you", "your", "watch what happens").
- Speak with authoritative clarity and strip out passive academic hedging.

### 3. CURIOSITY LOOPS & ESCALATING STAKES
Do not dump information as a flat list of facts. Structure the narration with escalating tension:
- Expose the common myth or everyday assumption.
- Dive immediately into the microscopic or behind-the-scenes mechanical truth.
- Introduce the unexpected risk, hidden danger, or counterintuitive twist.

### 4. VISCERAL, CLEAR MECHANISMS
When explaining complex science, finance, or systems:
- Make the invisible visible. Explain the step-by-step chain reaction inside the body or system clearly.
- Use crisp, memorable analogies that make technical mechanisms instantly click.

### 5. ACCURACY & INTELLECTUAL INTEGRITY
- Ground all claims in real facts.
- Do not fabricate clinical trials, statistics, or quotes.

### 6. THE SEAMLESS RETENTION LOOP & PROFOUND ENDING
Conclude with impact:
- Deliver a mind-bending revelation or perspective shift that reframes how the viewer sees their world, OR
- Seamlessly loop the final thought back into the opening hook so the Short can replay continuously on YouTube without a jarring break.

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
    "300-350 words"
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
    formatScriptStructureForPrompt(effectiveStructure);

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

export const SCRIPT_GENERATION_SYSTEM_PROMPT = `You are an expert YouTube strategist, researcher, storyteller, and long-form scriptwriter.

Generate a highly engaging, insightful, emotionally resonant, retention-focused narration based on the provided topic.

## CHANNEL

Name: {channel_name}
Niche: {channel_niche}
Sub-niche: {channel_sub_niche}
Description: {channel_description}
Mission: {channel_mission}

Make the script feel native to this channel, its audience, niche, mission, and identity. Avoid generic content.

## CONTENT PILLAR

Name: {content_pillar_name}
Tag: {content_pillar_category_tag}
Tone: {content_pillar_tone}
Length: {content_pillar_length}
Word count: {content_pillar_words_count}
Description: {content_pillar_description}

Use the pillar as the strategic lens for the topic. Let it determine the angle, themes, depth, tone, and type of insight. Do not mention the pillar in the script.

## TOPIC

{topic}

The topic is fixed. Do not create, modify, evaluate, or discuss the title. Build the entire narration around its promise or question.

## WRITING

Create a coherent intellectual and emotional journey rather than a list of facts.

Prioritize:
- A strong, immediate introductory hook.
- Curiosity and meaningful questions.
- Progressive discovery and escalating insight.
- Clear explanations of relevant mechanisms.
- Relatable examples and human experiences.
- Surprising connections, tensions, contradictions, or paradoxes when natural.
- Smooth transitions and narrative momentum.
- A deeper realization or perspective by the conclusion.

Move naturally from familiar experience → tension/question → deeper explanation → insight/revelation → broader meaning.

Do not force this structure when another structure better serves the topic.

Write with an intelligent, calm, natural, conversational voice. Be deep without being pretentious, emotional without melodrama, and engaging without clickbait.

Avoid filler, repetition, generic motivational language, clichés, excessive jargon, and mechanical transitions.

## ACCURACY

Be intellectually responsible. Do not invent studies, statistics, researchers, theories, quotes, experiments, historical events, or sources.

Distinguish established facts from uncertainty, speculation, or interpretation.

Do not diagnose viewers or present general information as personalized professional advice.

## ORIGINALITY

Create an original script specifically for this channel, pillar, and topic. Do not imitate, copy, paraphrase, or reproduce another creator's script or distinctive wording.

## CONCLUSION

End with a meaningful realization, perspective, or question that makes the viewer see the subject differently. Make the ending feel earned rather than simply summarizing the script.

## OUTPUT

Return ONLY the finished narration.

Do not output:
- reasoning
- analysis
- planning
- outlines
- notes
- metadata
- commentary
- title suggestions
- alternative versions
- visual descriptions
- image prompts
- scene directions
- editing instructions
- production notes
- XML/JSON
- markdown code fences
- "SCRIPT:" or other labels
- <thought>, <thinking>, <analysis>, or similar tags

Begin directly with the first sentence of the narration and end with the final sentence.

All channel, pillar, topic, and strategic information above is generation context only. Never expose it as meta-commentary in the response.`;

export function getScriptGenerationSystemPrompt({
  channelName = "YouTube Channel",
  channelNiche = "General",
  channelSubNiche = "General",
  channelDescription = "Educational and narrative documentaries.",
  channelMission = "Deliver high-value visual stories.",
  contentPillarName = "General Content",
  contentPillarCategoryTag = "Documentary",
  contentPillarTone = "Calm, analytical, insightful",
  contentPillarLength = "15-20 minutes (~2500 words)",
  contentLength = null,
  content_length = null,
  contentPillarWordsCount = "2,500 - 3,500 words",
  contentWordsCount = null,
  content_words_count = null,
  wordsCount = null,
  wordCount = null,
  contentPillarDescription = "In-depth strategic insights and engaging narrative storytelling.",
  topic = "",
}) {
  const resolvedLength =
    contentLength ||
    content_length ||
    contentPillarLength ||
    "15-20 minutes (~2500 words)";
  const resolvedWordsCount =
    contentWordsCount ||
    content_words_count ||
    wordsCount ||
    wordCount ||
    contentPillarWordsCount ||
    "2,500 - 3,500 words";

  let prompt = SCRIPT_GENERATION_SYSTEM_PROMPT.replaceAll(
    "{channel_name}",
    channelName || "YouTube Channel",
  )
    .replaceAll("{channel_niche}", channelNiche || "General")
    .replaceAll(
      "{channel_sub_niche}",
      channelSubNiche || channelNiche || "General",
    )
    .replaceAll(
      "{channel_description}",
      channelDescription || "Educational and narrative documentaries.",
    )
    .replaceAll(
      "{channel_mission}",
      channelMission || "Deliver high-value visual stories.",
    )
    .replaceAll("{content_pillar_name}", contentPillarName || "General Content")
    .replaceAll(
      "{content_pillar_category_tag}",
      contentPillarCategoryTag || "Documentary",
    )
    .replaceAll(
      "{content_pillar_tone}",
      contentPillarTone || "Calm, analytical, insightful",
    )
    .replaceAll("{content_pillar_length}", resolvedLength)
    .replaceAll("{content_pillar_words_count}", resolvedWordsCount)
    .replaceAll(
      "{content_pillar_description}",
      contentPillarDescription ||
        "In-depth strategic insights and engaging narrative storytelling.",
    )
    .replaceAll("{topic}", topic || "Topic Title");

  return prompt;
}

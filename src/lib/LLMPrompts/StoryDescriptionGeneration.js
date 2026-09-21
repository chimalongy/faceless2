export const STORY_DESCRIPTION_SYSTEM_PROMPT = `You are an expert YouTube SEO copywriter.
Your task is to write a compelling, SEO-optimized YouTube VIDEO DESCRIPTION (150–250 words) for an already-completed video using its title, script, and channel context.

## RULES
1. Write a promotional video description, NOT a story, script, or narrative retelling. Do not summarize the plot chronologically or spoil the conclusion.
2. Ground all points strictly in the provided script and topic. Do not hallucinate facts, clinical claims, or timestamps.
3. No timestamps or chapter markers unless explicitly supplied.
4. Return ONLY the final description text ready to paste directly into YouTube (no intro, markdown meta-labels, or commentary).

## SEO RULES
- Place the video's primary search term / core topic entity verbatim or near-verbatim in the first line of the hook.
- Put the highest-value terms in the first 2 lines — that's what Google indexes and what viewers see before expanding ("Show more").
- Include one natural question-shaped phrase (e.g., "Why does…?", "How do…?") in the hook or overview, written like a real search query.
- Secondary keywords may appear naturally later in the body. Never repeat any keyword more than 3 times (zero keyword stuffing).
- Use exactly 3 relevant, specific hashtags at the very bottom.

## DESCRIPTION FORMAT
1. **Hook (2-3 sentences)**: Immediately state the core question or intriguing premise of the video to hook the viewer and include primary search terms in the first 2 lines.
2. **Overview (1-2 short paragraphs)**: Explain what the video explores and the key concepts/mechanisms it uncovers.
3. **What You'll Discover (3-4 bullet points)**: Highlight the most fascinating insights or takeaways (e.g. 🔍, 💡, 🧠, ⚡).
4. **Engagement CTA**: 1 thought-provoking discussion question for the comments, followed by a concise subscribe call-to-action.
5. **Hashtags**: Exactly 3 relevant, specific hashtags at the bottom.`;

export function getStoryDescriptionPrompt({
  topicTitle = "",
  scriptContent = "",
  channelName = "",
  channelNiche = "",
  channelTags = "",
  channelDescription = "",
  channelPersonality = "",
  channelTargetAudience = "",
  pillarName = "",
  pillarTone = "",
}) {
  const userContent = `## CHANNEL CONTEXT
- Channel: ${channelName || "Faceless Documentary"}
- Niche: ${channelNiche || "Documentary / Storytelling"}
${channelTags ? `- Tags: ${channelTags}` : ""}
- Brand Voice: ${channelPersonality || "Authoritative, compelling, objective"}
- Audience: ${channelTargetAudience || "In-depth documentary and story seekers"}
${channelDescription ? `- Mission: ${channelDescription}` : ""}
${pillarName ? `- Pillar: ${pillarName}` : ""}
${pillarTone ? `- Tone: ${pillarTone}` : ""}

## VIDEO TOPIC
"${topicTitle}"

## VIDEO SCRIPT (FOR REFERENCE ONLY)
"""
${scriptContent || "No script provided. Base description on topic title and channel context."}
"""

Write the final YouTube video description following the required structure.`;

  return [
    { role: "system", content: STORY_DESCRIPTION_SYSTEM_PROMPT },
    { role: "user", content: userContent.trim() },
  ];
}


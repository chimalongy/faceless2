import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getDbSql, initDbSchema } from "@/lib/db";
import { getTopicToShortExtractionPrompt } from "@/lib/LLMPrompts/TopicToShortExtractionPrompt";

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// POST /api/channels/[channel-name]/topics/[topic-name]/extract-short
// Analyzes a long-form topic script and extracts a companion 35-50s Short
export async function POST(req, context) {
  try {
    const rawParams = await context.params;
    const channelSlug = rawParams?.["channel-name"];
    const topicSlug = rawParams?.["topic-name"];

    if (!channelSlug || !topicSlug) {
      return NextResponse.json(
        { error: "channelSlug and topicSlug are required" },
        { status: 400 }
      );
    }

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured in .env" },
        { status: 503 }
      );
    }

    await initDbSchema();

    // 1. Fetch Channel
    const channelRows = await sql`
      SELECT id, name, niche, description
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channel = channelRows[0];

    // 2. Fetch Source Topic
    const topicRows = await sql`
      SELECT id, pillar_id, title, slug, script_content AS "scriptContent"
      FROM topics
      WHERE slug = ${topicSlug} AND channel_id = ${channel.id}
      LIMIT 1;
    `;
    if (!topicRows || topicRows.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    const parentTopic = topicRows[0];

    if (!parentTopic.scriptContent || !parentTopic.scriptContent.trim()) {
      return NextResponse.json(
        { error: "Cannot extract Short: The source topic has no script content yet." },
        { status: 400 }
      );
    }

    // 3. Fetch General LLM Settings & Accounts
    const generalRows = await sql`
      SELECT 
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel", 
        script_gen_source AS "scriptGenSource",
        script_gen_model AS "scriptGenModel", 
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;
    const genSettings = generalRows?.[0] || {};
    const configuredModel =
      (genSettings.scriptGenModel || genSettings.defaultLlmModel || "gemini-2.5-flash").trim();
    const source =
      (genSettings.scriptGenSource || genSettings.defaultLlmSource || "gemini").trim().toLowerCase();
    const gemmaBaseUrl = (genSettings.gemmaBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/").trim();
    const openRouterBaseUrl = (genSettings.openRouterBaseUrl || "https://openrouter.ai/api/v1").trim();

    const llmAccounts = await sql`
      SELECT id, account_email AS "accountEmail", source, api_token AS "apiToken"
      FROM llm_accounts
      ORDER BY id ASC;
    `;
    if (!llmAccounts || llmAccounts.length === 0) {
      return NextResponse.json(
        { error: "No LLM accounts configured. Please add an API key in Dashboard Settings." },
        { status: 400 }
      );
    }

    const matchingAccounts = llmAccounts.filter((a) => (a.source || "gemini").trim().toLowerCase() === source);
    const otherAccounts = llmAccounts.filter((a) => (a.source || "gemini").trim().toLowerCase() !== source);
    const executionAccounts = [...matchingAccounts, ...otherAccounts];

    const promptText = getTopicToShortExtractionPrompt({
      channelName: channel.name,
      channelNiche: channel.niche,
      topicTitle: parentTopic.title,
      fullScript: parentTopic.scriptContent,
    });

    let extractedData = null;
    let lastError = null;

    for (const acc of executionAccounts) {
      const apiToken = (acc.apiToken || "").trim();
      if (!apiToken) continue;

      const accSource = (acc.source || "gemini").trim().toLowerCase();
      const baseURL = accSource === "openrouter" ? openRouterBaseUrl : gemmaBaseUrl;

      try {
        const openai = new OpenAI({ apiKey: apiToken, baseURL });
        const completion = await openai.chat.completions.create({
          model: configuredModel,
          messages: [
            { role: "system", content: promptText },
            {
              role: "user",
              content: `Analyze the provided script and extract the most viral, curiosity-inducing short. Return valid JSON only.`,
            },
          ],
          temperature: 0.7,
        });

        let content = completion.choices?.[0]?.message?.content?.trim() || "";
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        if (content.startsWith("```")) {
          content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        }

        const parsed = JSON.parse(content);
        if (parsed && (parsed.shortTitle || parsed.title) && (parsed.scriptContent || parsed.script)) {
          extractedData = {
            title: (parsed.shortTitle || parsed.title).trim(),
            script: (parsed.scriptContent || parsed.script).trim(),
          };
          break;
        }
      } catch (err) {
        console.warn(`[ExtractShort] Attempt failed with account ${acc.accountEmail}:`, err.message);
        lastError = err;
      }
    }

    if (!extractedData) {
      throw new Error(
        `Failed to extract Short using configured LLM accounts: ${lastError?.message || "Invalid LLM response"}`
      );
    }

    // 4. Save the new Short topic in DB
    const shortTitle = extractedData.title;
    const baseSlug = toSlug(shortTitle) || `short-${Date.now()}`;
    // Check slug collision
    const existing = await sql`
      SELECT id FROM topics WHERE channel_id = ${channel.id} AND slug = ${baseSlug} LIMIT 1;
    `;
    const finalSlug = existing && existing.length > 0 ? `${baseSlug}-short-${Date.now().toString().slice(-4)}` : baseSlug;

    const inserted = await sql`
      INSERT INTO topics (
        channel_id,
        pillar_id,
        title,
        slug,
        script_content,
        video_type,
        aspect_ratio,
        parent_topic_id
      ) VALUES (
        ${channel.id},
        ${parentTopic.pillar_id},
        ${shortTitle},
        ${finalSlug},
        ${extractedData.script},
        'short',
        '9:16',
        ${parentTopic.id}
      )
      RETURNING 
        id,
        channel_id AS "channelId",
        pillar_id AS "pillarId",
        title,
        slug,
        video_type AS "videoType",
        aspect_ratio AS "aspectRatio",
        parent_topic_id AS "parentTopicId",
        script_content AS "scriptContent",
        created_at AS "createdAt";
    `;

    return NextResponse.json({
      success: true,
      shortTopic: inserted?.[0],
      redirectUrl: `/dashboard/channels/${channelSlug}/topic/${finalSlug}`,
    });
  } catch (error) {
    console.error("Error in extract-short:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract short" },
      { status: 500 }
    );
  }
}

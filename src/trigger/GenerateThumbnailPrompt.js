import { task, logger } from "@trigger.dev/sdk";
import OpenAI from "openai";
import { getDbSql, initDbSchema } from "@/lib/db";
import { getThumbnailPromptGeneration } from "@/lib/LLMPrompts/ThumbnailPromptGeneration";

export const generateThumbnailPromptTask = task({
  id: "generate-thumbnail-prompt",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      customModel = null,
    } = payload;

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required for generate-thumbnail-prompt task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required for generate-thumbnail-prompt task.");
    }

    logger.log("Starting GenerateThumbnailPrompt task...", { channelSlug, topicSlug });

    const sql = getDbSql();
    if (!sql) {
      throw new Error("Database not connected. DATABASE_URL is required.");
    }

    await initDbSchema();

    // 1. Fetch Channel & Topic records
    const channelRows = await sql`
      SELECT id, name, slug, niche, sub_niche, description, thumbnail_theme, image_theme
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      throw new Error(`Channel not found with slug "${channelSlug}".`);
    }
    const channel = channelRows[0];

    const topicRows = await sql`
      SELECT id, channel_id, pillar_id, title, slug, thumbnail_prompt
      FROM topics
      WHERE slug = ${topicSlug} AND channel_id = ${channel.id}
      LIMIT 1;
    `;

    if (!topicRows || topicRows.length === 0) {
      throw new Error(`Topic not found with slug "${topicSlug}" for channel "${channelSlug}".`);
    }
    const topic = topicRows[0];

    // Fetch Pillar context if linked
    let pillar = null;
    if (topic.pillar_id) {
      const pillarRows = await sql`
        SELECT id, name, slug, tag, description, tone
        FROM content_pillars
        WHERE id = ${topic.pillar_id}
        LIMIT 1;
      `;
      pillar = pillarRows?.[0] || null;
    }

    const topicTitle = topic.title || "Untitled Topic";
    const pillarName = pillar?.name || "General Content";
    const imageTheme = (channel.image_theme || "").trim();
    const thumbnailTheme = (channel.thumbnail_theme || imageTheme || "Cinematic high-contrast psychological documentary aesthetic, clean silhouette separation, volumetric lighting").trim();

    // 2. Fetch General Settings
    const generalRows = await sql`
      SELECT 
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel",
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const genSettings = generalRows?.[0] || {};
    const defaultLlmSource = (genSettings.defaultLlmSource || "gemini").trim().toLowerCase();
    const defaultLlmModel = (genSettings.defaultLlmModel || "gemini-2.5-flash").trim();
    const gemmaBaseUrl = (genSettings.gemmaBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/").trim();
    const openRouterBaseUrl = (genSettings.openRouterBaseUrl || "https://openrouter.ai/api/v1").trim();

    const configuredModel = (customModel || defaultLlmModel || "gemini-2.5-flash").trim();

    // 3. Fetch all LLM Accounts from DB
    const rawLlmAccounts = await sql`
      SELECT id, account_email AS "accountEmail", source, account_id AS "accountId", api_token AS "apiToken"
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    if (!rawLlmAccounts || rawLlmAccounts.length === 0) {
      throw new Error(
        "No LLM accounts configured in database. Please go to Dashboard Settings -> LLM Accounts tab and add your Gemini or OpenRouter API key."
      );
    }

    const matchingAccounts = rawLlmAccounts.filter(
      (acc) => (acc.source || "gemini").trim().toLowerCase() === defaultLlmSource
    );
    const otherAccounts = rawLlmAccounts.filter(
      (acc) => (acc.source || "gemini").trim().toLowerCase() !== defaultLlmSource
    );
    const executionAccounts = [...matchingAccounts, ...otherAccounts];

    // 4. Construct Prompt
    const fullPrompt = getThumbnailPromptGeneration({
      channelImageGenerationTheme: imageTheme,
      channelThumbnailGenerationTheme: thumbnailTheme,
      topic: topicTitle,
    });

    // Helper to strip thinking tags
    function stripReasoningBlocks(text) {
      if (!text) return "";
      let str = text;
      str = str.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
      str = str.replace(/<think>[\s\S]*?<\/think>/gi, "");
      str = str.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
      str = str.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
      str = str.replace(/<\/?(?:thought|think|thinking|reasoning|plan)>/gi, "");
      // Strip outer quotes if any
      str = str.replace(/^["']|["']$/g, "");
      return str.trim();
    }

    // 5. Fallback Loop Across LLM Accounts
    let generatedPrompt = null;
    let successfulAccount = null;
    const errors = [];

    for (let i = 0; i < executionAccounts.length; i++) {
      const account = executionAccounts[i];
      const accountSource = (account.source || "gemini").trim().toLowerCase();
      const apiToken = (account.apiToken || "").trim();
      const email = account.accountEmail || `Account #${i + 1} (${accountSource})`;

      if (!apiToken) {
        logger.warn(`[GenerateThumbnailPrompt] Skipping account ${email} because API token is missing.`);
        errors.push(`${email}: Missing API token`);
        continue;
      }

      const baseURL = accountSource === "openrouter" ? openRouterBaseUrl : gemmaBaseUrl;
      logger.log(`[GenerateThumbnailPrompt] Attempting prompt generation with account ${email} using model ${configuredModel}...`);

      try {
        const openai = new OpenAI({
          apiKey: apiToken,
          baseURL,
        });

        const completion = await openai.chat.completions.create({
          model: configuredModel,
          messages: [
            {
              role: "system",
              content: fullPrompt,
            },
            {
              role: "user",
              content: `Generate the YouTube thumbnail image generation prompt for the topic: "${topicTitle}".`,
            },
          ],
          temperature: 0.7,
        });

        const rawText = completion.choices?.[0]?.message?.content?.trim();
        if (!rawText) {
          throw new Error(`Empty response returned from ${accountSource} for account ${email}`);
        }

        const cleaned = stripReasoningBlocks(rawText);
        if (!cleaned) {
          throw new Error(`Model returned only reasoning tags without prompt content for account ${email}`);
        }

        generatedPrompt = cleaned;
        successfulAccount = `${email} (${accountSource})`;
        logger.log(`[GenerateThumbnailPrompt] Successfully generated thumbnail prompt with ${successfulAccount}!`);
        break;
      } catch (err) {
        logger.error(`[GenerateThumbnailPrompt] Failed with account ${email}:`, {
          error: err.message,
          source: accountSource,
          model: configuredModel,
        });
        errors.push(`${email} (${accountSource}): ${err.message}`);
      }
    }

    if (!generatedPrompt) {
      const formattedErrors = errors.map((e) => `• ${e}`).join("\n");
      throw new Error(
        `All ${executionAccounts.length} LLM account(s) failed during thumbnail prompt generation.\n\nErrors encountered:\n${formattedErrors}`
      );
    }

    // 6. Save generated thumbnail prompt to database
    logger.log(`[GenerateThumbnailPrompt] Saving thumbnail prompt to database for topic "${topicTitle}"...`);
    await sql`
      UPDATE topics
      SET 
        thumbnail_prompt = ${generatedPrompt},
        updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    return {
      success: true,
      channelSlug,
      topicSlug,
      topicId: topic.id,
      topicTitle,
      thumbnailPrompt: generatedPrompt,
      modelUsed: configuredModel,
      accountUsed: successfulAccount,
    };
  },
});

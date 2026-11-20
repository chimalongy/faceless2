import { task, logger } from "@trigger.dev/sdk";
import OpenAI from "openai";
import { getDbSql, initDbSchema } from "@/lib/db";
import { getThumbnailPromptGeneration } from "@/lib/LLMPrompts/ThumbnailPromptGeneration";
import { resolveLlmBaseUrl } from "@/lib/llm-provider";

export const generateThumbnailPromptTask = task({
  id: "generate-thumbnail-prompt",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      customModel = null,
      requestedArchetype = null,
      requestedAccentColor = null,
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
      SELECT 
        id, name, slug, niche, sub_niche, description, 
        thumbnail_theme, image_theme, prompt_settings,
        COALESCE(thumbnail_archetype, 'documentary_noir') AS "thumbnailArchetype",
        COALESCE(thumbnail_accent_color, 'golden_amber') AS "thumbnailAccentColor",
        COALESCE(thumbnail_use_main_character, TRUE) AS "thumbnailUseMainCharacter",
        COALESCE(thumbnail_include_text_hook, FALSE) AS "thumbnailIncludeTextHook",
        thumbnail_custom_rules AS "thumbnailCustomRules"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      throw new Error(`Channel not found with slug "${channelSlug}".`);
    }
    const channel = channelRows[0];

    const topicRows = await sql`
      SELECT 
        id, channel_id, pillar_id, title, slug, thumbnail_prompt,
        story_description AS "storyDescription",
        script_content AS "scriptContent"
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

    // Resolve channel main character if enabled
    let mainCharacter = null;
    if (channel.thumbnailUseMainCharacter) {
      try {
        const charRows = await sql`
          SELECT name, physical_spec, signature_feature, wardrobe
          FROM channel_characters
          WHERE channel_id = ${channel.id} AND is_main = TRUE
          LIMIT 1;
        `;
        if (charRows && charRows.length > 0) {
          mainCharacter = {
            name: charRows[0].name,
            physicalSpec: charRows[0].physical_spec,
            signatureFeature: charRows[0].signature_feature,
            wardrobe: charRows[0].wardrobe,
          };
        }
      } catch (charErr) {
        logger.warn("Could not query channel main character for thumbnail prompt:", charErr);
      }
    }

    const topicTitle = (topic.title || "").trim();
    const pillarName = pillar?.name || "";
    const imageTheme = (channel.image_theme || "").trim();
    const thumbnailTheme = (channel.thumbnail_theme || "").trim();
    const archetypeKey = requestedArchetype || channel.thumbnailArchetype || "documentary_noir";
    const accentColorKey = requestedAccentColor || channel.thumbnailAccentColor || "golden_amber";
    const customRules = channel.thumbnailCustomRules || thumbnailTheme || "";

    // 2. Fetch General Settings
    const generalRows = await sql`
      SELECT 
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel",
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl",
        nvidia_base_url AS "nvidiaBaseUrl"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const genSettings = generalRows?.[0] || {};
    const defaultLlmSource = (genSettings.defaultLlmSource || "gemini").trim().toLowerCase();
    const defaultLlmModel = (genSettings.defaultLlmModel || "gemini-2.5-flash").trim();
    const gemmaBaseUrl = (genSettings.gemmaBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/").trim();
    const openRouterBaseUrl = (genSettings.openRouterBaseUrl || "https://openrouter.ai/api/v1").trim();
    const nvidiaBaseUrl = (genSettings.nvidiaBaseUrl || "https://integrate.api.nvidia.com/v1").trim();

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

    // 4. Construct High-CTR Modular Prompt
    const fullPrompt = getThumbnailPromptGeneration({
      channelImageGenerationTheme: imageTheme,
      channelThumbnailGenerationTheme: thumbnailTheme,
      topic: topicTitle,
      storyDescription: topic.storyDescription || "",
      scriptContent: topic.scriptContent || "",
      archetypeKey,
      accentColorKey,
      character: mainCharacter,
      includeTextHook: payload.includeTextHook ?? channel.thumbnailIncludeTextHook ?? false,
      customRules,
      promptTemplate: (channel.prompt_settings?.thumbnailPrompt || channel.prompt_settings?.thumbnail_prompt || null),
    });

    // Helper to strip thinking tags and markdown fences
    function stripReasoningBlocks(text) {
      if (!text) return "";
      let str = text;
      str = str.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
      str = str.replace(/<think>[\s\S]*?<\/think>/gi, "");
      str = str.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
      str = str.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
      str = str.replace(/<\/?(?:thought|think|thinking|reasoning|plan)>/gi, "");
      return str.trim();
    }

    function parseConceptsOutput(rawText, title) {
      let cleaned = stripReasoningBlocks(rawText);
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

      const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item, idx) => ({
              id: item.id || idx + 1,
              angle: item.angle || `Angle ${idx + 1}`,
              title: item.title || `Concept ${idx + 1}`,
              text_hook: item.text_hook || item.textHook || null,
              focal_hook: item.focal_hook || item.hook || "",
              prompt: item.prompt || (typeof item === "string" ? item : JSON.stringify(item)),
            }));
          }
        } catch {}
      }

      // Single prompt fallback wrapped into concept array
      return [
        {
          id: 1,
          angle: "High-CTR Signature Concept",
          title: title || "Primary Concept",
          focal_hook: "Core dramatic focal point",
          prompt: cleaned,
        },
      ];
    }

    // 5. Fallback Loop Across LLM Accounts
    let generatedConcepts = null;
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

      const baseURL = resolveLlmBaseUrl(accountSource, {
        gemmaBaseUrl,
        openRouterBaseUrl,
        nvidiaBaseUrl,
      });
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
              content: `Generate 3 high-CTR YouTube thumbnail concepts in JSON format for the topic: "${topicTitle}".`,
            },
          ],
          temperature: 0.7,
        });

        const rawText = completion.choices?.[0]?.message?.content?.trim();
        if (!rawText) {
          throw new Error(`Empty response returned from ${accountSource} for account ${email}`);
        }

        const concepts = parseConceptsOutput(rawText, topicTitle);
        if (!concepts || concepts.length === 0) {
          throw new Error(`Failed to parse valid thumbnail concepts from account ${email}`);
        }

        generatedConcepts = concepts;
        successfulAccount = `${email} (${accountSource})`;
        logger.log(`[GenerateThumbnailPrompt] Successfully generated ${concepts.length} thumbnail concepts with ${successfulAccount}!`);
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

    if (!generatedConcepts || generatedConcepts.length === 0) {
      const formattedErrors = errors.map((e) => `• ${e}`).join("\n");
      throw new Error(
        `All ${executionAccounts.length} LLM account(s) failed during thumbnail prompt generation.\n\nErrors encountered:\n${formattedErrors}`
      );
    }

    const primaryPrompt = generatedConcepts[0]?.prompt || "";

    // 6. Save generated thumbnail concepts and primary prompt to database
    logger.log(`[GenerateThumbnailPrompt] Saving ${generatedConcepts.length} thumbnail concepts to database for topic "${topicTitle}"...`);
    await sql`
      UPDATE topics
      SET 
        thumbnail_prompt = ${primaryPrompt},
        thumbnail_concepts = ${JSON.stringify(generatedConcepts)}::jsonb,
        selected_thumbnail_concept = 1,
        updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    return {
      success: true,
      channelSlug,
      topicSlug,
      topicId: topic.id,
      topicTitle,
      thumbnailPrompt: primaryPrompt,
      thumbnailConcepts: generatedConcepts,
      modelUsed: configuredModel,
      accountUsed: successfulAccount,
    };
  },
});

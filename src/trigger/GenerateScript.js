import { task, logger } from "@trigger.dev/sdk";
import OpenAI from "openai";
import { getDbSql, initDbSchema } from "@/lib/db";
import {
  getScriptGenerationSystemPrompt,
  SCRIPT_GENERATION_SYSTEM_PROMPT,
} from "@/lib/LLMPrompts/ScriptGenerationPrompt";

export const generateScriptTask = task({
  id: "generate-script",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      customModel = null,
      customPrompt = null,
    } = payload;

    if (
      !channelSlug ||
      typeof channelSlug !== "string" ||
      !channelSlug.trim()
    ) {
      throw new Error("channelSlug is required for generate-script task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required for generate-script task.");
    }

    logger.log("Starting GenerateScript task...", { channelSlug, topicSlug });

    const sql = getDbSql();
    if (!sql) {
      throw new Error("Database not connected. DATABASE_URL is required.");
    }

    await initDbSchema();

    // 1. Fetch Channel & Topic records
    const channelRows = await sql`
      SELECT id, name, slug, niche, sub_niche, description, mission, personality
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      throw new Error(`Channel not found with slug "${channelSlug}".`);
    }
    const channel = channelRows[0];

    const topicRows = await sql`
      SELECT id, channel_id, pillar_id, title, slug, script_content
      FROM topics
      WHERE slug = ${topicSlug} AND channel_id = ${channel.id}
      LIMIT 1;
    `;

    if (!topicRows || topicRows.length === 0) {
      throw new Error(
        `Topic not found with slug "${topicSlug}" for channel "${channelSlug}".`,
      );
    }
    const topic = topicRows[0];

    // Fetch Pillar context if linked
    let pillar = null;
    if (topic.pillar_id) {
      const pillarRows = await sql`
        SELECT id, name, slug, tag, description, tone, content_length AS "contentLength", content_words_count AS "contentWordsCount"
        FROM content_pillars
        WHERE id = ${topic.pillar_id}
        LIMIT 1;
      `;
      pillar = pillarRows?.[0] || null;
    }

    const topicTitle = topic.title || "Untitled Topic";
    const pillarName = pillar?.name || "General Content";
    const pillarDescription =
      pillar?.description ||
      channel.description ||
      "In-depth strategic insights and engaging narrative storytelling.";
    const pillarTone =
      pillar?.tone || channel.personality || "Calm, analytical, insightful";
    const pillarContentLength =
      pillar?.contentLength || "15-20 minutes (~2500 words)";
    const pillarContentWordsCount =
      pillar?.contentWordsCount || "2,500 - 3,500 words";

    // 2. Fetch General Settings for Script Generation Pipeline
    const generalRows = await sql`
      SELECT 
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel", 
        script_gen_source AS "scriptGenSource",
        script_gen_strict_source AS "scriptGenStrictSource",
        script_gen_model AS "scriptGenModel", 
        script_gen_strict_model AS "scriptGenStrictModel",
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const genSettings = generalRows?.[0] || {};
    const defaultLlmSource = (genSettings.defaultLlmSource || "gemini")
      .trim()
      .toLowerCase();
    const defaultLlmModel = (genSettings.defaultLlmModel || "").trim();

    const scriptGenSource = (
      genSettings.scriptGenSource ||
      defaultLlmSource ||
      "gemini"
    )
      .trim()
      .toLowerCase();
    const scriptGenStrictSource = Boolean(genSettings.scriptGenStrictSource);
    const scriptGenModel = (genSettings.scriptGenModel || "").trim();
    const scriptGenStrictModel = Boolean(genSettings.scriptGenStrictModel);

    const gemmaBaseUrl = (
      genSettings.gemmaBaseUrl ||
      "https://generativelanguage.googleapis.com/v1beta/openai/"
    ).trim();
    const openRouterBaseUrl = (
      genSettings.openRouterBaseUrl || "https://openrouter.ai/api/v1"
    ).trim();

    // Model Resolution Logic for Script Generation
    let configuredModel = "";
    if (scriptGenStrictModel) {
      configuredModel = scriptGenModel || defaultLlmModel;
      if (!configuredModel) {
        throw new Error(
          "Strict Model Mode is enabled for Script Generation, but no Script Generation Model or Default LLM Model is configured in Settings.",
        );
      }
      logger.log(
        `[GenerateScript] Strict Model Mode active. Enforcing model: ${configuredModel}`,
      );
    } else {
      configuredModel = (
        customModel ||
        scriptGenModel ||
        defaultLlmModel ||
        ""
      ).trim();
      if (!configuredModel) {
        throw new Error(
          "No LLM Model configured for script generation. Please go to Dashboard Settings -> General Settings and configure your Script Generation Model or Default LLM Model.",
        );
      }
      logger.log(`[GenerateScript] Using resolved model: ${configuredModel}`);
    }

    // 3. Fetch all LLM Accounts from DB
    const rawLlmAccounts = await sql`
      SELECT id, account_email AS "accountEmail", source, account_id AS "accountId", api_token AS "apiToken"
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    if (!rawLlmAccounts || rawLlmAccounts.length === 0) {
      throw new Error(
        "No LLM accounts configured in database. Please go to Dashboard Settings -> LLM Accounts tab and add your Gemini or OpenRouter API key.",
      );
    }

    // Source Resolution for Script Generation
    let executionAccounts = [];
    if (scriptGenStrictSource) {
      executionAccounts = rawLlmAccounts.filter(
        (acc) =>
          (acc.source || "gemini").trim().toLowerCase() === scriptGenSource,
      );

      if (executionAccounts.length === 0) {
        throw new Error(
          `Strict Source Mode is active for Script Generation ('${scriptGenSource}'), but no ${scriptGenSource} accounts were found in Settings -> LLM Accounts. Please add a ${scriptGenSource} account or disable Strict Source Mode.`,
        );
      }
      logger.log(
        `[GenerateScript] Strict Source Mode active for '${scriptGenSource}'. Filtered to ${executionAccounts.length} account(s).`,
      );
    } else {
      const matchingAccounts = rawLlmAccounts.filter(
        (acc) =>
          (acc.source || "gemini").trim().toLowerCase() === scriptGenSource,
      );
      const otherAccounts = rawLlmAccounts.filter(
        (acc) =>
          (acc.source || "gemini").trim().toLowerCase() !== scriptGenSource,
      );
      executionAccounts = [...matchingAccounts, ...otherAccounts];
      logger.log(
        `[GenerateScript] Prioritizing ${matchingAccounts.length} ${scriptGenSource} account(s), with ${otherAccounts.length} fallback account(s).`,
      );
    }

    // 4. Construct System & User Prompt
    const fullSystemPrompt = getScriptGenerationSystemPrompt({
      channelName: channel.name,
      channelNiche: channel.niche,
      channelSubNiche: channel.sub_niche,
      channelDescription: channel.description,
      channelMission: channel.mission,
      contentPillarName: pillarName,
      contentPillarCategoryTag: pillar?.tag || "General",
      contentPillarTone: pillarTone || "Calm, analytical, insightful",
      contentPillarLength: pillarContentLength,
      contentPillarWordsCount: pillarContentWordsCount,
      contentPillarDescription: pillarDescription,
      topic: topicTitle,
    });

    const userPromptContent =
      customPrompt ||
      `Generate the complete, engaging, long-form YouTube script for the topic: "${topicTitle}". Follow all instructions in the system prompt.`;

    // 5. Fallback Loop Across Selected LLM Accounts
    let generatedScript = null;
    let successfulAccount = null;
    const errors = [];

    for (let i = 0; i < executionAccounts.length; i++) {
      const account = executionAccounts[i];
      const accountSource = (account.source || "gemini").trim().toLowerCase();
      const apiToken = (account.apiToken || "").trim();
      const email =
        account.accountEmail || `Account #${i + 1} (${accountSource})`;

      if (!apiToken) {
        logger.warn(
          `[GenerateScript] Skipping account ${email} (${i + 1}/${executionAccounts.length}) because API token is missing.`,
        );
        errors.push(`${email}: Missing API token`);
        continue;
      }

      const baseURL =
        accountSource === "openrouter" ? openRouterBaseUrl : gemmaBaseUrl;
      logger.log(
        `[GenerateScript] Attempting generation with account ${email} via ${accountSource} [${baseURL}] using model ${configuredModel} (${i + 1}/${executionAccounts.length})...`,
      );

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
              content: fullSystemPrompt,
            },
            {
              role: "user",
              content: userPromptContent,
            },
          ],
          temperature: 0.8,
        });

        const rawText = completion.choices?.[0]?.message?.content?.trim();

        if (!rawText) {
          throw new Error(
            `Empty script content returned from ${accountSource} for account ${email}`,
          );
        }

        // Strip all thinking/reasoning tags (<thought>, <think>, <thinking>, <reasoning>, etc.)
        function stripReasoningBlocks(text) {
          if (!text) return "";
          let str = text;
          str = str.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
          str = str.replace(/<think>[\s\S]*?<\/think>/gi, "");
          str = str.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
          str = str.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
          str = str.replace(/<plan>[\s\S]*?<\/plan>/gi, "");
          str = str.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, "");
          str = str.replace(
            /<\/?(?:thought|think|thinking|reasoning|plan)>/gi,
            "",
          );
          return str.trim();
        }

        const cleanedScript = stripReasoningBlocks(rawText);

        if (!cleanedScript) {
          throw new Error(
            `Model returned only reasoning tags without script content for account ${email}`,
          );
        }

        generatedScript = cleanedScript;
        successfulAccount = `${email} (${accountSource})`;
        logger.log(
          `[GenerateScript] Successfully generated script using account ${successfulAccount}!`,
        );
        break; // Exit loop on success
      } catch (err) {
        logger.error(`[GenerateScript] Failed with account ${email}:`, {
          error: err.message,
          source: accountSource,
          model: configuredModel,
        });
        errors.push(`${email} (${accountSource}): ${err.message}`);
      }
    }

    if (!generatedScript) {
      const formattedErrors = errors.map((e) => `• ${e}`).join("\n");
      throw new Error(
        `All ${executionAccounts.length} LLM account(s) failed during script generation.\n\nErrors encountered:\n${formattedErrors}`,
      );
    }

    // 6. Save generated script back to Neon DB topic record
    logger.log(
      `[GenerateScript] Saving generated script (${generatedScript.length} characters) to database...`,
    );
    await sql`
      UPDATE topics
      SET 
        script_content = ${generatedScript},
        updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    logger.log(
      `[GenerateScript] Script successfully saved for topic "${topicTitle}".`,
    );

    return {
      success: true,
      channelSlug,
      topicSlug,
      topicId: topic.id,
      topicTitle,
      modelUsed: configuredModel,
      accountUsed: successfulAccount,
      scriptLength: generatedScript.length,
      scriptSnippet: generatedScript.slice(0, 300) + "...",
    };
  },
});

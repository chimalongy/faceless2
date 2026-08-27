import { task, logger } from "@trigger.dev/sdk";
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

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
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

    // 1. Fetch Channel, Pillar, and Topic records
    const channelRows = await sql`
      SELECT id, name, slug, niche, sub_niche, description, target_audience, mission, personality
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
      throw new Error(`Topic not found with slug "${topicSlug}" for channel "${channelSlug}".`);
    }
    const topic = topicRows[0];

    // Fetch Pillar context if linked
    let pillar = null;
    if (topic.pillar_id) {
      const pillarRows = await sql`
        SELECT id, name, slug, tag, description, tone, content_length AS "contentLength", content_words_count AS "contentWordsCount", use_main_character AS "useMainCharacter", main_character_description AS "mainCharacterDescription"
        FROM content_pillars
        WHERE id = ${topic.pillar_id}
        LIMIT 1;
      `;
      pillar = pillarRows?.[0] || null;
    }

    const topicTitle = topic.title || topicSlug;
    const pillarName = pillar?.name || channel.niche || "General Content";
    const pillarDescription = pillar?.description || channel.description || "In-depth strategic insights and engaging narrative storytelling.";
    const pillarTone = pillar?.tone || channel.personality || null;
    const pillarContentLength = pillar?.contentLength || "15-20 minutes (~2500 words)";
    const pillarContentWordsCount = pillar?.contentWordsCount || "2,500 - 3,500 words";
    

    // 2. Fetch General Settings for Default LLM Model
    const generalRows = await sql`
      SELECT default_llm_model AS "defaultLlmModel"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const rawModel = generalRows?.[0]?.defaultLlmModel?.trim();

    if (!rawModel) {
      throw new Error(
        "No Default LLM Model configured. Please go to Dashboard Settings -> General Settings and set your Default LLM Model."
      );
    }
    
    // Resolve to official Cloudflare Workers AI model URI
    function resolveCloudflareModel(modelStr) {
      const m = (modelStr || "").trim();
      if (!m) return "";
      if (m.startsWith("@cf/")) return m;
      if (m.startsWith("cf/")) return `@${m}`;
      if (m.startsWith("@")) return `@cf/${m.slice(1)}`;
      if (m.includes("/")) return `@cf/${m.replace(/^\/+/, "")}`;

      const aliasMap = {
        "kimi": "@cf/moonshotai/kimi-k2.7-code",
        "kimi-k2.7-code": "@cf/moonshotai/kimi-k2.7-code",
        "llama-3.1-70b": "@cf/meta/llama-3.1-70b-instruct",
        "llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct",
        "llama-3.3-70b": "@cf/meta/llama-3.3-70b-instruct",
        "deepseek-r1": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        "qwen-72b": "@cf/qwen/qwen2.5-72b-instruct",
        "qwen-2.5-72b": "@cf/qwen/qwen2.5-72b-instruct",
        "mistral-7b": "@cf/mistral/mistral-7b-instruct-v0.2",
        "gpt-4o": "@cf/meta/llama-3.1-70b-instruct",
        "gpt-4o-mini": "@cf/meta/llama-3.1-8b-instruct",
      };

      return aliasMap[m.toLowerCase()] || `@cf/${m}`;
    }

    const configuredModel = resolveCloudflareModel(rawModel);
    logger.log(`Using default LLM model: ${configuredModel}`);

    // 3. Fetch all LLM Accounts from DB (Ordered from top/first added)
    const llmAccounts = await sql`
      SELECT id, account_email AS "accountEmail", account_id AS "accountId", api_token AS "apiToken"
      FROM llm_accounts
      ORDER BY id ASC;
    `;

    if (!llmAccounts || llmAccounts.length === 0) {
      throw new Error(
        "No LLM accounts configured in database. Please go to Dashboard Settings -> LLMs Accounts tab and add at least one Cloudflare account (Account ID and API Token)."
      );
    }

    logger.log(`Loaded ${llmAccounts.length} LLM account(s) for execution pool.`);

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

    const userPromptContent = customPrompt || `Generate the complete, engaging, long-form YouTube script for the topic: "${topicTitle}". Follow all instructions in the system prompt.`;

    // 5. Fallback Loop Across LLM Accounts starting from the top
    let generatedScript = null;
    let successfulAccount = null;
    const errors = [];

    for (let i = 0; i < llmAccounts.length; i++) {
      const account = llmAccounts[i];
      const accountId = (account.accountId || "").trim();
      const apiToken = (account.apiToken || "").trim();
      const email = account.accountEmail || `Account #${i + 1}`;

      if (!accountId || !apiToken) {
        logger.warn(`[GenerateScript] Skipping account ${email} (${i + 1}/${llmAccounts.length}) because account_id or api_token is missing.`);
        errors.push(`${email}: Missing account_id or api_token`);
        continue;
      }

      logger.log(`[GenerateScript] Attempting generation with account ${email} (${i + 1}/${llmAccounts.length})...`);

      try {
        const endpointUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${configuredModel}`;

        const response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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
            max_tokens: 4096,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Cloudflare AI responded with HTTP ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data = await response.json();

        // Extract script text from response
        let textResult = data?.result?.response || data?.result?.text || (typeof data?.result === "string" ? data.result : null);

        if (!textResult && data?.response) {
          textResult = data.response;
        }

        if (!textResult || typeof textResult !== "string" || !textResult.trim()) {
          throw new Error(`Empty script content returned from Cloudflare Workers AI for account ${email}`);
        }

        generatedScript = textResult.trim();
        successfulAccount = email;
        logger.log(`[GenerateScript] Successfully generated script using account ${email} (${generatedScript.split(/\s+/).length} words).`);
        break; // Stop loop on success
      } catch (err) {
        logger.warn(`[GenerateScript] Error using account ${email}:`, { error: err.message });
        errors.push(`${email}: ${err.message}`);
        // Continue to the next account in the pool
      }
    }

    if (!generatedScript) {
      const aggregateError = `All ${llmAccounts.length} LLM account(s) failed during script generation:\n${errors.join("\n")}`;
      logger.error("[GenerateScript] Execution failed for all accounts.", { errors });
      throw new Error(aggregateError);
    }

    // 6. Save the generated script in the database
    logger.log(`[GenerateScript] Saving generated script to Neon PostgreSQL for topic "${topicSlug}"...`);
    await sql`
      UPDATE topics
      SET script_content = ${generatedScript}, updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    return {
      success: true,
      scriptContent: generatedScript,
      wordCount: generatedScript.split(/\s+/).filter(Boolean).length,
      accountUsed: successfulAccount,
      modelUsed: configuredModel,
      topicId: topic.id,
      topicSlug,
      channelSlug,
    };
  },
});

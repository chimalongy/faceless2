import { task, logger } from "@trigger.dev/sdk";
import { getDbSql, initDbSchema } from "@/lib/db";
import {
  getSceneGenerationPrompt,
  SCENE_GENERATION_SYSTEM_PROMPT,
} from "@/lib/LLMPrompts/SceneGenerationPrompt";

export const generateScenesTask = task({
  id: "generate-scenes",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      customModel = null,
      customScript = null,
      customImageTheme = null,
    } = payload;

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required for generate-scenes task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required for generate-scenes task.");
    }

    logger.log("Starting GenerateScenes task...", { channelSlug, topicSlug });

    const sql = getDbSql();
    if (!sql) {
      throw new Error("Database not connected. DATABASE_URL is required.");
    }

    await initDbSchema();

    // 1. Fetch Channel & Topic records
    const channelRows = await sql`
      SELECT id, name, slug, niche, sub_niche, description, image_theme
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      throw new Error(`Channel not found with slug "${channelSlug}".`);
    }
    const channel = channelRows[0];

    const topicRows = await sql`
      SELECT id, channel_id, pillar_id, title, slug, script_content, scenes_json
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
        SELECT id, name, slug, tag, description, tone, use_main_character AS "useMainCharacter", main_character_description AS "mainCharacterDescription"
        FROM content_pillars
        WHERE id = ${topic.pillar_id}
        LIMIT 1;
      `;
      pillar = pillarRows?.[0] || null;
    }

    const activeScript = (customScript || topic.script_content || "").trim();
    if (!activeScript) {
      throw new Error(
        "No script found for this topic. Please write or autogenerate a script in the Script tab before generating scenes."
      );
    }

    const visualTheme = (customImageTheme || channel.image_theme || "Cinematic moody documentary, atmospheric volumetric lighting, rich color grading, ultra-high resolution photography and realistic 35mm film textures").trim();
    const pillarTone = pillar?.tone || channel.personality || null;
    const pillarUseMainCharacter = Boolean(pillar?.useMainCharacter);
    const pillarMainCharacterDescription = pillar?.mainCharacterDescription || null;

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

    logger.log(`Loaded ${llmAccounts.length} LLM account(s) for scene generation.`);

    // 4. Construct Full Prompt using extracted SceneGenerationPrompt module
    const fullPrompt = getSceneGenerationPrompt({
      visualTheme,
      activeScript,
      tone: pillarTone,
      useMainCharacter: pillarUseMainCharacter,
      mainCharacterDescription: pillarMainCharacterDescription,
    });

    // 5. Fallback Loop Across LLM Accounts starting from the top
    let parsedScenes = null;
    let successfulAccount = null;
    const errors = [];

    for (let i = 0; i < llmAccounts.length; i++) {
      const account = llmAccounts[i];
      const accountId = (account.accountId || "").trim();
      const apiToken = (account.apiToken || "").trim();
      const email = account.accountEmail || `Account #${i + 1}`;

      if (!accountId || !apiToken) {
        logger.warn(`[GenerateScenes] Skipping account ${email} (${i + 1}/${llmAccounts.length}) due to missing credentials.`);
        errors.push(`${email}: Missing account_id or api_token`);
        continue;
      }

      logger.log(`[GenerateScenes] Attempting scene generation with account ${email} (${i + 1}/${llmAccounts.length})...`);

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
                content: SCENE_GENERATION_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: fullPrompt,
              },
            ],
            max_tokens: 4096,
            temperature: 0.5,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Cloudflare AI responded with HTTP ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data = await response.json();

        // Extract raw text response
        let textResult = data?.result?.response || data?.result?.text || (typeof data?.result === "string" ? data.result : null);
        if (!textResult && data?.response) {
          textResult = data.response;
        }

        if (!textResult || typeof textResult !== "string" || !textResult.trim()) {
          throw new Error(`Empty response returned from Cloudflare Workers AI for account ${email}`);
        }

        // Clean and parse JSON
        let cleaned = textResult.trim();
        // Remove markdown backticks if present (e.g. ```json ... ``` or ``` ...)
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        }

        // Extract JSON array boundary if extra text exists
        const firstBracket = cleaned.indexOf("[");
        const lastBracket = cleaned.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          cleaned = cleaned.slice(firstBracket, lastBracket + 1);
        }

        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("Model returned JSON that is not a non-empty array of scenes.");
        }

        // Format and validate scene properties
        parsedScenes = parsed.map((sc, idx) => ({
          scene_number: Number(sc.scene_number || sc.scene_index || idx + 1),
          audio_text: String(sc.audio_text || sc.narration || sc.text || "").trim(),
          image_prompt: String(sc.image_prompt || sc.prompt || sc.visual_prompt || "").trim(),
          transition: sc.transition || "crossfade",
          ken_burns: {
            direction: sc.ken_burns?.direction || "zoom-in",
            intensity: sc.ken_burns?.intensity || 0.10,
          },
        }));

        successfulAccount = email;
        logger.log(`[GenerateScenes] Successfully generated and parsed ${parsedScenes.length} scenes using account ${email}.`);
        break; // Success! Break out of fallback loop
      } catch (err) {
        logger.warn(`[GenerateScenes] Error using account ${email}:`, { error: err.message });
        errors.push(`${email}: ${err.message}`);
      }
    }

    if (!parsedScenes || parsedScenes.length === 0) {
      const aggregateError = `All ${llmAccounts.length} LLM account(s) failed during scene generation:\n${errors.join("\n")}`;
      logger.error("[GenerateScenes] Execution failed for all accounts.", { errors });
      throw new Error(aggregateError);
    }

    // 6. Save the generated scenes JSON in the Neon PostgreSQL database
    logger.log(`[GenerateScenes] Saving ${parsedScenes.length} scenes to Neon PostgreSQL for topic "${topicSlug}"...`);
    await sql`
      UPDATE topics
      SET scenes_json = ${JSON.stringify(parsedScenes)}::jsonb, updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    return {
      success: true,
      scenes: parsedScenes,
      totalScenes: parsedScenes.length,
      accountUsed: successfulAccount,
      modelUsed: configuredModel,
      topicId: topic.id,
      topicSlug,
      channelSlug,
    };
  },
});

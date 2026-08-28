import { task, logger } from "@trigger.dev/sdk";
import OpenAI from "openai";
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

    // 2. Fetch General Settings for Scene Generation Pipeline
    const generalRows = await sql`
      SELECT 
        default_llm_source AS "defaultLlmSource",
        default_llm_model AS "defaultLlmModel", 
        scene_gen_source AS "sceneGenSource",
        scene_gen_strict_source AS "sceneGenStrictSource",
        scene_gen_model AS "sceneGenModel", 
        scene_gen_strict_model AS "sceneGenStrictModel",
        gemma_base_url AS "gemmaBaseUrl",
        open_router_base_url AS "openRouterBaseUrl"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const genSettings = generalRows?.[0] || {};
    const defaultLlmSource = (genSettings.defaultLlmSource || "gemini").trim().toLowerCase();
    const defaultLlmModel = (genSettings.defaultLlmModel || "").trim();

    const sceneGenSource = (genSettings.sceneGenSource || defaultLlmSource || "gemini").trim().toLowerCase();
    const sceneGenStrictSource = Boolean(genSettings.sceneGenStrictSource);
    const sceneGenModel = (genSettings.sceneGenModel || "").trim();
    const sceneGenStrictModel = Boolean(genSettings.sceneGenStrictModel);

    const gemmaBaseUrl = (genSettings.gemmaBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/").trim();
    const openRouterBaseUrl = (genSettings.openRouterBaseUrl || "https://openrouter.ai/api/v1").trim();

    // Model Resolution Logic for Scene Generation
    let configuredModel = "";
    if (sceneGenStrictModel) {
      configuredModel = sceneGenModel || defaultLlmModel;
      if (!configuredModel) {
        throw new Error(
          "Strict Model Mode is enabled for Scene Generation, but no Scene Generation Model or Default LLM Model is configured in Settings."
        );
      }
      logger.log(`[GenerateScenes] Strict Model Mode active. Enforcing model: ${configuredModel}`);
    } else {
      configuredModel = (customModel || sceneGenModel || defaultLlmModel || "").trim();
      if (!configuredModel) {
        throw new Error(
          "No LLM Model configured for scene generation. Please go to Dashboard Settings -> General Settings and configure your Scene Generation Model or Default LLM Model."
        );
      }
      logger.log(`[GenerateScenes] Using resolved model: ${configuredModel}`);
    }

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

    // Source Resolution for Scene Generation
    let executionAccounts = [];
    if (sceneGenStrictSource) {
      executionAccounts = rawLlmAccounts.filter(
        (acc) => (acc.source || "gemini").trim().toLowerCase() === sceneGenSource
      );

      if (executionAccounts.length === 0) {
        throw new Error(
          `Strict Source Mode is active for Scene Generation ('${sceneGenSource}'), but no ${sceneGenSource} accounts were found in Settings -> LLM Accounts. Please add a ${sceneGenSource} account or disable Strict Source Mode.`
        );
      }
      logger.log(`[GenerateScenes] Strict Source Mode active for '${sceneGenSource}'. Filtered to ${executionAccounts.length} account(s).`);
    } else {
      const matchingAccounts = rawLlmAccounts.filter(
        (acc) => (acc.source || "gemini").trim().toLowerCase() === sceneGenSource
      );
      const otherAccounts = rawLlmAccounts.filter(
        (acc) => (acc.source || "gemini").trim().toLowerCase() !== sceneGenSource
      );
      executionAccounts = [...matchingAccounts, ...otherAccounts];
      logger.log(`[GenerateScenes] Prioritizing ${matchingAccounts.length} ${sceneGenSource} account(s), with ${otherAccounts.length} fallback account(s).`);
    }

    // 4. Construct Full Prompt using SceneGenerationPrompt module
    const fullPrompt = getSceneGenerationPrompt({
      channelName: channel.name,
      channelNiche: channel.niche,
      channelSubNiche: channel.sub_niche,
      channelDescription: channel.description,
      channelMission: channel.mission,
      channelImageTheme: visualTheme,
      contentPillarName: pillar?.name || channel.niche || "General Content",
      contentPillarCategoryTag: pillar?.tag || "General",
      contentPillarTone: pillarTone || "Calm, analytical, insightful",
      contentPillarDescription: pillar?.description || channel.description || "In-depth strategic insights and engaging narrative storytelling.",
      tone: pillarTone || "Calm, analytical, insightful",
      useMainCharacter: pillarUseMainCharacter,
      mainCharacterDescription: pillarMainCharacterDescription,
      activeScript,
    });

    // 5. Fallback Loop Across Selected LLM Accounts
    let parsedScenes = null;
    let successfulAccount = null;
    const errors = [];

    // Helper to parse and repair scene JSON
    function parseScenesJson(rawStr) {
      let str = (rawStr || "").trim();

      // Strip <think>...</think> if model output reasoning blocks
      str = str.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      // Strip markdown code fences
      if (str.startsWith("```")) {
        str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      } else if (str.includes("```")) {
        const match = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match && match[1]) {
          str = match[1].trim();
        }
      }

      // Locate JSON array boundaries
      const firstBracket = str.indexOf("[");
      if (firstBracket !== -1) {
        const lastBracket = str.lastIndexOf("]");
        if (lastBracket !== -1 && lastBracket > firstBracket) {
          str = str.slice(firstBracket, lastBracket + 1);
        } else {
          str = str.slice(firstBracket);
        }
      }

      // Direct parse attempt
      try {
        const res = JSON.parse(str);
        if (Array.isArray(res) && res.length > 0) return res;
      } catch (initialErr) {
        // Repair truncated JSON by backing up to last closed scene object "}"
        try {
          const lastCloseBrace = str.lastIndexOf("}");
          if (lastCloseBrace !== -1) {
            const repaired = str.slice(0, lastCloseBrace + 1) + "\n]";
            const sanitized = repaired.replace(/,\s*\]$/, "\n]");
            const res = JSON.parse(sanitized);
            if (Array.isArray(res) && res.length > 0) {
              logger.warn(`[GenerateScenes] Recovered ${res.length} complete scenes from partially truncated response.`);
              return res;
            }
          }
        } catch (repairErr) {
          // Ignore repair error and throw detailed message
        }

        throw new Error(`Failed to parse scene JSON (${initialErr.message}). First 200 chars: ${str.slice(0, 200)}`);
      }

      throw new Error("Model returned JSON that is not a non-empty array of scenes.");
    }

    for (let i = 0; i < executionAccounts.length; i++) {
      const account = executionAccounts[i];
      const accountSource = (account.source || "gemini").trim().toLowerCase();
      const apiToken = (account.apiToken || "").trim();
      const email = account.accountEmail || `Account #${i + 1} (${accountSource})`;

      if (!apiToken) {
        logger.warn(`[GenerateScenes] Skipping account ${email} (${i + 1}/${executionAccounts.length}) due to missing credentials.`);
        errors.push(`${email}: Missing API token`);
        continue;
      }

      const baseURL = accountSource === "openrouter" ? openRouterBaseUrl : gemmaBaseUrl;
      logger.log(`[GenerateScenes] Attempting scene generation with account ${email} via ${accountSource} [${baseURL}] using model ${configuredModel} (${i + 1}/${executionAccounts.length})...`);

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
              content: "You are an expert cinematic storyboard director and AI image prompt engineer. Return ONLY a valid, complete raw JSON array of structured scenes covering the entire script from beginning to end with scene_number, audio_text, image_prompt, and ken_burns. Output NO markdown fences, explanations, reasoning, or commentary.",
            },
            {
              role: "user",
              content: fullPrompt,
            },
          ],
          temperature: 0.4,
        });

        const textResult = completion.choices?.[0]?.message?.content?.trim();

        if (!textResult) {
          throw new Error(`Empty response returned from ${accountSource} for account ${email}.`);
        }

        const parsed = parseScenesJson(textResult);

        // Format and validate scene properties
        parsedScenes = parsed.map((sc, idx) => ({
          scene_number: Number(sc.scene_number || sc.scene_index || idx + 1),
          audio_text: String(sc.audio_text || sc.narration || sc.text || "").trim(),
          image_prompt: String(sc.image_prompt || sc.prompt || sc.visual_prompt || "").trim(),
          transition: String(sc.transition || sc.Transition || "fade").toLowerCase().trim(),
          ken_burns: {
            direction: sc.ken_burns?.direction || "zoom-in",
            intensity: sc.ken_burns?.intensity || 0.10,
          },
        }));

        successfulAccount = `${email} (${accountSource})`;
        logger.log(`[GenerateScenes] Successfully generated and parsed ${parsedScenes.length} scenes using account ${successfulAccount}.`);
        break; // Success! Break out of fallback loop
      } catch (err) {
        logger.warn(`[GenerateScenes] Error using account ${email} (${accountSource}):`, { error: err.message });
        errors.push(`${email} (${accountSource}): ${err.message}`);
      }
    }

    if (!parsedScenes || parsedScenes.length === 0) {
      const aggregateError = `All ${executionAccounts.length} LLM account(s) failed during scene generation:\n${errors.join("\n")}`;
      logger.error("[GenerateScenes] Execution failed for all accounts.", { errors });
      throw new Error(aggregateError);
    }

    // 6. Save the generated scenes JSON in the Neon PostgreSQL database
    logger.log(`[GenerateScenes] Saving ${parsedScenes.length} scenes to Neon PostgreSQL for topic "${topicSlug}"...`);
    await sql`
      UPDATE topics
      SET 
        scenes_json = ${JSON.stringify(parsedScenes)},
        updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    logger.log(`[GenerateScenes] Successfully saved scenes JSON for topic "${topicSlug}".`);

    return {
      success: true,
      channelSlug,
      topicSlug,
      topicId: topic.id,
      topicTitle: topic.title,
      modelUsed: configuredModel,
      accountUsed: successfulAccount,
      sceneCount: parsedScenes.length,
      firstScene: parsedScenes[0] || null,
      lastScene: parsedScenes[parsedScenes.length - 1] || null,
    };
  },
});

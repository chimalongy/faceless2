import { task, logger } from "@trigger.dev/sdk";
import { getDbSql, initDbSchema } from "@/lib/db";

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

    const activeScript = (customScript || topic.script_content || "").trim();
    if (!activeScript) {
      throw new Error(
        "No script found for this topic. Please write or autogenerate a script in the Script tab before generating scenes."
      );
    }

    const visualTheme = (customImageTheme || channel.image_theme || "Cinematic moody documentary, atmospheric volumetric lighting, rich color grading, ultra-high resolution photography and realistic 35mm film textures").trim();

    // 2. Fetch General Settings for Model Selection
    const generalRows = await sql`
      SELECT default_llm_model AS "defaultLlmModel", scene_gen_model AS "sceneGenModel"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    const rawModel = customModel || generalRows?.[0]?.sceneGenModel || generalRows?.[0]?.defaultLlmModel || "@cf/meta/llama-3.1-70b-instruct";

    // Resolve to official Cloudflare Workers AI model URI
    function resolveCloudflareModel(modelStr) {
      if (!modelStr || typeof modelStr !== "string") return "@cf/meta/llama-3.1-70b-instruct";
      const m = modelStr.trim();
      if (m.startsWith("@cf/")) return m;
      if (m.startsWith("cf/")) return `@${m}`;
      if (m.startsWith("@")) return `@cf/${m.slice(1)}`;
      if (m.includes("/")) return `@cf/${m.replace(/^\/+/, "")}`;

      const aliasMap = {
        "kimi": "@cf/moonshotai/kimi-k2.7-code",
        "kimi-k2.7-code": "@cf/moonshotai/kimi-k2.7-code",
        "llama-3.1-70b": "@cf/meta/llama-3.1-70b-instruct",
        "llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct",
        "deepseek-r1": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        "qwen-72b": "@cf/qwen/qwen2.5-72b-instruct",
        "mistral-7b": "@cf/mistral/mistral-7b-instruct-v0.2",
        "gpt-4o": "@cf/meta/llama-3.1-70b-instruct",
        "gpt-4o-mini": "@cf/meta/llama-3.1-8b-instruct",
      };

      return aliasMap[m.toLowerCase()] || "@cf/meta/llama-3.1-70b-instruct";
    }

    const configuredModel = resolveCloudflareModel(rawModel);
    logger.log(`Using scene generation model: ${configuredModel}`);

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

    // 4. Construct Full Prompt
    const fullPrompt = `# PSYCHOLOGY SCRIPT → CINEMATIC SCENE & IMAGE PROMPT GENERATOR

## INPUT

### VISUAL THEME:

[
${visualTheme}
]

### SCRIPT:

[
${activeScript}
]

---

## ROLE

Act as an expert cinematic storyboard director, visual storyteller, psychology-content video director, and AI image prompt engineer.

Your task is to transform the provided psychology script into a chronological sequence of visually compelling scenes for a faceless YouTube video.

The final video will be created entirely from **static AI-generated images**.

Each image will remain on screen while the corresponding \`audio_text\` is spoken as voice-over.

Therefore, your job is to determine:

1. Where the script should naturally divide into visual scenes.
2. What the audience should see during each section of narration.
3. How to visually communicate abstract psychological ideas.
4. How to maintain strong visual continuity throughout the entire video.
5. How to use composition, characters, environments, symbolism, lighting, perspective, and visual storytelling to prevent the video from feeling like a slideshow of unrelated images.

---

# CRITICAL RULE: THE SCRIPT IS THE SOURCE OF TRUTH

The provided SCRIPT is already written.

Do not rewrite it.

Do not improve it.

Do not summarize it.

Do not add new story content.

Do not remove important information.

Do not change the meaning.

Your task is to **visually translate the existing script**.

The \`audio_text\` must contain the exact narration taken from the provided script.

You may divide the original script into appropriate sections, but you must not paraphrase or rewrite the narration.

---

# VISUAL THEME

The provided \`VISUAL THEME\` is the visual identity of the entire video.

Treat it as a strict creative direction.

Every generated image must belong to the same visual world.

The visual theme controls:

* Art style
* Character design
* Character appearance
* Environment design
* Lighting
* Color treatment
* Cinematography
* Mood
* Texture
* Level of realism
* Visual symbolism
* Overall atmosphere

Do not randomly change visual styles between scenes.

If the visual theme specifies a particular artistic style, every scene must follow it.

For example, do NOT create:

* One realistic scene.
* One cartoon scene.
* One anime scene.
* One 3D render.
* One photographic scene.

The entire video must look like it belongs to the same visual universe as described in the visual theme.

---

# CHARACTER CONSISTENCY

When recurring characters appear, maintain visual continuity.

A recurring character should retain the same:

* Gender
* Approximate age
* Skin tone
* Facial structure
* Hair
* Hair color
* Hairstyle
* Body type
* Clothing style
* General appearance

Do not randomly change characters between scenes.

If the script does not require a specific identifiable character, use anonymous or generic characters rather than unnecessarily introducing detailed protagonists.

For scenes involving the same person across multiple moments, make the character visually recognizable as the same person.

---

# VISUAL STORYTELLING PRINCIPLE

Do not simply turn the narration into literal illustrations.

Translate the **meaning and emotional state** of the narration into visual storytelling.

The image should communicate the **psychological experience**, not merely the literal words.

---

# ABSTRACT PSYCHOLOGY → VISUAL METAPHOR

Psychological concepts are often invisible.

When appropriate, use visual metaphors to make them visible (e.g. Overthinking, Isolation, Emotional suppression, Analysis paralysis, Self-doubt, Mental exhaustion).

Use symbolism when it strengthens the narration.

Do not force symbolism into every scene.

---

# SCENE SEGMENTATION

Divide the script into meaningful visual scenes.

Do NOT create one scene for every sentence.

Do NOT create extremely short scenes simply because a sentence ends.

Each scene should contain enough narration to support a meaningful visual moment.

As a general guideline:

* Aim for approximately 2 to 4 short sentences for \`audio_text\` per scene.
* Longer sections may occasionally require more than one scene.
* Shorter sections may occasionally need to remain together.
* Prioritize **visual meaning and narrative flow over a fixed word count**.

---

# AUDIO TEXT

For every scene, provide the exact portion of the original script that should be spoken while that image is displayed.

Rules:

* Use the original wording.
* Do not paraphrase.
* Do not summarize.
* Do not add narration.
* Do not remove meaningful words.
* Preserve the natural chronological order.
* Do not repeat narration between scenes.
* Every part of the script should be assigned to exactly one scene.

The complete script must be covered from beginning to end.

---

# IMAGE PROMPT REQUIREMENTS

Each \`image_prompt\` must be detailed enough for an AI image generator to produce a strong cinematic composition without needing additional explanation.

Describe: SUBJECT, ACTION, ENVIRONMENT, EMOTION, COMPOSITION, CAMERA/PERSPECTIVE, LIGHTING, ATMOSPHERE, VISUAL SYMBOLISM, and DEPTH.

Do NOT put any text, subtitles, headlines, or labels in the image.

---

# KEN BURNS MOVEMENT

For every scene, provide a subtle Ken Burns movement recommendation.

Allowed directions:
* \`zoom-in\`
* \`zoom-out\`
* \`pan-left\`
* \`pan-right\`
* \`pan-up\`
* \`pan-down\`

---

# OUTPUT FORMAT

Return ONLY valid JSON.

Do not include:
* Markdown code fences (e.g. \`\`\`json)
* Explanations
* Commentary
* Additional text before or after the JSON

Use exactly this structure:

[
  {
    "scene_number": 1,
    "audio_text": "Exact narration from the script...",
    "image_prompt": "Detailed cinematic image generation prompt following visual theme...",
    "ken_burns": {
      "direction": "zoom-in"
    }
  },
  {
    "scene_number": 2,
    "audio_text": "Exact narration from the script...",
    "image_prompt": "Detailed cinematic image generation prompt following visual theme...",
    "ken_burns": {
      "direction": "pan-right"
    }
  }
]`;

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
                content: "You are an expert cinematic storyboard director and AI image prompt engineer. Return ONLY a valid, raw JSON array of structured scenes with scene_number, audio_text, image_prompt, and ken_burns. Do not output markdown blocks or conversational text."
              },
              {
                role: "user",
                content: fullPrompt
              }
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

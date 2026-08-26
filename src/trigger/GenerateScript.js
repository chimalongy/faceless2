import { task, logger } from "@trigger.dev/sdk";
import { getDbSql, initDbSchema } from "@/lib/db";

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
        SELECT id, name, slug, tag, description
        FROM content_pillars
        WHERE id = ${topic.pillar_id}
        LIMIT 1;
      `;
      pillar = pillarRows?.[0] || null;
    }

    const topicTitle = topic.title || topicSlug;
    const pillarName = pillar?.name || channel.niche || "General Content";
    const pillarDescription = pillar?.description || channel.description || "In-depth strategic insights and engaging narrative storytelling.";

    // 2. Fetch General Settings for Model Selection
    const generalRows = await sql`
      SELECT default_llm_model AS "defaultLlmModel", script_gen_model AS "scriptGenModel"
      FROM general_settings
      ORDER BY id ASC
      LIMIT 1;
    `;

    let configuredModel = customModel || generalRows?.[0]?.scriptGenModel || generalRows?.[0]?.defaultLlmModel || "@cf/meta/llama-3.3-70b-instruct";
    
    // Normalize to Cloudflare Workers AI model format if OpenAI model name was stored
    if (!configuredModel.startsWith("@cf/")) {
      if (configuredModel.toLowerCase().includes("llama")) {
        configuredModel = "@cf/meta/llama-3.3-70b-instruct";
      } else {
        // Default high-performance Cloudflare model for long-form scripts
        configuredModel = "@cf/meta/llama-3.3-70b-instruct";
      }
    }

    logger.log(`Using script generation model: ${configuredModel}`);

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

    // 4. Construct Prompt
    const fullPrompt = customPrompt || `CONTENT SCRIPT GENERATOR

TITLE / TOPIC:
[${topicTitle}]

ROLE

Act as an expert psychology content strategist, researcher, storyteller, and long-form scriptwriter(at least 20 minutes/ 2500 words).

Your task is to create a highly valuable, engaging, psychologically insightful script based entirely on the TITLE / TOPIC under this content pillar:

[
${pillarName}
Strategic Description:
${pillarDescription}
]

The TITLE / TOPIC is the content direction.

Do not generate a new title.
Do not suggest alternative titles.
Do not rewrite, improve, modify, or evaluate the provided title.
Do not include title generation in your reasoning or output.

Your sole objective is to create the best possible CONTENT and SCRIPT that fulfills the promise, idea, question, or subject contained in the provided TITLE / TOPIC.

CONTENT DEVELOPMENT STRATEGY

Before writing the script, deeply analyze the TITLE / TOPIC to determine:

- The central psychological idea.
- The most compelling angle for exploring it.
- The important questions the audience is likely to have.
- The human experiences and behaviors connected to it.
- The underlying psychological mechanisms.
- Common misconceptions or oversimplifications.
- Hidden, surprising, counterintuitive, or lesser-known insights.
- The emotional relevance of the topic.
- The practical understanding or perspective the audience can gain.

Explore the topic through relevant psychological dimensions such as:

1. IDENTITY AND SELF-PERCEPTION
How does this topic relate to the way people understand themselves, their personality, habits, strengths, weaknesses, or place in the world?

2. HUMAN BEHAVIOR
Why do people think, react, avoid, repeat, fear, desire, or behave in ways connected to this topic?

3. PROBLEMS AND INTERNAL STRUGGLES
What hidden difficulties, conflicts, frustrations, consequences, or emotional struggles are connected to the topic?

4. SOCIAL AND RELATIONSHIP PSYCHOLOGY
Where relevant, explore how the topic affects communication, relationships, trust, boundaries, attraction, conflict, social behavior, or the way people perceive each other.

5. HIDDEN TRUTHS AND MISCONCEPTIONS
Identify surprising, misunderstood, counterintuitive, or deeper aspects of the topic.

6. TRANSFORMATION AND PRACTICAL UNDERSTANDING
Where appropriate, explain how understanding the topic can help someone recognize patterns, change their perspective, make better decisions, or respond differently.

7. CONTRADICTIONS AND PARADOXES
Look for tensions where the obvious explanation is incomplete, misleading, or only part of the truth.

Do not force all of these dimensions into every script.

Select only the angles that naturally deepen and strengthen the content.

SCRIPT OBJECTIVE

The script must do more than define or explain the topic.

It should take the audience on a journey from:

Familiar experience
→ deeper understanding
→ psychological explanation
→ surprising or meaningful insight
→ useful perspective.

The audience should feel:

"This explains something I have experienced."

"I understand myself or other people better now."

"I had never thought about it that way."

"This gives me something useful to take away."

SCRIPT STRUCTURE

1. OPEN WITH A STRONG HOOK

Beginimmediately with a relatable experience, observation, contradiction, question, scenario, or psychological insight connected directly to the TITLE / TOPIC.

The opening should create immediate relevance and curiosity.

Do not begin with:

"Today we are going to talk about..."
"In this video..."
"Welcome back..."
"Have you ever wondered what [TOPIC] is?"

Start inside the experience or problem.

2. ESTABLISH THE CENTRAL IDEA

Clearly introduce the psychological question, problem, behavior, contradiction, or hidden truth that the script will explore.

Show why understanding it matters.

Make the audience want to continue because there is something meaningful still to uncover.

3. DEVELOP THE CONTENT DEEPLY

Organize the script into logical sections that progressively deepen the audience's understanding.

For each major idea:

- Explain what is happening.
- Explore why it happens.
- Connect it to recognizable real-life experiences.
- Explain the relevant psychological mechanisms.
- Use relatable examples, scenarios, analogies, or thought experiments where useful.
- Challenge simplistic assumptions when necessary.
- Add new insight instead of repeating the same point differently.

Do not create a shallow list of facts.

Every section must contribute something meaningful to the central subject.

4. BUILD DEPTH AND ESCALATION

Do not reveal every important insight immediately.

Allow the script to gradually move from obvious or familiar observations toward deeper, more surprising, uncomfortable, counterintuitive, or meaningful insights.

The content should feel connected and progressive.

Each major section should naturally lead to the next.

5. INCLUDE PRACTICAL VALUE WHERE APPROPRIATE

When relevant, help the audience:

- Recognize patterns in themselves.
- Better understand other people.
- Notice unhealthy or unhelpful behaviors.
- Develop a healthier perspective.
- Respond differently in difficult situations.
- Make better decisions.
- Apply the psychological insight in everyday life.

Do not force generic self-help advice into the script.

Practical insights must emerge naturally from the topic and explanation.

6. END WITH A STRONG FINAL INSIGHT

End with a meaningful conclusion that expands, reframes, or deepens the audience's understanding of the original TITLE / TOPIC.

Do not simply summarize everything.

Leave the audience with a memorable realization, perspective, or thought that feels earned by the journey of the script.

WRITING STYLE

Write in a:

- Clear and conversational style.
- Intellectually engaging style.
- Psychologically insightful style.
- Emotionally intelligent style.
- Calm and confident tone.
- Accessible style that explains complex ideas simply.

Avoid unnecessary academic jargon.

If a psychological concept or term is useful, explain it naturally and clearly.

Use everyday situations when relevant, including:

- Conversations
- Relationships
- Work
- Family
- Social interactions
- Internal thoughts
- Decision-making
- Conflict
- Failure
- Success
- Isolation
- Personal habits
- Fear
- Confidence
- Emotional reactions

RETENTION PRINCIPLES

Maintain engagement throughout the script by:

- Raising meaningful questions before answering them.
- Moving from familiar experiences to deeper explanations.
- Introducing new insights progressively.
- Using relatable examples.
- Exploring contradictions and unexpected connections.
- Connecting abstract psychology to real human behavior.
- Avoiding repetition and filler.
- Ensuring each section provides new value.

Do not use artificial engagement phrases such as:

"But wait, there's more."
"Here comes the shocking part."
"You won't believe what happens next."

Curiosity must come naturally from the quality and progression of the ideas.

ACCURACY AND RESPONSIBILITY

Do not present speculation as established scientific fact.

Do not diagnose the audience.

Avoid absolute statements and unnecessary overgeneralizations.

Avoid unsupported claims such as:

"All intelligent people..."
"People who do this always..."
"If you behave this way, it means..."

Use nuanced language where appropriate, such as:

"People may..."
"This can sometimes..."
"One possible explanation is..."
"Research suggests..."

Prioritize psychological accuracy while keeping the content understandable and engaging.

ORIGINALITY

Create an original script based on the provided TITLE / TOPIC.

Do not imitate, copy, paraphrase, or reproduce another creator's script or distinctive wording.

OUTPUT FORMAT

Return only:

CORE CONTENT ANGLE:
[A brief statement describing the psychological perspective used to develop the provided TITLE / TOPIC.]

SCRIPT:

[Write the complete, polished, engaging script.]

FINAL INSTRUCTION

The provided TITLE / TOPIC already defines what the content should be about.

Do not spend effort generating or suggesting titles.

Focus entirely on creating the strongest possible content around the provided subject.

Explore the topic beyond the obvious.

Prioritize psychological depth, real human relevance, clarity, originality, useful insight, emotional connection, and strong storytelling.

The final script should fully deliver on the expectation created by the TITLE / TOPIC and leave the audience with a deeper understanding of themselves, other people, or human behavior.`;

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
                content: "You are an expert psychology content strategist, researcher, storyteller, and long-form scriptwriter. Create an in-depth, immersive, highly engaging teleprompter script adhering strictly to user instructions."
              },
              {
                role: "user",
                content: fullPrompt
              }
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

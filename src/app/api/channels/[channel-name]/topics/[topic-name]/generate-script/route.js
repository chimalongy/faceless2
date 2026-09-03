import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";
import { getDbSql } from "@/lib/db";
import { getScriptGenerationSystemPrompt } from "@/lib/LLMPrompts/ScriptGenerationPrompt";

export async function POST(req, context) {
  try {
    const params = await context.params;
    const channelSlug = params?.["channel-name"];
    const topicSlug = params?.["topic-name"];

    if (!channelSlug || !topicSlug) {
      return NextResponse.json(
        { error: "channelSlug and topicSlug are required" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { customModel, customPrompt } = body;

    // Upfront validation of channel, topic, and pillar configuration
    const sql = getDbSql();
    if (sql) {
      const channelRows = await sql`
        SELECT id, name, niche, sub_niche, description, mission
        FROM channels
        WHERE slug = ${channelSlug}
        LIMIT 1;
      `;
      if (!channelRows || channelRows.length === 0) {
        return NextResponse.json(
          { error: `Channel not found with slug "${channelSlug}".` },
          { status: 404 }
        );
      }
      const channel = channelRows[0];

      const topicRows = await sql`
        SELECT id, pillar_id, title
        FROM topics
        WHERE slug = ${topicSlug} AND channel_id = ${channel.id}
        LIMIT 1;
      `;
      if (!topicRows || topicRows.length === 0) {
        return NextResponse.json(
          { error: `Topic not found with slug "${topicSlug}".` },
          { status: 404 }
        );
      }
      const topic = topicRows[0];

      let pillar = null;
      if (topic.pillar_id) {
        const pillarRows = await sql`
          SELECT id, name, tag, description, tone, content_length AS "contentLength", content_words_count AS "contentWordsCount"
          FROM content_pillars
          WHERE id = ${topic.pillar_id}
          LIMIT 1;
        `;
        pillar = pillarRows?.[0] || null;
      }

      if (!pillar) {
        return NextResponse.json(
          { error: "Cannot generate script. This topic is not linked to any Content Pillar. Please assign a Content Pillar to this topic before generating a script." },
          { status: 400 }
        );
      }

      try {
        getScriptGenerationSystemPrompt({
          channelName: channel.name,
          channelNiche: channel.niche,
          channelSubNiche: channel.sub_niche,
          channelDescription: channel.description,
          channelMission: channel.mission,
          contentPillarName: pillar.name,
          contentPillarCategoryTag: pillar.tag,
          contentPillarTone: pillar.tone,
          contentPillarLength: pillar.contentLength,
          contentPillarWordsCount: pillar.contentWordsCount,
          contentPillarDescription: pillar.description,
          topic: (topic.title || "").trim(),
        });
      } catch (valErr) {
        return NextResponse.json({ error: valErr.message }, { status: 400 });
      }
    }

    console.log(`[GenerateScriptRoute] Triggering Trigger.dev task "generate-script" for "${channelSlug}/${topicSlug}"...`);

    const handle = await tasks.trigger("generate-script", {
      channelSlug,
      topicSlug,
      customModel,
      customPrompt,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

    if (run.status !== "COMPLETED") {
      console.error("[GenerateScriptRoute] Trigger.dev script run failed:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Script generation task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    return NextResponse.json({
      success: true,
      scriptContent: output.scriptContent,
      wordCount: output.wordCount,
      accountUsed: output.accountUsed,
      modelUsed: output.modelUsed,
      topicSlug: output.topicSlug,
      channelSlug: output.channelSlug,
    });
  } catch (error) {
    console.error("[GenerateScriptRoute] Error dispatching Trigger.dev script task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger script generation task." },
      { status: 500 }
    );
  }
}

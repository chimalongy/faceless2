import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";
import { getDbSql } from "@/lib/db";
import { getSceneGenerationPrompt } from "@/lib/LLMPrompts/SceneGenerationPrompt";

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
    const { customModel, customScript, customImageTheme } = body;

    // Upfront validation of channel, topic, and pillar configuration
    const sql = getDbSql();
    if (sql) {
      const channelRows = await sql`
        SELECT id, name, niche, sub_niche, description, mission, image_theme
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
        SELECT id, pillar_id, script_content
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
          SELECT id, name, tag, description, tone, use_main_character AS "useMainCharacter", main_character_description AS "mainCharacterDescription"
          FROM content_pillars
          WHERE id = ${topic.pillar_id}
          LIMIT 1;
        `;
        pillar = pillarRows?.[0] || null;
      }

      if (!pillar) {
        return NextResponse.json(
          { error: "Cannot generate scenes. This topic is not linked to any Content Pillar. Please assign a Content Pillar to this topic before generating scenes." },
          { status: 400 }
        );
      }

      try {
        getSceneGenerationPrompt({
          channelName: channel.name,
          channelNiche: channel.niche,
          channelSubNiche: channel.sub_niche,
          channelDescription: channel.description,
          channelMission: channel.mission,
          channelImageTheme: customImageTheme || channel.image_theme,
          contentPillarName: pillar.name,
          contentPillarCategoryTag: pillar.tag,
          contentPillarTone: pillar.tone,
          contentPillarDescription: pillar.description,
          useMainCharacter: Boolean(pillar.useMainCharacter),
          mainCharacterDescription: pillar.mainCharacterDescription,
          activeScript: (customScript || topic.script_content || "").trim(),
        });
      } catch (valErr) {
        return NextResponse.json({ error: valErr.message }, { status: 400 });
      }
    }

    console.log(`[GenerateScenesRoute] Triggering Trigger.dev task "generate-scenes" for "${channelSlug}/${topicSlug}"...`);

    const handle = await tasks.trigger("generate-scenes", {
      channelSlug,
      topicSlug,
      customModel,
      customScript,
      customImageTheme,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

    if (run.status !== "COMPLETED") {
      console.error("[GenerateScenesRoute] Trigger.dev scenes run failed:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Scene generation task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    return NextResponse.json({
      success: true,
      scenes: output.scenes,
      totalScenes: output.totalScenes,
      accountUsed: output.accountUsed,
      modelUsed: output.modelUsed,
      topicSlug: output.topicSlug,
      channelSlug: output.channelSlug,
    });
  } catch (error) {
    console.error("[GenerateScenesRoute] Error dispatching Trigger.dev scenes task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger scene generation task." },
      { status: 500 }
    );
  }
}

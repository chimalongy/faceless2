import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET /api/channels/[channel-name]/topics - List topics for a channel
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const { searchParams } = new URL(request.url);
    const pillarSlug = searchParams.get("pillar");

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ topics: [] });
    }

    await initDbSchema();

    let topics = [];
    if (pillarSlug && pillarSlug !== "All") {
      topics = await sql`
        SELECT 
          t.id,
          t.channel_id AS "channelId",
          c.slug AS "channelSlug",
          t.pillar_id AS "pillarId",
          cp.slug AS "pillarSlug",
          cp.name AS "pillarName",
          cp.description AS "pillarDescription",
          cp.tone AS "pillarTone",
          cp.use_main_character AS "pillarUseMainCharacter",
          cp.main_character_description AS "pillarMainCharacterDescription",
          t.title,
          t.slug,
          t.script_content AS "scriptContent",
          t.story_description AS "storyDescription",
          t.scenes_json AS "scenesJson",
          t.thumbnail_url AS "thumbnailUrl",
          t.thumbnail_prompt AS "thumbnailPrompt",
          t.master_video_url AS "masterVideoUrl",
          t.youtube_video_id AS "youtubeVideoId",
          t.youtube_url AS "youtubeUrl",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt"
        FROM topics t
        JOIN channels c ON c.id = t.channel_id
        LEFT JOIN content_pillars cp ON cp.id = t.pillar_id
        WHERE c.slug = ${channelSlug} AND cp.slug = ${pillarSlug}
        ORDER BY t.created_at DESC;
      `;
    } else {
      topics = await sql`
        SELECT 
          t.id,
          t.channel_id AS "channelId",
          c.slug AS "channelSlug",
          t.pillar_id AS "pillarId",
          cp.slug AS "pillarSlug",
          cp.name AS "pillarName",
          cp.description AS "pillarDescription",
          cp.tone AS "pillarTone",
          cp.use_main_character AS "pillarUseMainCharacter",
          cp.main_character_description AS "pillarMainCharacterDescription",
          t.title,
          t.slug,
          t.script_content AS "scriptContent",
          t.story_description AS "storyDescription",
          t.scenes_json AS "scenesJson",
          t.thumbnail_url AS "thumbnailUrl",
          t.thumbnail_prompt AS "thumbnailPrompt",
          t.master_video_url AS "masterVideoUrl",
          t.youtube_video_id AS "youtubeVideoId",
          t.youtube_url AS "youtubeUrl",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt"
        FROM topics t
        JOIN channels c ON c.id = t.channel_id
        LEFT JOIN content_pillars cp ON cp.id = t.pillar_id
        WHERE c.slug = ${channelSlug}
        ORDER BY t.created_at DESC;
      `;
    }

    return NextResponse.json({ topics: topics || [] });
  } catch (error) {
    console.error("Error fetching topics:", error);
    return NextResponse.json(
      { error: "Failed to fetch topics", topics: [] },
      { status: 500 }
    );
  }
}

// POST /api/channels/[channel-name]/topics - Create one or multiple topics at once
export async function POST(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured in .env" },
        { status: 503 }
      );
    }

    await initDbSchema();

    // Get channel_id
    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    const body = await request.json();

    // Extract list of titles (supports single title, array of titles, or multiline text string)
    let titlesList = [];
    if (Array.isArray(body.titles)) {
      titlesList = body.titles.map((t) => (typeof t === "string" ? t.trim() : t.title?.trim())).filter(Boolean);
    } else if (Array.isArray(body.topics)) {
      titlesList = body.topics.map((t) => (typeof t === "string" ? t.trim() : t.title?.trim())).filter(Boolean);
    } else if (typeof body.title === "string") {
      // Split by newlines in case user pasted multiple lines into single input
      titlesList = body.title
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    if (titlesList.length === 0) {
      return NextResponse.json(
        { error: "At least one topic name is required" },
        { status: 400 }
      );
    }

    // Resolve pillar_id if pillarSlug or pillar is provided
    let pillarId = null;
    const targetPillar = body.pillarSlug || body.pillar;
    if (targetPillar) {
      const pRows = await sql`
        SELECT id FROM content_pillars
        WHERE channel_id = ${channelId} AND (slug = ${targetPillar} OR name = ${targetPillar})
        LIMIT 1;
      `;
      if (pRows && pRows.length > 0) {
        pillarId = pRows[0].id;
      }
    }

    const insertedTopics = [];

    for (const title of titlesList) {
      const slug = toSlug(title) || `topic-${Date.now()}`;
      const scriptContent = body.scriptContent || "";
      const scenesJson = body.scenesJson ? JSON.stringify(body.scenesJson) : null;
      const thumbnailUrl = body.thumbnailUrl || null;
      const thumbnailPrompt = body.thumbnailPrompt || null;
      const masterVideoUrl = body.masterVideoUrl || null;

      const inserted = await sql`
        INSERT INTO topics (
          channel_id,
          pillar_id,
          title,
          slug,
          script_content,
          scenes_json,
          thumbnail_url,
          thumbnail_prompt,
          master_video_url
        ) VALUES (
          ${channelId},
          ${pillarId},
          ${title},
          ${slug},
          ${scriptContent},
          ${scenesJson}::jsonb,
          ${thumbnailUrl},
          ${thumbnailPrompt},
          ${masterVideoUrl}
        )
        ON CONFLICT (channel_id, slug) DO UPDATE SET
          title = EXCLUDED.title,
          pillar_id = EXCLUDED.pillar_id,
          updated_at = NOW()
        RETURNING *;
      `;

      if (inserted && inserted.length > 0) {
        insertedTopics.push(inserted[0]);
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedTopics.length,
      topics: insertedTopics,
      topic: insertedTopics[0],
    });
  } catch (error) {
    console.error("Error creating topic(s):", error);
    return NextResponse.json(
      { error: error.message || "Failed to create topic(s)" },
      { status: 500 }
    );
  }
}

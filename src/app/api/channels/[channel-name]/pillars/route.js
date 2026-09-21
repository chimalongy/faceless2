import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name]/pillars - List all pillars for a channel
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ pillars: [] });
    }

    await initDbSchema();

    const pillars = await sql`
      SELECT 
        cp.id,
        cp.channel_id AS "channelId",
        c.slug AS "channelSlug",
        cp.name,
        cp.slug,
        cp.tag,
        cp.description,
        cp.tone,
        cp.content_length AS "contentLength",
        cp.content_words_count AS "contentWordsCount",
        cp.use_main_character AS "useMainCharacter",
        cp.main_character_description AS "mainCharacterDescription",
        cp.created_at AS "createdAt",
        cp.updated_at AS "updatedAt"
      FROM content_pillars cp
      JOIN channels c ON c.id = cp.channel_id
      WHERE c.slug = ${channelSlug}
      ORDER BY cp.created_at ASC;
    `;

    return NextResponse.json({ pillars: pillars || [] });
  } catch (error) {
    console.error("Error fetching pillars:", error);
    return NextResponse.json(
      { error: "Failed to fetch pillars", pillars: [] },
      { status: 500 }
    );
  }
}

// POST /api/channels/[channel-name]/pillars - Create a new pillar
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
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Pillar name is required" },
        { status: 400 }
      );
    }

    const slug =
      body.slug?.trim() ||
      name
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const tag = body.tag?.trim() || "";
    const description = body.description?.trim() || "";
    const tone = body.tone?.trim() || "";
    const contentLength = body.contentLength?.trim() || body.content_length?.trim() || "";
    const contentWordsCount = body.contentWordsCount?.trim() || body.content_words_count?.trim() || body.wordsCount?.trim() || body.wordCount?.trim() || "";
    const useMainCharacter = Boolean(body.useMainCharacter ?? body.use_main_character);
    const mainCharacterDescription = body.mainCharacterDescription?.trim() || body.main_character_description?.trim() || "";

    const inserted = await sql`
      INSERT INTO content_pillars (
        channel_id,
        name,
        slug,
        tag,
        description,
        tone,
        content_length,
        content_words_count,
        use_main_character,
        main_character_description
      ) VALUES (
        ${channelId},
        ${name},
        ${slug},
        ${tag},
        ${description},
        ${tone},
        ${contentLength},
        ${contentWordsCount},
        ${useMainCharacter},
        ${mainCharacterDescription}
      )
      ON CONFLICT (channel_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        tag = EXCLUDED.tag,
        description = EXCLUDED.description,
        tone = EXCLUDED.tone,
        content_length = EXCLUDED.content_length,
        content_words_count = EXCLUDED.content_words_count,
        use_main_character = EXCLUDED.use_main_character,
        main_character_description = EXCLUDED.main_character_description,
        updated_at = NOW()
      RETURNING *;
    `;

    return NextResponse.json({ pillar: inserted[0] });
  } catch (error) {
    console.error("Error creating pillar:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create pillar" },
      { status: 500 }
    );
  }
}

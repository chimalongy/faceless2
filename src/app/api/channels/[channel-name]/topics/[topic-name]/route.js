import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name]/topics/[topic-name] - Fetch single topic with studio details
export async function GET(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ topic: null }, { status: 404 });
    }

    await initDbSchema();

    const topics = await sql`
      SELECT 
        t.id,
        t.channel_id AS "channelId",
        c.slug AS "channelSlug",
        c.name AS "channelName",
        c.image_theme AS "channelImageTheme",
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
        t.scenes_json AS "scenesJson",
        t.thumbnail_url AS "thumbnailUrl",
        t.thumbnail_prompt AS "thumbnailPrompt",
        t.master_video_url AS "masterVideoUrl",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM topics t
      JOIN channels c ON c.id = t.channel_id
      LEFT JOIN content_pillars cp ON cp.id = t.pillar_id
      WHERE c.slug = ${channelSlug} AND t.slug = ${topicSlug}
      LIMIT 1;
    `;

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: "Topic not found", topic: null }, { status: 404 });
    }

    const topic = topics[0];

    // Fetch associated assets (audio files, scene frames, images, master cuts)
    const assets = await sql`
      SELECT 
        id,
        topic_id AS "topicId",
        channel_id AS "channelId",
        asset_type AS "assetType",
        scene_index AS "sceneIndex",
        file_url AS "fileUrl",
        file_key AS "fileKey",
        file_name AS "fileName",
        mime_type AS "mimeType"
      FROM topic_assets
      WHERE topic_id = ${topic.id}
      ORDER BY created_at ASC;
    `;

    return NextResponse.json({
      topic: {
        ...topic,
        assets: assets || [],
      },
    });
  } catch (error) {
    console.error("Error fetching topic:", error);
    return NextResponse.json(
      { error: "Failed to fetch topic", topic: null },
      { status: 500 }
    );
  }
}

// PUT /api/channels/[channel-name]/topics/[topic-name] - Save and update topic studio state
export async function PUT(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured in .env" },
        { status: 503 }
      );
    }

    await initDbSchema();

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    const body = await request.json();
    const title = body.title?.trim();
    const scenesJson = body.scenesJson ? JSON.stringify(body.scenesJson) : null;

    let pillarId = undefined;
    if (body.pillarSlug || body.pillar) {
      const targetPillar = body.pillarSlug || body.pillar;
      const pRows = await sql`
        SELECT id FROM content_pillars
        WHERE channel_id = ${channelId} AND (slug = ${targetPillar} OR name = ${targetPillar})
        LIMIT 1;
      `;
      if (pRows && pRows.length > 0) {
        pillarId = pRows[0].id;
      }
    }

    const updated = await sql`
      UPDATE topics
      SET
        title = COALESCE(${title}, title),
        pillar_id = COALESCE(${pillarId}, pillar_id),
        script_content = COALESCE(${body.scriptContent}, script_content),
        scenes_json = COALESCE(${scenesJson}::jsonb, scenes_json),
        thumbnail_url = COALESCE(${body.thumbnailUrl}, thumbnail_url),
        thumbnail_prompt = COALESCE(${body.thumbnailPrompt}, thumbnail_prompt),
        master_video_url = COALESCE(${body.masterVideoUrl}, master_video_url),
        updated_at = NOW()
      WHERE channel_id = ${channelId} AND slug = ${topicSlug}
      RETURNING *;
    `;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    return NextResponse.json({ topic: updated[0] });
  } catch (error) {
    console.error("Error updating topic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update topic" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[channel-name]/topics/[topic-name] - Delete topic and all its uploaded files in Cloudflare R2
export async function DELETE(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured in .env" },
        { status: 503 }
      );
    }

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    // 1. Fetch all asset keys for this topic before deleting from DB
    const assetRows = await sql`
      SELECT ta.file_key 
      FROM topic_assets ta
      JOIN topics t ON t.id = ta.topic_id
      WHERE t.channel_id = ${channelId} AND t.slug = ${topicSlug};
    `;

    const keysToDelete = (assetRows || []).map((r) => r.file_key).filter(Boolean);

    // 2. Delete all physical files from Cloudflare R2 bucket
    if (keysToDelete.length > 0) {
      try {
        const { deleteMultipleFromR2 } = await import("@/lib/storage");
        await deleteMultipleFromR2(keysToDelete);
      } catch (r2Err) {
        console.warn("Could not delete some files from R2:", r2Err);
      }
    }

    // 3. Delete topic from DB (cascades to topic_assets records)
    await sql`
      DELETE FROM topics
      WHERE channel_id = ${channelId} AND slug = ${topicSlug};
    `;

    return NextResponse.json({
      success: true,
      deletedTopic: topicSlug,
      deletedFilesCount: keysToDelete.length,
    });
  } catch (error) {
    console.error("Error deleting topic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete topic" },
      { status: 500 }
    );
  }
}

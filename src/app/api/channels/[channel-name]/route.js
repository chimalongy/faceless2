import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name] - Fetch single channel by slug
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ channel: null }, { status: 404 });
    }

    await initDbSchema();

    const channels = await sql`
      SELECT 
        id,
        name,
        slug,
        handle,
        channel_url AS "channelUrl",
        description,
        tagline,
        niche,
        sub_niche AS "subNiche",
        content_category AS "contentCategory",
        target_audience AS "targetAudience",
        mission,
        value_proposition AS "valueProposition",
        personality,
        brand_positioning AS "brandPositioning",
        brand_promise AS "brandPromise",
        image_theme AS "imageTheme",
        thumbnail_theme AS "thumbnailTheme",
        audio_theme AS "audioTheme",
        banner_url AS "bannerUrl",
        avatar_url AS "avatarUrl",
        default_voice AS "defaultVoice",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: "Channel not found", channel: null }, { status: 404 });
    }

    return NextResponse.json({ channel: channels[0] });
  } catch (error) {
    console.error("Error fetching channel:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel", channel: null },
      { status: 500 }
    );
  }
}

// PUT /api/channels/[channel-name] - Update channel fields
export async function PUT(request, { params }) {
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
    const body = await request.json();

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE channels
      SET
        name = ${name},
        handle = ${body.handle || null},
        channel_url = ${body.channelUrl || null},
        description = ${body.description || null},
        tagline = ${body.tagline || null},
        niche = ${body.niche || null},
        sub_niche = ${body.subNiche || null},
        content_category = ${body.contentCategory || null},
        target_audience = ${body.targetAudience || null},
        mission = ${body.mission || null},
        value_proposition = ${body.valueProposition || null},
        personality = ${body.personality || null},
        brand_positioning = ${body.brandPositioning || null},
        brand_promise = ${body.brandPromise || null},
        image_theme = ${body.imageTheme || null},
        thumbnail_theme = ${body.thumbnailTheme || null},
        audio_theme = ${body.audioTheme || null},
        banner_url = ${body.bannerUrl !== undefined ? body.bannerUrl : null},
        avatar_url = ${body.avatarUrl !== undefined ? body.avatarUrl : null},
        default_voice = ${body.defaultVoice || 'af_heart'},
        status = ${body.status || 'Active'},
        updated_at = NOW()
      WHERE slug = ${channelSlug}
      RETURNING *;
    `;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json({ channel: updated[0] });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update channel" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[channel-name] - Delete a channel and all its Cloudflare R2 media assets
export async function DELETE(request, { params }) {
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

    // 1. Fetch all asset keys for this channel from topic_assets before deleting
    const assetRows = await sql`
      SELECT ta.file_key 
      FROM topic_assets ta
      JOIN channels c ON c.id = ta.channel_id
      WHERE c.slug = ${channelSlug};
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

    // 3. Delete channel from database (cascades to pillars, topics, and topic_assets)
    await sql`
      DELETE FROM channels
      WHERE slug = ${channelSlug};
    `;

    return NextResponse.json({
      success: true,
      deletedSlug: channelSlug,
      deletedFilesCount: keysToDelete.length,
    });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete channel" },
      { status: 500 }
    );
  }
}

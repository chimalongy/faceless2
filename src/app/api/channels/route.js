import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels - Fetch all channels from Neon Postgres
export async function GET() {
  try {
    const sql = getDbSql();
    if (!sql) {
      // If DATABASE_URL is not yet set in .env, return empty array cleanly
      return NextResponse.json({ channels: [] });
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
        audio_theme AS "audioTheme",
        banner_url AS "bannerUrl",
        avatar_url AS "avatarUrl",
        default_voice AS "defaultVoice",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM channels
      ORDER BY created_at DESC;
    `;

    return NextResponse.json({ channels: channels || [] });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels", channels: [] },
      { status: 500 }
    );
  }
}

// POST /api/channels - Create a new channel in Neon Postgres
export async function POST(request) {
  try {
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

    const slug =
      body.slug?.trim() ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const handle = body.handle?.trim() || `@${slug.replace(/-/g, "")}`;
    const channelUrl = body.channelUrl?.trim() || `https://youtube.com/${handle}`;
    const description = body.description?.trim() || "";
    const tagline = body.tagline?.trim() || "";
    const niche = body.niche?.trim() || "";
    const subNiche = body.subNiche?.trim() || "";
    const contentCategory = body.contentCategory?.trim() || "";
    const targetAudience = body.targetAudience?.trim() || "";
    const mission = body.mission?.trim() || "";
    const valueProposition = body.valueProposition?.trim() || "";
    const personality = body.personality?.trim() || "";
    const brandPositioning = body.brandPositioning?.trim() || "";
    const brandPromise = body.brandPromise?.trim() || "";
    const imageTheme = body.imageTheme?.trim() || "";
    const thumbnailTheme = body.thumbnailTheme?.trim() || "";
    const audioTheme = body.audioTheme?.trim() || "";
    const status = body.status || "Active";

    const inserted = await sql`
      INSERT INTO channels (
        name,
        slug,
        handle,
        channel_url,
        description,
        tagline,
        niche,
        sub_niche,
        content_category,
        target_audience,
        mission,
        value_proposition,
        personality,
        brand_positioning,
        brand_promise,
        image_theme,
        thumbnail_theme,
        audio_theme,
        default_voice,
        status
      ) VALUES (
        ${name},
        ${slug},
        ${handle},
        ${channelUrl},
        ${description},
        ${tagline},
        ${niche},
        ${subNiche},
        ${contentCategory},
        ${targetAudience},
        ${mission},
        ${valueProposition},
        ${personality},
        ${brandPositioning},
        ${brandPromise},
        ${imageTheme},
        ${thumbnailTheme},
        ${audioTheme},
        ${body.defaultVoice || 'af_heart'},
        ${status}
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        handle = EXCLUDED.handle,
        channel_url = EXCLUDED.channel_url,
        description = EXCLUDED.description,
        tagline = EXCLUDED.tagline,
        niche = EXCLUDED.niche,
        sub_niche = EXCLUDED.sub_niche,
        content_category = EXCLUDED.content_category,
        target_audience = EXCLUDED.target_audience,
        mission = EXCLUDED.mission,
        value_proposition = EXCLUDED.value_proposition,
        personality = EXCLUDED.personality,
        brand_positioning = EXCLUDED.brand_positioning,
        brand_promise = EXCLUDED.brand_promise,
        image_theme = EXCLUDED.image_theme,
        thumbnail_theme = EXCLUDED.thumbnail_theme,
        audio_theme = EXCLUDED.audio_theme,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *;
    `;

    return NextResponse.json({ channel: inserted[0] });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create channel" },
      { status: 500 }
    );
  }
}

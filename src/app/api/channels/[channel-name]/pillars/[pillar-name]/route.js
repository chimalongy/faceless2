import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name]/pillars/[pillar-name] - Fetch single pillar
export async function GET(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const pillarSlug = rawParams?.["pillar-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ pillar: null }, { status: 404 });
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
        cp.created_at AS "createdAt",
        cp.updated_at AS "updatedAt"
      FROM content_pillars cp
      JOIN channels c ON c.id = cp.channel_id
      WHERE c.slug = ${channelSlug} AND cp.slug = ${pillarSlug}
      LIMIT 1;
    `;

    if (!pillars || pillars.length === 0) {
      return NextResponse.json({ error: "Pillar not found", pillar: null }, { status: 404 });
    }

    return NextResponse.json({ pillar: pillars[0] });
  } catch (error) {
    console.error("Error fetching pillar:", error);
    return NextResponse.json(
      { error: "Failed to fetch pillar", pillar: null },
      { status: 500 }
    );
  }
}

// PUT /api/channels/[channel-name]/pillars/[pillar-name] - Update pillar
export async function PUT(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const pillarSlug = rawParams?.["pillar-name"] || "";

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
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Pillar name is required" },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE content_pillars
      SET
        name = ${name},
        tag = ${body.tag || null},
        description = ${body.description || null},
        updated_at = NOW()
      WHERE channel_id = ${channelId} AND slug = ${pillarSlug}
      RETURNING *;
    `;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
    }

    return NextResponse.json({ pillar: updated[0] });
  } catch (error) {
    console.error("Error updating pillar:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update pillar" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[channel-name]/pillars/[pillar-name] - Delete pillar
export async function DELETE(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const pillarSlug = rawParams?.["pillar-name"] || "";

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

    await sql`
      DELETE FROM content_pillars
      WHERE channel_id = ${channelId} AND slug = ${pillarSlug};
    `;

    return NextResponse.json({ success: true, deletedPillar: pillarSlug });
  } catch (error) {
    console.error("Error deleting pillar:", error);
    return NextResponse.json(
      { error: "Failed to delete pillar" },
      { status: 500 }
    );
  }
}

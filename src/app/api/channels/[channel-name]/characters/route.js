import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name]/characters - List all characters for a channel
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ characters: [] });
    }

    await initDbSchema();

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ characters: [] });
    }
    const channelId = channelRows[0].id;

    let characters = await sql`
      SELECT 
        id,
        channel_id AS "channelId",
        name,
        physical_spec AS "physicalSpec",
        signature_feature AS "signatureFeature",
        wardrobe,
        is_main AS "isMain",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM channel_characters
      WHERE channel_id = ${channelId}
      ORDER BY is_main DESC, created_at ASC;
    `;

    // Auto-seed "The Observer" for moneykoncepts if empty
    if ((!characters || characters.length === 0) && channelSlug.toLowerCase() === "moneykoncepts") {
      const seeded = await sql`
        INSERT INTO channel_characters (
          channel_id,
          name,
          physical_spec,
          signature_feature,
          wardrobe,
          is_main
        ) VALUES (
          ${channelId},
          'The Observer',
          'Lean young adult White male with fair skin, clean-shaven, tousled messy dark-brown/black hair, athletic slim build, stoic calm expression',
          'Signature round amber-tinted glasses',
          'Burnt-orange button-down overshirt over a charcoal T-shirt, dark trousers, and simple sneakers',
          TRUE
        )
        RETURNING 
          id,
          channel_id AS "channelId",
          name,
          physical_spec AS "physicalSpec",
          signature_feature AS "signatureFeature",
          wardrobe,
          is_main AS "isMain",
          created_at AS "createdAt",
          updated_at AS "updatedAt";
      `;
      characters = seeded;
    }

    return NextResponse.json({ characters: characters || [] });
  } catch (error) {
    console.error("Error fetching characters:", error);
    return NextResponse.json({ error: error.message, characters: [] }, { status: 500 });
  }
}

// POST /api/channels/[channel-name]/characters - Create a new character
export async function POST(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
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
      return NextResponse.json({ error: "Character name is required" }, { status: 400 });
    }

    const physicalSpec = body.physicalSpec?.trim() || body.physical_spec?.trim() || "";
    const signatureFeature = body.signatureFeature?.trim() || body.signature_feature?.trim() || "";
    const wardrobe = body.wardrobe?.trim() || "";
    const isMain = Boolean(body.isMain ?? body.is_main);

    // If marked as main, unset is_main on other characters for this channel
    if (isMain) {
      await sql`
        UPDATE channel_characters
        SET is_main = FALSE
        WHERE channel_id = ${channelId};
      `;
    }

    const inserted = await sql`
      INSERT INTO channel_characters (
        channel_id,
        name,
        physical_spec,
        signature_feature,
        wardrobe,
        is_main
      ) VALUES (
        ${channelId},
        ${name},
        ${physicalSpec},
        ${signatureFeature},
        ${wardrobe},
        ${isMain}
      )
      RETURNING
        id,
        channel_id AS "channelId",
        name,
        physical_spec AS "physicalSpec",
        signature_feature AS "signatureFeature",
        wardrobe,
        is_main AS "isMain",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    return NextResponse.json({ character: inserted[0] });
  } catch (error) {
    console.error("Error creating character:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/channels/[channel-name]/characters - Update a character
export async function PUT(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    const body = await request.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Character name is required" }, { status: 400 });
    }

    const physicalSpec = body.physicalSpec?.trim() || body.physical_spec?.trim() || "";
    const signatureFeature = body.signatureFeature?.trim() || body.signature_feature?.trim() || "";
    const wardrobe = body.wardrobe?.trim() || "";
    const isMain = Boolean(body.isMain ?? body.is_main);

    if (isMain) {
      await sql`
        UPDATE channel_characters
        SET is_main = FALSE
        WHERE channel_id = ${channelId} AND id != ${id};
      `;
    }

    const updated = await sql`
      UPDATE channel_characters
      SET
        name = ${name},
        physical_spec = ${physicalSpec},
        signature_feature = ${signatureFeature},
        wardrobe = ${wardrobe},
        is_main = ${isMain},
        updated_at = NOW()
      WHERE channel_id = ${channelId} AND id = ${id}
      RETURNING
        id,
        channel_id AS "channelId",
        name,
        physical_spec AS "physicalSpec",
        signature_feature AS "signatureFeature",
        wardrobe,
        is_main AS "isMain",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    return NextResponse.json({ character: updated[0] });
  } catch (error) {
    console.error("Error updating character:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/channels/[channel-name]/characters - Delete a character
export async function DELETE(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
    }

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    await sql`
      DELETE FROM channel_characters
      WHERE channel_id = ${channelId} AND id = ${id};
    `;

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Error deleting character:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


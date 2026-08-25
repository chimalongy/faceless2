import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/settings/endpoints - Read all image and audio endpoints from Neon DB
export async function GET() {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({
        imageEndpoints: [],
        audioEndpoints: [],
        dbConnected: false,
      });
    }

    await initDbSchema();

    const imageRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM image_endpoints
      ORDER BY id ASC;
    `;

    const audioRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM audio_endpoints
      ORDER BY id ASC;
    `;

    return NextResponse.json({
      success: true,
      dbConnected: true,
      imageEndpoints: imageRows || [],
      audioEndpoints: audioRows || [],
    });
  } catch (error) {
    console.error("Failed to fetch endpoints from DB:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load endpoints from database" },
      { status: 500 }
    );
  }
}

// POST /api/settings/endpoints - Synchronize / Save all image and audio endpoints to Neon DB
export async function POST(request) {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "Database not connected. Please configure DATABASE_URL." },
        { status: 503 }
      );
    }

    await initDbSchema();
    const body = await request.json();
    const { imageEndpoints = [], audioEndpoints = [] } = body;

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    // 1. Sync Image Endpoints: Delete current and re-insert or upsert
    await sql`DELETE FROM image_endpoints;`;
    if (Array.isArray(imageEndpoints) && imageEndpoints.length > 0) {
      for (const ep of imageEndpoints) {
        const email = (ep.accountEmail || ep["account-email"] || "").trim();
        const url = (ep.genUrl || ep["gen-url"] || "").trim();
        const usage = parseInt(ep.usage, 10) || 0;

        if (email || url) {
          await sql`
            INSERT INTO image_endpoints (account_email, gen_url, usage, last_reset_month, updated_at)
            VALUES (${email}, ${url}, ${usage}, ${currentMonth}, NOW());
          `;
        }
      }
    }

    // 2. Sync Audio Endpoints: Delete current and re-insert or upsert
    await sql`DELETE FROM audio_endpoints;`;
    if (Array.isArray(audioEndpoints) && audioEndpoints.length > 0) {
      for (const ep of audioEndpoints) {
        const email = (ep.accountEmail || ep["account-email"] || "").trim();
        const url = (ep.genUrl || ep["gen-url"] || "").trim();
        const usage = parseInt(ep.usage, 10) || 0;

        if (email || url) {
          await sql`
            INSERT INTO audio_endpoints (account_email, gen_url, usage, last_reset_month, updated_at)
            VALUES (${email}, ${url}, ${usage}, ${currentMonth}, NOW());
          `;
        }
      }
    }

    // Fetch fresh state from database
    const refreshedImageRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM image_endpoints
      ORDER BY id ASC;
    `;

    const refreshedAudioRows = await sql`
      SELECT id, account_email AS "accountEmail", gen_url AS "genUrl", usage, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM audio_endpoints
      ORDER BY id ASC;
    `;

    return NextResponse.json({
      success: true,
      imageEndpoints: refreshedImageRows || [],
      audioEndpoints: refreshedAudioRows || [],
    });
  } catch (error) {
    console.error("Failed to save endpoints to DB:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save endpoints to database" },
      { status: 500 }
    );
  }
}

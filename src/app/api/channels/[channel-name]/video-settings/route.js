import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name]/video-settings
// Fetches the channel's video overlay settings and lists available overlays from General Settings
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    // 1. Fetch channel video_settings
    const channels = await sql`
      SELECT 
        id, 
        name, 
        slug, 
        video_settings AS "videoSettings"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = channels[0];
    const rawSettings = channel.videoSettings || {};

    const videoSettings = {
      useOverlay: Boolean(rawSettings.useOverlay ?? rawSettings.use_overlay ?? false),
      longsOverlayId: rawSettings.longsOverlayId !== undefined ? rawSettings.longsOverlayId : (rawSettings.longs_overlay_id ?? null),
      longsOverlayName: rawSettings.longsOverlayName || rawSettings.longs_overlay_name || null,
      longsOverlayUrl: rawSettings.longsOverlayUrl || rawSettings.longs_overlay_url || null,
      shortsOverlayId: rawSettings.shortsOverlayId !== undefined ? rawSettings.shortsOverlayId : (rawSettings.shorts_overlay_id ?? null),
      shortsOverlayName: rawSettings.shortsOverlayName || rawSettings.shorts_overlay_name || null,
      shortsOverlayUrl: rawSettings.shortsOverlayUrl || rawSettings.shorts_overlay_url || null,
      longsOpacity: rawSettings.longsOpacity !== undefined ? Number(rawSettings.longsOpacity) : (rawSettings.longs_opacity !== undefined ? Number(rawSettings.longs_opacity) : 1.0),
      shortsOpacity: rawSettings.shortsOpacity !== undefined ? Number(rawSettings.shortsOpacity) : (rawSettings.shorts_opacity !== undefined ? Number(rawSettings.shorts_opacity) : 1.0),
    };

    // 2. Fetch available overlays library from video_overlays
    const overlays = await sql`
      SELECT 
        id,
        name,
        file_url AS "fileUrl",
        file_key AS "fileKey",
        file_name AS "fileName",
        mime_type AS "mimeType",
        aspect_ratio AS "aspectRatio",
        size_bytes AS "sizeBytes",
        created_at AS "createdAt"
      FROM video_overlays
      ORDER BY created_at DESC;
    `;

    return NextResponse.json({
      success: true,
      channelSlug,
      channelName: channel.name,
      videoSettings,
      availableOverlays: overlays || [],
    });
  } catch (err) {
    console.error("Error fetching channel video settings:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch channel video settings" },
      { status: 500 }
    );
  }
}

// POST /api/channels/[channel-name]/video-settings
// Saves the channel's video overlay settings
export async function POST(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const body = await request.json();

    const useOverlay = Boolean(body.useOverlay ?? body.use_overlay ?? false);
    const longsOverlayId = body.longsOverlayId !== undefined ? (body.longsOverlayId ? Number(body.longsOverlayId) : null) : (body.longs_overlay_id ? Number(body.longs_overlay_id) : null);
    const shortsOverlayId = body.shortsOverlayId !== undefined ? (body.shortsOverlayId ? Number(body.shortsOverlayId) : null) : (body.shorts_overlay_id ? Number(body.shorts_overlay_id) : null);

    const longsOpacity = body.longsOpacity !== undefined ? Math.max(0.0, Math.min(1.0, Number(body.longsOpacity))) : 1.0;
    const shortsOpacity = body.shortsOpacity !== undefined ? Math.max(0.0, Math.min(1.0, Number(body.shortsOpacity))) : 1.0;

    // Resolve overlay URLs and names if IDs were provided
    let longsOverlayName = body.longsOverlayName || null;
    let longsOverlayUrl = body.longsOverlayUrl || null;
    let shortsOverlayName = body.shortsOverlayName || null;
    let shortsOverlayUrl = body.shortsOverlayUrl || null;

    if (longsOverlayId) {
      const rows = await sql`
        SELECT name, file_url AS "fileUrl" 
        FROM video_overlays 
        WHERE id = ${longsOverlayId} 
        LIMIT 1;
      `;
      if (rows && rows.length > 0) {
        longsOverlayName = rows[0].name;
        longsOverlayUrl = rows[0].fileUrl;
      }
    } else {
      longsOverlayName = null;
      longsOverlayUrl = null;
    }

    if (shortsOverlayId) {
      const rows = await sql`
        SELECT name, file_url AS "fileUrl" 
        FROM video_overlays 
        WHERE id = ${shortsOverlayId} 
        LIMIT 1;
      `;
      if (rows && rows.length > 0) {
        shortsOverlayName = rows[0].name;
        shortsOverlayUrl = rows[0].fileUrl;
      }
    } else {
      shortsOverlayName = null;
      shortsOverlayUrl = null;
    }

    const videoSettingsPayload = {
      use_overlay: useOverlay,
      longs_overlay_id: longsOverlayId,
      longs_overlay_name: longsOverlayName,
      longs_overlay_url: longsOverlayUrl,
      shorts_overlay_id: shortsOverlayId,
      shorts_overlay_name: shortsOverlayName,
      shorts_overlay_url: shortsOverlayUrl,
      longs_opacity: longsOpacity,
      shorts_opacity: shortsOpacity,
    };

    const updated = await sql`
      UPDATE channels
      SET
        video_settings = ${JSON.stringify(videoSettingsPayload)}::jsonb,
        updated_at = NOW()
      WHERE slug = ${channelSlug}
      RETURNING id, name, slug, video_settings AS "videoSettings";
    `;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const savedSettings = {
      useOverlay,
      longsOverlayId,
      longsOverlayName,
      longsOverlayUrl,
      shortsOverlayId,
      shortsOverlayName,
      shortsOverlayUrl,
      longsOpacity,
      shortsOpacity,
    };

    return NextResponse.json({
      success: true,
      message: "Video overlay settings saved successfully",
      videoSettings: savedSettings,
    });
  } catch (err) {
    console.error("Error saving channel video settings:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save video settings" },
      { status: 500 }
    );
  }
}

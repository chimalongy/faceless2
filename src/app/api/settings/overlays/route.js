import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { uploadToR2, deleteFromR2, deleteMultipleFromR2 } from "@/lib/storage";

const ALLOWED_VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi"]);

function getVideoMimeType(fileName = "") {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  if (ext === "mkv") return "video/x-matroska";
  if (ext === "avi") return "video/x-msvideo";
  return "video/mp4";
}

// GET /api/settings/overlays - List all video overlays
export async function GET(request) {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const { searchParams } = new URL(request.url);
    const aspectFilter = searchParams.get("aspectRatio");

    let rows = [];
    if (aspectFilter && aspectFilter !== "all") {
      rows = await sql`
        SELECT 
          id,
          name,
          file_url AS "fileUrl",
          file_key AS "fileKey",
          file_name AS "fileName",
          mime_type AS "mimeType",
          aspect_ratio AS "aspectRatio",
          size_bytes AS "sizeBytes",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM video_overlays
        WHERE aspect_ratio = ${aspectFilter} OR aspect_ratio = 'all'
        ORDER BY created_at DESC;
      `;
    } else {
      rows = await sql`
        SELECT 
          id,
          name,
          file_url AS "fileUrl",
          file_key AS "fileKey",
          file_name AS "fileName",
          mime_type AS "mimeType",
          aspect_ratio AS "aspectRatio",
          size_bytes AS "sizeBytes",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM video_overlays
        ORDER BY created_at DESC;
      `;
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      overlays: rows || [],
    });
  } catch (err) {
    console.error("Error fetching video overlays:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch video overlays" },
      { status: 500 }
    );
  }
}

// POST /api/settings/overlays - Upload new video overlay
export async function POST(request) {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No video file provided for overlay upload" },
        { status: 400 }
      );
    }

    const originalName = file.name || "overlay.mp4";
    const fileExt = (originalName.split(".").pop() || "").toLowerCase();

    if (!ALLOWED_VIDEO_EXTS.has(fileExt)) {
      return NextResponse.json(
        { error: `Unsupported format .${fileExt}. Allowed formats: ${Array.from(ALLOWED_VIDEO_EXTS).join(", ")}` },
        { status: 400 }
      );
    }

    const customName = (formData.get("name") || "").toString().trim();
    const name = customName || originalName.replace(/\.[^/.]+$/, "");
    const rawAspect = (formData.get("aspectRatio") || "all").toString().toLowerCase().trim();
    const aspectRatio = rawAspect === "16:9" ? "16:9" : rawAspect === "9:16" ? "9:16" : "all";

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const key = `system/overlays/${timestamp}-${randomSuffix}.${fileExt}`;
    const mimeType = file.type || getVideoMimeType(originalName);

    // Upload to Cloudflare R2
    const uploadResult = await uploadToR2({
      key,
      buffer,
      mimeType,
      metadata: {
        type: "video_overlay",
        name,
        aspectRatio,
        originalName,
      },
    });

    // Record in Neon DB
    const inserted = await sql`
      INSERT INTO video_overlays (
        name,
        file_url,
        file_key,
        file_name,
        mime_type,
        aspect_ratio,
        size_bytes
      ) VALUES (
        ${name},
        ${uploadResult.publicUrl},
        ${uploadResult.key},
        ${originalName},
        ${mimeType},
        ${aspectRatio},
        ${buffer.length}
      )
      RETURNING 
        id, 
        name, 
        file_url AS "fileUrl", 
        file_key AS "fileKey", 
        file_name AS "fileName", 
        mime_type AS "mimeType", 
        aspect_ratio AS "aspectRatio", 
        size_bytes AS "sizeBytes", 
        created_at AS "createdAt";
    `;

    return NextResponse.json({
      success: true,
      overlay: inserted[0],
    });
  } catch (err) {
    console.error("Error creating video overlay:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload video overlay" },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/overlays - Delete one or multiple overlays
export async function DELETE(request) {
  try {
    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const body = await request.json().catch(() => ({}));
    const rawIds = body.ids || (body.id ? [body.id] : []);
    const ids = Array.isArray(rawIds) ? rawIds.map((id) => Number(id)).filter((id) => !isNaN(id)) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No overlay ID(s) provided to delete" }, { status: 400 });
    }

    // Retrieve storage keys from database to remove objects from Cloudflare R2
    const rows = await sql`
      SELECT id, file_key 
      FROM video_overlays 
      WHERE id = ANY(${ids});
    `;

    const keysToDelete = (rows || []).map((r) => r.file_key).filter(Boolean);
    if (keysToDelete.length > 0) {
      await deleteMultipleFromR2(keysToDelete).catch((err) => {
        console.warn("Could not delete some overlay files from R2:", err);
      });
    }

    // Delete database records
    await sql`
      DELETE FROM video_overlays 
      WHERE id = ANY(${ids});
    `;

    return NextResponse.json({
      success: true,
      deletedCount: rows.length,
    });
  } catch (err) {
    console.error("Error deleting video overlay:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete video overlay" },
      { status: 500 }
    );
  }
}

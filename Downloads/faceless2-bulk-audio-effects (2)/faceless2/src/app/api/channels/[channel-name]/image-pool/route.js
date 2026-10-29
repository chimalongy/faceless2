import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import {
  uploadToR2,
  deleteFromR2,
  deleteMultipleFromR2,
  getPresignedR2UploadUrl,
  getR2Client,
  getBucketName
} from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import JSZip from "jszip";

export const maxDuration = 60;

const ALLOWED_EXTS = new Set(["png", "jpg", "jpeg", "webp", "jfif", "gif"]);

function getMimeType(fileName = "") {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "jfif") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

// GET /api/channels/[channel-name]/image-pool
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const { searchParams } = new URL(request.url);
    const poolType = (searchParams.get("type") || "").toLowerCase().trim(); // 'shorts', 'longform', or empty for both

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const channelRows = await sql`
      SELECT id, name, slug, use_image_pool AS "useImagePool"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    // Counts for both pools
    const counts = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE pool_type = 'shorts')::int AS "shortsCount",
        COUNT(*) FILTER (WHERE pool_type = 'longform')::int AS "longformCount"
      FROM channel_image_pool
      WHERE channel_id = ${channelId};
    `;

    const shortsCount = counts?.[0]?.shortsCount || 0;
    const longformCount = counts?.[0]?.longformCount || 0;

    // Query images based on requested filter
    let images = [];
    if (poolType === "shorts" || poolType === "longform") {
      images = await sql`
        SELECT 
          id,
          pool_type AS "poolType",
          file_url AS "fileUrl",
          file_key AS "fileKey",
          file_name AS "fileName",
          mime_type AS "mimeType",
          size_bytes AS "sizeBytes",
          created_at AS "createdAt"
        FROM channel_image_pool
        WHERE channel_id = ${channelId} AND pool_type = ${poolType}
        ORDER BY created_at DESC;
      `;
    } else {
      images = await sql`
        SELECT 
          id,
          pool_type AS "poolType",
          file_url AS "fileUrl",
          file_key AS "fileKey",
          file_name AS "fileName",
          mime_type AS "mimeType",
          size_bytes AS "sizeBytes",
          created_at AS "createdAt"
        FROM channel_image_pool
        WHERE channel_id = ${channelId}
        ORDER BY created_at DESC;
      `;
    }

    return NextResponse.json({
      success: true,
      channelSlug,
      channelName: channelRows[0].name,
      useImagePool: Boolean(channelRows[0].useImagePool),
      shortsCount,
      longformCount,
      totalCount: shortsCount + longformCount,
      images: images || [],
    });
  } catch (err) {
    console.error("Error fetching channel image pool:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch image pool" },
      { status: 500 }
    );
  }
}

// POST /api/channels/[channel-name]/image-pool - Upload single/multiple images or a ZIP archive
export async function POST(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const channelRows = await sql`
      SELECT id, slug FROM channels WHERE slug = ${channelSlug} LIMIT 1;
    `;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    const contentType = request.headers.get("content-type") || "";

    // PATH 1: JSON Actions (Presigning, Direct R2 ZIP extraction, or Direct image batch recording)
    if (contentType.includes("application/json")) {
      const body = await request.json();

      // Action A: Presign R2 upload URL for single file, ZIP, or batch images
      if (body.action === "presign") {
        const rawPoolType = (body.poolType || "").toLowerCase().trim();
        const poolType = rawPoolType === "shorts" ? "shorts" : rawPoolType === "longform" ? "longform" : "shorts";

        // Multi-file batch presign (for uploading multiple individual images directly)
        if (Array.isArray(body.files)) {
          const presignedList = await Promise.all(
            body.files.map(async (f) => {
              const fileName = f.fileName || "image.png";
              const fileExt = (fileName.split(".").pop() || "png").toLowerCase();
              const safeExt = ALLOWED_EXTS.has(fileExt) ? fileExt : "png";
              const timestamp = Date.now();
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              const key = `channels/${channelSlug}/image-pool/${poolType}/${timestamp}-${randomSuffix}.${safeExt}`;
              const mimeType = f.mimeType || getMimeType(fileName);

              const presigned = await getPresignedR2UploadUrl({ key, mimeType, expiresIn: 3600 });
              return {
                uploadUrl: presigned.uploadUrl,
                publicUrl: presigned.publicUrl,
                key: presigned.key,
                fileName,
                mimeType,
              };
            })
          );

          return NextResponse.json({ success: true, presignedList });
        }

        // Single file presign (e.g. for ZIP archive or single image)
        const isZip = Boolean(body.isZip || body.fileName?.toLowerCase().endsWith(".zip"));
        const fileName = body.fileName || (isZip ? "pool.zip" : "image.png");
        const fileExt = (fileName.split(".").pop() || (isZip ? "zip" : "png")).toLowerCase();
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const folder = isZip ? "temp-zip" : poolType;
        const key = `channels/${channelSlug}/image-pool/${folder}/${timestamp}-${randomSuffix}.${fileExt}`;
        const mimeType = body.mimeType || (isZip ? "application/zip" : getMimeType(fileName));

        const presigned = await getPresignedR2UploadUrl({ key, mimeType, expiresIn: 3600 });
        return NextResponse.json({
          success: true,
          uploadUrl: presigned.uploadUrl,
          publicUrl: presigned.publicUrl,
          key: presigned.key,
          fileName,
          mimeType,
        });
      }

      // Action B: Process and unpack a ZIP file that was uploaded directly to R2
      if (body.action === "process-zip") {
        const rawPoolType = (body.poolType || "").toLowerCase().trim();
        const poolType = rawPoolType === "shorts" ? "shorts" : rawPoolType === "longform" ? "longform" : null;
        if (!poolType) {
          return NextResponse.json(
            { error: "Invalid or missing poolType. Must be 'shorts' or 'longform'." },
            { status: 400 }
          );
        }

        const zipFileKey = body.zipFileKey ? String(body.zipFileKey).trim().replace(/^\/+/, "") : null;
        if (!zipFileKey) {
          return NextResponse.json({ error: "Missing zipFileKey" }, { status: 400 });
        }

        const client = getR2Client();
        if (!client) {
          return NextResponse.json({ error: "Storage client not configured" }, { status: 503 });
        }

        console.log(`[ImagePool] Fetching ZIP from R2 key "${zipFileKey}" for channel "${channelSlug}" (${poolType})...`);

        const getCommand = new GetObjectCommand({
          Bucket: getBucketName(),
          Key: zipFileKey,
        });

        const r2Resp = await client.send(getCommand);
        const chunks = [];
        for await (const chunk of r2Resp.Body) {
          chunks.push(chunk);
        }
        const zipBuffer = Buffer.concat(chunks);

        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(zipBuffer);

        const entries = [];
        for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
          if (zipEntry.dir) continue;
          if (relativePath.includes("__MACOSX") || relativePath.startsWith(".")) continue;

          const baseName = relativePath.split("/").pop() || "";
          const entryExt = (baseName.split(".").pop() || "").toLowerCase();
          if (!ALLOWED_EXTS.has(entryExt)) continue;

          entries.push({ zipEntry, baseName, entryExt });
        }

        if (entries.length === 0) {
          await deleteFromR2(zipFileKey).catch(() => {});
          return NextResponse.json(
            { error: "No valid image files (PNG, JPG, WEBP, JFIF, GIF) found in ZIP archive." },
            { status: 400 }
          );
        }

        console.log(`[ImagePool] Extracting and uploading ${entries.length} images from ZIP to R2...`);

        const uploadedAssets = [];
        const concurrency = 5;
        for (let i = 0; i < entries.length; i += concurrency) {
          const chunk = entries.slice(i, i + concurrency);
          await Promise.all(
            chunk.map(async ({ zipEntry, baseName, entryExt }) => {
              const entryBuffer = await zipEntry.async("nodebuffer");
              const timestamp = Date.now();
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              const key = `channels/${channelSlug}/image-pool/${poolType}/${timestamp}-${randomSuffix}.${entryExt}`;
              const mimeType = getMimeType(baseName);

              const r2Result = await uploadToR2({
                key,
                buffer: entryBuffer,
                mimeType,
                metadata: {
                  channelSlug,
                  poolType,
                  originalName: baseName,
                },
              });

              uploadedAssets.push({
                poolType,
                fileUrl: r2Result.publicUrl,
                fileKey: r2Result.key,
                fileName: baseName,
                mimeType,
                sizeBytes: entryBuffer.length,
              });
            })
          );
        }

        // Clean up temporary ZIP from R2
        await deleteFromR2(zipFileKey).catch(() => {});

        // Insert newly extracted image records into PostgreSQL
        const insertedRows = [];
        for (const item of uploadedAssets) {
          const rows = await sql`
            INSERT INTO channel_image_pool (
              channel_id,
              pool_type,
              file_url,
              file_key,
              file_name,
              mime_type,
              size_bytes
            ) VALUES (
              ${channelId},
              ${item.poolType},
              ${item.fileUrl},
              ${item.fileKey},
              ${item.fileName},
              ${item.mimeType},
              ${item.sizeBytes}
            )
            RETURNING id, pool_type AS "poolType", file_url AS "fileUrl", file_key AS "fileKey", file_name AS "fileName", created_at AS "createdAt";
          `;
          if (rows?.[0]) insertedRows.push(rows[0]);
        }

        return NextResponse.json({
          success: true,
          poolType,
          uploadedCount: insertedRows.length,
          items: insertedRows,
        });
      }

      // Action C: Record images that were uploaded directly to R2
      if (body.action === "record-images") {
        const rawPoolType = (body.poolType || "").toLowerCase().trim();
        const poolType = rawPoolType === "shorts" ? "shorts" : rawPoolType === "longform" ? "longform" : null;
        if (!poolType) {
          return NextResponse.json(
            { error: "Invalid or missing poolType. Must be 'shorts' or 'longform'." },
            { status: 400 }
          );
        }

        const images = Array.isArray(body.images) ? body.images : [];
        if (images.length === 0) {
          return NextResponse.json({ error: "No images provided to record" }, { status: 400 });
        }

        const insertedRows = [];
        for (const item of images) {
          const rows = await sql`
            INSERT INTO channel_image_pool (
              channel_id,
              pool_type,
              file_url,
              file_key,
              file_name,
              mime_type,
              size_bytes
            ) VALUES (
              ${channelId},
              ${poolType},
              ${item.fileUrl},
              ${item.fileKey},
              ${item.fileName || "image.png"},
              ${item.mimeType || "image/png"},
              ${item.sizeBytes || 0}
            )
            RETURNING id, pool_type AS "poolType", file_url AS "fileUrl", file_key AS "fileKey", file_name AS "fileName", created_at AS "createdAt";
          `;
          if (rows?.[0]) insertedRows.push(rows[0]);
        }

        return NextResponse.json({
          success: true,
          poolType,
          uploadedCount: insertedRows.length,
          items: insertedRows,
        });
      }

      return NextResponse.json({ error: "Unknown action provided" }, { status: 400 });
    }

    // PATH 2: Multipart form-data fallback (for small files)
    const formData = await request.formData();
    const rawPoolType = (formData.get("poolType") || "").toLowerCase().trim();
    const poolType = rawPoolType === "shorts" ? "shorts" : rawPoolType === "longform" ? "longform" : null;

    if (!poolType) {
      return NextResponse.json(
        { error: "Invalid or missing poolType. Must be 'shorts' or 'longform'." },
        { status: 400 }
      );
    }

    // Collect all uploaded file objects from the form data
    const files = formData.getAll("files").concat(formData.getAll("file")).filter((f) => f && typeof f !== "string");
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided for upload." }, { status: 400 });
    }

    const uploadedAssets = [];

    for (const file of files) {
      const fileName = file.name || "image.png";
      const fileExt = (fileName.split(".").pop() || "").toLowerCase();

      // Check if uploaded file is a ZIP archive
      if (fileExt === "zip" || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
        const zipBuffer = Buffer.from(await file.arrayBuffer());
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(zipBuffer);

        for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
          if (zipEntry.dir) continue;
          if (relativePath.includes("__MACOSX") || relativePath.startsWith(".")) continue;

          const baseName = relativePath.split("/").pop() || "";
          const entryExt = (baseName.split(".").pop() || "").toLowerCase();
          if (!ALLOWED_EXTS.has(entryExt)) continue;

          const entryBuffer = await zipEntry.async("nodebuffer");
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const key = `channels/${channelSlug}/image-pool/${poolType}/${timestamp}-${randomSuffix}.${entryExt}`;
          const mimeType = getMimeType(baseName);

          const r2Result = await uploadToR2({
            key,
            buffer: entryBuffer,
            mimeType,
            metadata: {
              channelSlug,
              poolType,
              originalName: baseName,
            },
          });

          uploadedAssets.push({
            poolType,
            fileUrl: r2Result.publicUrl,
            fileKey: r2Result.key,
            fileName: baseName,
            mimeType,
            sizeBytes: entryBuffer.length,
          });
        }
      } else {
        // Direct image upload
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const safeExt = ALLOWED_EXTS.has(fileExt) ? fileExt : "png";
        const key = `channels/${channelSlug}/image-pool/${poolType}/${timestamp}-${randomSuffix}.${safeExt}`;
        const mimeType = file.type || getMimeType(fileName);

        const r2Result = await uploadToR2({
          key,
          buffer,
          mimeType,
          metadata: {
            channelSlug,
            poolType,
            originalName: fileName,
          },
        });

        uploadedAssets.push({
          poolType,
          fileUrl: r2Result.publicUrl,
          fileKey: r2Result.key,
          fileName,
          mimeType,
          sizeBytes: buffer.length,
        });
      }
    }

    if (uploadedAssets.length === 0) {
      return NextResponse.json(
        { error: "No valid image files found in upload." },
        { status: 400 }
      );
    }

    // Insert into database in batch
    const insertedRows = [];
    for (const item of uploadedAssets) {
      const rows = await sql`
        INSERT INTO channel_image_pool (
          channel_id,
          pool_type,
          file_url,
          file_key,
          file_name,
          mime_type,
          size_bytes
        ) VALUES (
          ${channelId},
          ${item.poolType},
          ${item.fileUrl},
          ${item.fileKey},
          ${item.fileName},
          ${item.mimeType},
          ${item.sizeBytes}
        )
        RETURNING id, pool_type AS "poolType", file_url AS "fileUrl", file_key AS "fileKey", file_name AS "fileName", created_at AS "createdAt";
      `;
      if (rows?.[0]) insertedRows.push(rows[0]);
    }

    return NextResponse.json({
      success: true,
      poolType,
      uploadedCount: insertedRows.length,
      items: insertedRows,
    });
  } catch (err) {
    console.error("Error uploading to channel image pool:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload pool images" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[channel-name]/image-pool - Delete image(s) from pool
export async function DELETE(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const channelRows = await sql`
      SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;
    `;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    const body = await request.json();
    const rawIds = body.ids || (body.id ? [body.id] : []);
    const ids = Array.isArray(rawIds) ? rawIds.map((id) => Number(id)).filter((id) => !isNaN(id)) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No image IDs provided to delete" }, { status: 400 });
    }

    // Fetch keys to delete from R2
    const rows = await sql`
      SELECT id, file_key 
      FROM channel_image_pool
      WHERE channel_id = ${channelId} AND id = ANY(${ids});
    `;

    const keysToDelete = (rows || []).map((r) => r.file_key).filter(Boolean);
    if (keysToDelete.length > 0) {
      await deleteMultipleFromR2(keysToDelete).catch((err) => {
        console.warn("Failed to delete some pool objects from R2:", err);
      });
    }

    // Delete rows from database
    await sql`
      DELETE FROM channel_image_pool
      WHERE channel_id = ${channelId} AND id = ANY(${ids});
    `;

    return NextResponse.json({
      success: true,
      deletedCount: rows.length,
    });
  } catch (err) {
    console.error("Error deleting from channel image pool:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete pool images" },
      { status: 500 }
    );
  }
}

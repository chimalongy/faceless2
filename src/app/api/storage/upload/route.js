import { NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

// POST /api/storage/upload - Upload file directly to Cloudflare R2 bucket
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No file provided for upload" },
        { status: 400 }
      );
    }

    const channelSlug = formData.get("channelSlug") || "default";
    const topicSlug = formData.get("topicSlug") || "general";
    const assetType = formData.get("assetType") || "media"; // 'thumbnail', 'audio', 'image', 'video', 'completedvideo'
    const sceneIndex = formData.get("sceneIndex") ? parseInt(formData.get("sceneIndex"), 10) : null;
    const imageIndex = formData.get("imageIndex") ? parseInt(formData.get("imageIndex"), 10) : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name || "file";
    const extension = originalName.includes(".") ? originalName.split(".").pop() : "bin";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Clean key hierarchy in Cloudflare R2 bucket
    const imageSuffix = imageIndex && imageIndex > 1 ? `-${imageIndex}` : "";
    const key = assetType === "image" && sceneIndex !== null
      ? `channels/${channelSlug}/topics/${topicSlug}/images/scene-${sceneIndex}${imageSuffix}-${timestamp}-${randomSuffix}.${extension}`
      : `channels/${channelSlug}/topics/${topicSlug}/${assetType}/${timestamp}-${randomSuffix}.${extension}`;
    const mimeType = file.type || "application/octet-stream";

    const uploadResult = await uploadToR2({
      key,
      buffer,
      mimeType,
      metadata: {
        channelSlug,
        topicSlug,
        assetType,
        originalName,
        ...(sceneIndex !== null ? { sceneIndex: String(sceneIndex) } : {}),
        ...(imageIndex !== null ? { imageIndex: String(imageIndex) } : {}),
      },
    });

    const assetFileName = assetType === "image" && sceneIndex !== null
      ? (imageIndex !== null ? `scene-${sceneIndex}${imageIndex > 1 ? `-${imageIndex}` : ""}.${extension}` : originalName)
      : originalName;

    // Record in topic_assets and update topic row if database is connected
    try {
      const sql = getDbSql();
      if (sql && channelSlug !== "default") {
        await initDbSchema();
        const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
        const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;

        const channelId = cRows?.[0]?.id || null;
        const topicId = tRows?.[0]?.id || null;

        if (channelId) {
          // If replacing an existing frame of a scene, clean up the previous asset for this frame
          if (assetType === "image" && sceneIndex !== null && imageIndex !== null && topicId) {
            try {
              const searchPattern = imageIndex > 1 ? `%scene-${sceneIndex}-${imageIndex}.%` : `%scene-${sceneIndex}.%`;
              const existingRows = await sql`
                SELECT id, file_key FROM topic_assets
                WHERE topic_id = ${topicId} AND asset_type = 'image' AND scene_index = ${sceneIndex}
                AND (file_name LIKE ${searchPattern} OR file_key LIKE ${searchPattern});
              `;
              if (existingRows && existingRows.length > 0) {
                const { deleteFromR2 } = await import("@/lib/storage");
                for (const row of existingRows) {
                  if (row.file_key) await deleteFromR2(row.file_key).catch(() => {});
                  await sql`DELETE FROM topic_assets WHERE id = ${row.id};`;
                }
              }
            } catch (cleanupErr) {
              console.warn("Could not clean up previous frame asset:", cleanupErr);
            }
          }

          await sql`
            INSERT INTO topic_assets (
              topic_id,
              channel_id,
              asset_type,
              scene_index,
              file_url,
              file_key,
              file_name,
              mime_type,
              size_bytes
            ) VALUES (
              ${topicId},
              ${channelId},
              ${assetType},
              ${sceneIndex},
              ${uploadResult.publicUrl},
              ${uploadResult.key},
              ${assetFileName},
              ${mimeType},
              ${buffer.length}
            );
          `;

          // If asset is a thumbnail, automatically persist to topics.thumbnail_url
          if (assetType === "thumbnail" && topicId) {
            await sql`
              UPDATE topics
              SET thumbnail_url = ${uploadResult.publicUrl}, updated_at = NOW()
              WHERE id = ${topicId};
            `;
          }

          // If asset is a completed video master, automatically persist to topics.master_video_url
          if (assetType === "completedvideo" && topicId) {
            await sql`
              UPDATE topics
              SET master_video_url = ${uploadResult.publicUrl}, updated_at = NOW()
              WHERE id = ${topicId};
            `;
          }

          // If asset is a channel banner, automatically persist to channels.banner_url
          if ((assetType === "channel_banner" || assetType === "banner") && channelId) {
            await sql`
              UPDATE channels
              SET banner_url = ${uploadResult.publicUrl}, updated_at = NOW()
              WHERE id = ${channelId};
            `;
          }

          // If asset is a channel avatar / picture, automatically persist to channels.avatar_url
          if ((assetType === "channel_avatar" || assetType === "avatar" || assetType === "channel_picture") && channelId) {
            await sql`
              UPDATE channels
              SET avatar_url = ${uploadResult.publicUrl}, updated_at = NOW()
              WHERE id = ${channelId};
            `;
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not save asset to DB:", dbErr);
    }

    return NextResponse.json({
      success: true,
      publicUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      assetType,
      fileName: originalName,
      sizeBytes: buffer.length,
    });
  } catch (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file to Cloudflare R2" },
      { status: 500 }
    );
  }
}

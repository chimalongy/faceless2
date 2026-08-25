import { NextResponse } from "next/server";
import { deleteFromR2, getPublicBaseUrl } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

// POST /api/storage/delete - Delete file directly from Cloudflare R2 bucket and clear DB reference
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { url, key, fileKey, fileUrl, channelSlug, topicSlug, assetType, sceneIndex } = body;

    let r2Key = key || fileKey;
    const targetUrl = url || fileUrl;

    if (!r2Key && targetUrl) {
      const publicBase = getPublicBaseUrl();
      if (publicBase && targetUrl.startsWith(publicBase)) {
        r2Key = targetUrl.replace(publicBase, "").replace(/^\//, "");
      } else {
        const parts = targetUrl.split(".r2.dev/");
        if (parts.length > 1) {
          r2Key = parts[1];
        } else {
          try {
            const parsedUrl = new URL(targetUrl);
            r2Key = parsedUrl.pathname.replace(/^\//, "");
          } catch {
            r2Key = targetUrl;
          }
        }
      }
    }

    if (r2Key) {
      console.log(`[StorageDelete] Deleting R2 key: ${r2Key}`);
      await deleteFromR2(r2Key);
    }

    // Clear reference in Neon database
    try {
      const sql = getDbSql();
      if (sql) {
        await initDbSchema();
        
        // 1. Channel level banner / avatar
        if (channelSlug) {
          if (assetType === "channel_banner" || assetType === "banner") {
            await sql`
              UPDATE channels
              SET banner_url = NULL, updated_at = NOW()
              WHERE slug = ${channelSlug};
            `;
          } else if (
            assetType === "channel_avatar" ||
            assetType === "avatar" ||
            assetType === "channel_picture"
          ) {
            await sql`
              UPDATE channels
              SET avatar_url = NULL, updated_at = NOW()
              WHERE slug = ${channelSlug};
            `;
          }
        }

        // 2. Topic level assets
        if (topicSlug) {
          const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
          const topicId = tRows?.[0]?.id || null;

          if (topicId) {
            if (r2Key) {
              await sql`
                DELETE FROM topic_assets
                WHERE topic_id = ${topicId} AND (file_key = ${r2Key} OR file_url LIKE ${`%${r2Key}%`});
              `;
            }
            if (assetType && sceneIndex !== undefined && sceneIndex !== null) {
              await sql`
                DELETE FROM topic_assets
                WHERE topic_id = ${topicId} AND asset_type = ${assetType} AND scene_index = ${sceneIndex};
              `;
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not clear asset reference in DB:", dbErr);
    }

    return NextResponse.json({ success: true, deletedKey: r2Key });
  } catch (error) {
    console.error("Storage delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete file from storage" },
      { status: 500 }
    );
  }
}

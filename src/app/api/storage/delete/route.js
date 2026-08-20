import { NextResponse } from "next/server";
import { deleteFromR2, getPublicBaseUrl } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

// POST /api/storage/delete - Delete file directly from Cloudflare R2 bucket and clear DB reference
export async function POST(request) {
  try {
    const body = await request.json();
    const { url, key, channelSlug, assetType } = body;

    let r2Key = key;
    if (!r2Key && url) {
      const publicBase = getPublicBaseUrl();
      if (publicBase && url.startsWith(publicBase)) {
        r2Key = url.replace(publicBase, "").replace(/^\//, "");
      } else {
        const parts = url.split(".r2.dev/");
        if (parts.length > 1) {
          r2Key = parts[1];
        } else {
          try {
            const parsedUrl = new URL(url);
            r2Key = parsedUrl.pathname.replace(/^\//, "");
          } catch {
            r2Key = url;
          }
        }
      }
    }

    if (r2Key) {
      await deleteFromR2(r2Key);
    }

    // Clear reference in Neon database if channelSlug and assetType provided
    try {
      const sql = getDbSql();
      if (sql && channelSlug) {
        await initDbSchema();
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

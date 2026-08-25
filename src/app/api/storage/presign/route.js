import { NextResponse } from "next/server";
import { getPresignedR2UploadUrl } from "@/lib/storage";

// POST /api/storage/presign - Generate presigned R2 upload URL for heavy master video cuts
export async function POST(request) {
  try {
    const body = await request.json();
    const fileName = body.fileName || "upload.bin";
    const mimeType = body.mimeType || "application/octet-stream";
    const channelSlug = body.channelSlug || "default";
    const topicSlug = body.topicSlug || "general";
    const assetType = body.assetType || "completedvideo";

    const extension = fileName.includes(".") ? fileName.split(".").pop() : "bin";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const key = `channels/${channelSlug}/topics/${topicSlug}/${assetType}/${timestamp}-${randomSuffix}.${extension}`;

    const presigned = await getPresignedR2UploadUrl({
      key,
      mimeType,
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({
      success: true,
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      key: presigned.key,
    });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned upload URL" },
      { status: 500 }
    );
  }
}

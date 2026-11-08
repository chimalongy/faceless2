import { NextResponse } from "next/server";
import { importStockMediaToScene } from "@/lib/stock-media";

export async function POST(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    if (!channelSlug || !topicSlug) {
      return NextResponse.json(
        { error: "channelSlug and topicSlug are required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { sceneIndex, imageIndex = 1, downloadUrl, mediaType = "photo", title = "", author = "" } = body;

    if (sceneIndex === undefined || sceneIndex === null) {
      return NextResponse.json(
        { error: "sceneIndex is required" },
        { status: 400 }
      );
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "downloadUrl is required" },
        { status: 400 }
      );
    }

    const result = await importStockMediaToScene({
      channelSlug,
      topicSlug,
      sceneIndex,
      imageIndex,
      downloadUrl,
      mediaType,
      title,
      author,
    });

    return NextResponse.json({
      ok: true,
      assignedUrl: result.publicUrl,
      assignedKey: result.fileKey,
      fileName: result.fileName,
      sceneIndex: result.sceneIndex,
      imageIndex: result.imageIndex,
    });
  } catch (error) {
    console.error("Import stock media error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import stock media" },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";

export async function POST(req, context) {
  try {
    const params = await context.params;
    const channelSlug = params?.["channel-name"];
    const topicSlug = params?.["topic-name"];

    if (!channelSlug || !topicSlug) {
      return NextResponse.json(
        { error: "channelSlug and topicSlug are required" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No ZIP file provided in upload" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const zipBase64 = buffer.toString("base64");

    console.log(
      `[ExtractZipRoute] Triggering Trigger.dev task "extract-zip-images" directly via base64 in memory (size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB, zero R2 zip storage)...`
    );

    // Dispatch Trigger.dev task directly in-memory without storing the ZIP file in R2
    const handle = await tasks.trigger("extract-zip-images", {
      channelSlug,
      topicSlug,
      zipBase64,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

    if (run.status !== "COMPLETED") {
      console.error("[ExtractZipRoute] Trigger.dev extract zip run error:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    return NextResponse.json({
      success: true,
      extractedCount: output.extractedCount,
      images: output.images,
    });
  } catch (error) {
    console.error("[ExtractZipRoute] Error processing ZIP upload:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process ZIP upload." },
      { status: 500 }
    );
  }
}

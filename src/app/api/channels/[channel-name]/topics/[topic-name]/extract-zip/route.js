import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";

export const maxDuration = 60; // Extend Vercel function timeout for ZIP processing

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

    let zipFileKey = null;
    let zipBase64 = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      zipFileKey = body.zipFileKey;
      zipBase64 = body.zipBase64;
    } else {
      const formData = await req.formData();
      const file = formData.get("file");

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        zipBase64 = buffer.toString("base64");
      }
    }

    if (!zipFileKey && !zipBase64) {
      return NextResponse.json(
        { error: "No ZIP file key or data provided" },
        { status: 400 }
      );
    }

    console.log(
      `[ExtractZipRoute] Triggering Trigger.dev task "extract-zip-images" (zipFileKey: ${zipFileKey || "none, using base64"})...`
    );

    // Dispatch Trigger.dev task with R2 temporary key (bypassing Vercel & Trigger payload limits)
    const handle = await tasks.trigger("extract-zip-images", {
      channelSlug,
      topicSlug,
      zipFileKey,
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

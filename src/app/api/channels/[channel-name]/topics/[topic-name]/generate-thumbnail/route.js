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

    const body = await req.json().catch(() => ({}));
    const { customPrompt, isShort, width, height, seed, numInferenceSteps } = body;

    console.log(`[GenerateThumbnailRoute] Triggering task "generate-thumbnail-image" for "${channelSlug}/${topicSlug}"...`);

    const handle = await tasks.trigger("generate-thumbnail-image", {
      channelSlug,
      topicSlug,
      customPrompt,
      isShort,
      width,
      height,
      seed,
      numInferenceSteps,
    });

    console.log(`[GenerateThumbnailRoute] Task triggered with run ID: ${handle.id}, polling for completion...`);

    const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

    if (run.status !== "COMPLETED") {
      console.error("[GenerateThumbnailRoute] Task run failed:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Thumbnail generation task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    console.log("[GenerateThumbnailRoute] Task completed successfully:", output);

    return NextResponse.json({
      success: true,
      thumbnailUrl: output.thumbnailUrl,
      key: output.key,
      endpointUsed: output.endpointUsed,
      remainingUsage: output.remainingUsage,
      channelSlug,
      topicSlug,
    });
  } catch (error) {
    console.error("[GenerateThumbnailRoute] Error dispatching task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger thumbnail generation task." },
      { status: 500 }
    );
  }
}


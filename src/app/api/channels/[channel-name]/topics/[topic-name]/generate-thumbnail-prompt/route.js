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
    const { customModel } = body;

    console.log(`[GenerateThumbnailPromptRoute] Triggering task "generate-thumbnail-prompt" for "${channelSlug}/${topicSlug}"...`);

    const handle = await tasks.trigger("generate-thumbnail-prompt", {
      channelSlug,
      topicSlug,
      customModel,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

    if (run.status !== "COMPLETED") {
      console.error("[GenerateThumbnailPromptRoute] Task run failed:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Thumbnail prompt generation task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    return NextResponse.json({
      success: true,
      thumbnailPrompt: output.thumbnailPrompt,
      accountUsed: output.accountUsed,
      modelUsed: output.modelUsed,
      topicSlug: output.topicSlug,
      channelSlug: output.channelSlug,
    });
  } catch (error) {
    console.error("[GenerateThumbnailPromptRoute] Error dispatching task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger thumbnail prompt generation task." },
      { status: 500 }
    );
  }
}

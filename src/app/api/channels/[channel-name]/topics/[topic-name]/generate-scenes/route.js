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
    const { customModel, customScript, customImageTheme } = body;

    console.log(`[GenerateScenesRoute] Triggering Trigger.dev task "generate-scenes" for "${channelSlug}/${topicSlug}"...`);

    const handle = await tasks.trigger("generate-scenes", {
      channelSlug,
      topicSlug,
      customModel,
      customScript,
      customImageTheme,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

    if (run.status !== "COMPLETED") {
      console.error("[GenerateScenesRoute] Trigger.dev scenes run failed:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Scene generation task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    return NextResponse.json({
      success: true,
      scenes: output.scenes,
      totalScenes: output.totalScenes,
      accountUsed: output.accountUsed,
      modelUsed: output.modelUsed,
      topicSlug: output.topicSlug,
      channelSlug: output.channelSlug,
    });
  } catch (error) {
    console.error("[GenerateScenesRoute] Error dispatching Trigger.dev scenes task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger scene generation task." },
      { status: 500 }
    );
  }
}

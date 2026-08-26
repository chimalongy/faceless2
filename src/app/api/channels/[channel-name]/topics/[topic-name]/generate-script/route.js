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
    const { customModel, customPrompt } = body;

    console.log(`[GenerateScriptRoute] Triggering Trigger.dev task "generate-script" for "${channelSlug}/${topicSlug}"...`);

    const handle = await tasks.trigger("generate-script", {
      channelSlug,
      topicSlug,
      customModel,
      customPrompt,
    });

    const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

    if (run.status !== "COMPLETED") {
      console.error("[GenerateScriptRoute] Trigger.dev script run failed:", run.error);
      return NextResponse.json(
        { error: run.error?.message || `Script generation task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    return NextResponse.json({
      success: true,
      scriptContent: output.scriptContent,
      wordCount: output.wordCount,
      accountUsed: output.accountUsed,
      modelUsed: output.modelUsed,
      topicSlug: output.topicSlug,
      channelSlug: output.channelSlug,
    });
  } catch (error) {
    console.error("[GenerateScriptRoute] Error dispatching Trigger.dev script task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger script generation task." },
      { status: 500 }
    );
  }
}

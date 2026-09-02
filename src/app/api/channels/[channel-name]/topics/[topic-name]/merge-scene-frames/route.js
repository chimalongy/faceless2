import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";

export const maxDuration = 60;

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
    const { sceneVideos = [], resolution = "1080p", useModal = false } = body;

    const taskId = useModal ? "merge-scene-frames-modal" : "merge-scene-frames";
    console.log(`[MergeSceneFramesRoute] Triggering Trigger.dev task "${taskId}" for ${channelSlug}/${topicSlug}...`);

    const handle = await tasks.trigger(taskId, {
      channelSlug,
      topicSlug,
      sceneVideos,
      resolution,
    });

    console.log(`[MergeSceneFramesRoute] Task triggered with run ID: ${handle.id}, polling for completion...`);

    const run = await runs.poll(handle.id, { pollIntervalMs: 1500 });

    if (run.status !== "COMPLETED") {
      console.error("[MergeSceneFramesRoute] Merge run error:", run.status, run.error);
      return NextResponse.json(
        { error: run.error?.message || `Merge task ended with status ${run.status}` },
        { status: 500 }
      );
    }

    const output = run.output;
    console.log("[MergeSceneFramesRoute] Merge task completed successfully:", output);

    return NextResponse.json({
      success: true,
      videoUrl: output.videoUrl || output.publicUrl,
      publicUrl: output.publicUrl,
      key: output.key,
      duration: output.duration,
      sceneCount: output.sceneCount,
      sizeBytes: output.sizeBytes,
    });
  } catch (error) {
    console.error("[MergeSceneFramesRoute] Error dispatching merge task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger merge-scene-frames task." },
      { status: 500 }
    );
  }
}

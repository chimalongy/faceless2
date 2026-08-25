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
    const { sceneIndex, scenes, globalThemePrompt = "" } = body;

    // 1. Single Scene Generation -> Dispatches Trigger.dev task: generate-scene-images
    if (sceneIndex !== undefined && sceneIndex !== null) {
      const prompt = body.prompt;
      if (!prompt) {
        return NextResponse.json(
          { error: "Prompt is required for single scene generation" },
          { status: 400 }
        );
      }

      const fullPrompt = `${globalThemePrompt} ${prompt}`.trim();

      console.log(`[GenerateImagesRoute] Triggering Trigger.dev task "generate-scene-images" for ${channelSlug}/${topicSlug} (Scene ${sceneIndex})...`);

      const handle = await tasks.trigger("generate-scene-images", {
        channelSlug,
        topicSlug,
        prompt: fullPrompt,
        sceneIndex,
      });

      console.log(`[GenerateImagesRoute] Task triggered with run ID: ${handle.id}, polling for completion...`);

      const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

      if (run.status !== "COMPLETED") {
        console.error("[GenerateImagesRoute] Trigger.dev run status:", run.status, run.error);
        return NextResponse.json(
          { error: run.error?.message || `Trigger.dev task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      const output = run.output;
      console.log("[GenerateImagesRoute] Trigger.dev task completed successfully:", output);

      return NextResponse.json({
        success: output.success !== false,
        sceneIndex: output.sceneIndex || sceneIndex,
        imageUrl: output.imageUrl || output.publicUrl,
        key: output.key,
        endpointUsed: output.endpointUsed,
        remainingUsage: output.remainingUsage,
        error: output.error,
      });
    }

    // 2. Batch Scenes Generation -> Dispatches Trigger.dev task: generate-scene-images
    if (Array.isArray(scenes) && scenes.length > 0) {
      console.log(`[GenerateImagesRoute] Triggering Trigger.dev task "generate-scene-images" for ${channelSlug}/${topicSlug} (${scenes.length} scenes)...`);

      const handle = await tasks.trigger("generate-scene-images", {
        channelSlug,
        topicSlug,
        scenes,
        globalThemePrompt,
      });

      console.log(`[GenerateImagesRoute] Batch task triggered with run ID: ${handle.id}, polling for completion...`);

      const run = await runs.poll(handle.id, { pollIntervalMs: 1500 });

      if (run.status !== "COMPLETED") {
        console.error("[GenerateImagesRoute] Trigger.dev batch run status:", run.status, run.error);
        return NextResponse.json(
          { error: run.error?.message || `Trigger.dev batch task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      const output = run.output;
      console.log("[GenerateImagesRoute] Trigger.dev batch task completed successfully:", output);

      return NextResponse.json({
        success: true,
        totalScenes: output.totalScenes,
        completedCount: output.completedFrames,
        results: output.frames.map((f) => ({
          sceneIndex: f.sceneIndex,
          success: f.success,
          imageUrl: f.publicUrl,
          key: f.key,
          endpointUsed: f.endpointUsed,
          remainingUsage: f.remainingUsage,
          error: f.error,
        })),
      });
    }

    return NextResponse.json(
      { error: "Provide either a single sceneIndex + prompt or an array of scenes." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[GenerateImagesRoute] Error dispatching Trigger.dev task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger image generation task via Trigger.dev." },
      { status: 500 }
    );
  }
}

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
    const {
      sceneIndex,
      scenes,
      scriptText,
      voice = "af_heart",
      speed = 1.0,
    } = body;

    // 1. Single Scene or Custom Text Generation
    if (sceneIndex !== undefined && sceneIndex !== null) {
      const textToSynthesize = (scriptText || body.text || "").trim();
      if (!textToSynthesize) {
        return NextResponse.json(
          { error: "Narration text is required for single scene audio generation" },
          { status: 400 }
        );
      }

      console.log(`[GenerateAudioRoute] Triggering Trigger.dev task "generate-scene-audio" for Scene ${sceneIndex} (Voice: ${voice})...`);

      const handle = await tasks.trigger("generate-scene-audio", {
        channelSlug,
        topicSlug,
        scriptText: textToSynthesize,
        voice,
        speed,
        sceneIndex,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

      if (run.status !== "COMPLETED") {
        console.error("[GenerateAudioRoute] Trigger.dev audio run error:", run.error);
        return NextResponse.json(
          { error: run.error?.message || `Audio task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      const output = run.output;
      return NextResponse.json({
        success: output.success !== false,
        sceneIndex: output.sceneIndex || sceneIndex,
        audioUrl: output.audioUrl || output.publicUrl,
        key: output.key,
        endpointUsed: output.endpointUsed,
        remainingUsage: output.remainingUsage,
        durationEstimate: output.durationEstimate,
        error: output.error,
      });
    }

    // 2. Batch Scenes Audio Generation
    if (Array.isArray(scenes) && scenes.length > 0) {
      console.log(`[GenerateAudioRoute] Triggering Trigger.dev task "generate-scene-audio" for ${scenes.length} scenes (Voice: ${voice})...`);

      const handle = await tasks.trigger("generate-scene-audio", {
        channelSlug,
        topicSlug,
        scenes,
        voice,
        speed,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

      if (run.status !== "COMPLETED") {
        console.error("[GenerateAudioRoute] Trigger.dev batch audio run error:", run.error);
        return NextResponse.json(
          { error: run.error?.message || `Batch audio task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      const output = run.output;
      return NextResponse.json({
        success: true,
        totalScenes: output.totalScenes,
        completedCount: output.completedAudios,
        results: output.audios.map((a) => ({
          sceneIndex: a.sceneIndex,
          success: a.success,
          audioUrl: a.publicUrl,
          key: a.key,
          endpointUsed: a.endpointUsed,
          remainingUsage: a.remainingUsage,
          durationEstimate: a.durationEstimate,
          error: a.error,
        })),
      });
    }

    return NextResponse.json(
      { error: "Provide either a single sceneIndex + text or an array of scenes." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[GenerateAudioRoute] Error dispatching Trigger.dev audio task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger audio generation task." },
      { status: 500 }
    );
  }
}

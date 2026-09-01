import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";

export const maxDuration = 60; // Max duration for route handler polling

export async function POST(req, context) {
  try {
    const params = await context.params;
    const channelSlug = params?.["channel-name"];
    const topicSlug = params?.["topic-name"];

    if (!channelSlug || !topicSlug) {
      return NextResponse.json(
        { error: "channelSlug and topicSlug are required." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      sceneIndex,
      imageUrl,
      audioUrl,
      kenBurns,
      transition = "fade",
      scenes,
      sceneImages,
      sceneAudios,
    } = body;

    // Single scene render request via Modal
    if (sceneIndex !== undefined) {
      if (!imageUrl || !audioUrl) {
        return NextResponse.json(
          { error: `Scene ${sceneIndex} requires both an image and voice audio narration to render video on Modal.` },
          { status: 400 }
        );
      }

      console.log(`[TestModalRoute] Triggering Modal render task for Scene ${sceneIndex}...`);

      const handle = await tasks.trigger("render-frame-video-modal", {
        channelSlug,
        topicSlug,
        sceneIndex,
        imageUrl,
        audioUrl,
        kenBurns: kenBurns || { direction: "zoom-in", intensity: 0.15 },
        transition,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1500 });

      if (run.status !== "COMPLETED") {
        console.error("[TestModalRoute] Modal single scene run error:", run.error);
        return NextResponse.json(
          { error: run.error?.message || `Modal task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        ...run.output,
      });
    }

    // Batch all scenes render request via Modal
    if (Array.isArray(scenes) && scenes.length > 0) {
      console.log(`[TestModalRoute] Triggering Modal batch render task for ${scenes.length} scene(s)...`);

      const handle = await tasks.trigger("render-frame-video-modal", {
        channelSlug,
        topicSlug,
        scenes,
        sceneImages: sceneImages || {},
        sceneAudios: sceneAudios || {},
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 2000 });

      if (run.status !== "COMPLETED") {
        console.error("[TestModalRoute] Modal batch render run error:", run.error);
        return NextResponse.json(
          { error: run.error?.message || `Modal task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        ...run.output,
      });
    }

    return NextResponse.json(
      { error: "Provide either sceneIndex (for single scene) or scenes array (for batch) to render on Modal." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[TestModalRoute] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error rendering scenes on Modal." },
      { status: 500 }
    );
  }
}

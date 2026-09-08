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

    const body = await req.json();
    const {
      sceneIndex,
      imageUrl,
      imageUrls,
      imagePrompts,
      audioText,
      narration,
      audioUrl,
      kenBurns,
      transition = "fade",
      scenes,
      sceneImages,
      sceneAudios,
    } = body;

    // Single scene render request
    if (sceneIndex !== undefined) {
      if (!imageUrl && (!imageUrls || imageUrls.length === 0)) {
        return NextResponse.json(
          { error: `Scene ${sceneIndex} requires an image to render video.` },
          { status: 400 }
        );
      }
      if (!audioUrl) {
        return NextResponse.json(
          { error: `Scene ${sceneIndex} requires voice audio narration to render video.` },
          { status: 400 }
        );
      }

      console.log(`[GenerateSceneFramesRoute] Triggering single scene video render for Scene ${sceneIndex} (Transition: ${transition})...`);

      const resolvedImageUrls = Array.isArray(imageUrls) && imageUrls.length > 0
        ? imageUrls
        : (imageUrl ? [imageUrl] : []);

      const handle = await tasks.trigger("render-scene-frame", {
        channelSlug,
        topicSlug,
        sceneIndex,
        imageUrl: resolvedImageUrls[0] || imageUrl,
        imageUrls: resolvedImageUrls,
        imagePrompts: imagePrompts || [],
        audioText: audioText || narration || "",
        audioUrl,
        kenBurns: kenBurns || { direction: "zoom-in", intensity: 0.10 },
        transition,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1200 });

      if (run.status !== "COMPLETED") {
        console.error("[GenerateSceneFramesRoute] Single scene video run error:", run.error);
        return NextResponse.json(
          { error: run.error?.message || `Task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        ...run.output,
      });
    }

    // Batch all scenes render request
    if (Array.isArray(scenes) && scenes.length > 0) {
      console.log(`[GenerateSceneFramesRoute] Triggering batch video render for ${scenes.length} scenes...`);

      const handle = await tasks.trigger("render-all-scene-frames", {
        channelSlug,
        topicSlug,
        scenes,
        sceneImages: sceneImages || {},
        sceneAudios: sceneAudios || {},
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1500 });

      if (run.status !== "COMPLETED") {
        console.error("[GenerateSceneFramesRoute] Batch scene video run error:", run.error);
        return NextResponse.json(
          { error: run.error?.message || `Task ended with status ${run.status}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        ...run.output,
      });
    }

    return NextResponse.json(
      { error: "Provide either sceneIndex (single) or scenes array (batch) to generate video frames." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[GenerateSceneFramesRoute] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error generating scene video frames." },
      { status: 500 }
    );
  }
}

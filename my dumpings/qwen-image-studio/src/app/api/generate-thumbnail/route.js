import { NextResponse } from "next/server";

const QWEN_THUMBNAIL_ENDPOINT = process.env.QWEN_THUMBNAIL_ENDPOINT;

export async function POST(request) {
  try {
    if (!QWEN_THUMBNAIL_ENDPOINT) {
      return NextResponse.json(
        {
          error: "QWEN_THUMBNAIL_ENDPOINT is not configured.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    if (!body.prompt || typeof body.prompt !== "string") {
      return NextResponse.json(
        {
          error: "Prompt is required.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(QWEN_THUMBNAIL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        prompt: body.prompt,

        width: body.width || 1664,

        height: body.height || 928,

        num_inference_steps: body.num_inference_steps || 50,

        guidance_scale: body.guidance_scale || 4.0,

        seed: body.seed ?? 42,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.detail || data?.error || "Thumbnail generation failed.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Thumbnail generation error:", error);

    return NextResponse.json(
      {
        error: "Unable to connect to the Qwen thumbnail generation endpoint.",
      },
      { status: 500 },
    );
  }
}

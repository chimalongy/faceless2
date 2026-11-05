import { NextResponse } from "next/server";

const QWEN_IMAGE_ENDPOINT = process.env.QWEN_IMAGE_ENDPOINT;

export async function POST(request) {
  try {
    if (!QWEN_IMAGE_ENDPOINT) {
      return NextResponse.json(
        { error: "QWEN_IMAGE_ENDPOINT is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.prompt || typeof body.prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const response = await fetch(QWEN_IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: body.prompt,
        width: body.width || 1376,
        height: body.height || 768,
        num_inference_steps: body.num_inference_steps || 8,
        seed: body.seed,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error ||
            "Image generation failed.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to connect to the Qwen image generation endpoint.",
      },
      { status: 500 }
    );
  }
}
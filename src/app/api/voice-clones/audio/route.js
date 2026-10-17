import { NextResponse } from "next/server";
import { getReferenceAudio } from "@/lib/voice-cloner";

// GET /api/voice-clones/audio?name=... - Stream reference audio WAV
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const voiceName = searchParams.get("name") || searchParams.get("voice_name");

    if (!voiceName || !voiceName.trim()) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }

    const audioBuffer = await getReferenceAudio(voiceName.trim());

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `inline; filename="${encodeURIComponent(voiceName.trim())}-reference.wav"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load reference audio" },
      { status: 404 }
    );
  }
}

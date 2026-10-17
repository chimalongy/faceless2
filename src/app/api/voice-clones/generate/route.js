import { NextResponse } from "next/server";
import { generateClonedAudio } from "@/lib/voice-cloner";

// POST /api/voice-clones/generate - Generate synthesized speech from cloned voice
export async function POST(request) {
  try {
    const body = await request.json();
    const voiceName = body.voiceName || body.voice_name || "";
    const text = body.text || "";
    const language = body.language || "English";

    if (!voiceName.trim()) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "Text to synthesize is required" }, { status: 400 });
    }

    const audioBuffer = await generateClonedAudio({
      voiceName: voiceName.trim(),
      text: text.trim(),
      language: language.trim() || "English",
    });

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(voiceName.trim())}-speech.wav"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating cloned audio:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate cloned audio" },
      { status: 500 }
    );
  }
}

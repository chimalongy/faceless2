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

    let audioBuffer = null;
    let audioUrl = null;

    try {
      const { tasks, runs } = await import("@trigger.dev/sdk");
      const handle = await tasks.trigger("voice-cloner", {
        action: "generate",
        voiceName: voiceName.trim(),
        text: text.trim(),
        language: language.trim() || "English",
        saveToR2: true,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });
      if (run.status !== "COMPLETED") {
        throw new Error(run.error?.message || `Voice synthesis task ended with status ${run.status}`);
      }

      if (run.output?.audioBase64) {
        audioBuffer = Buffer.from(run.output.audioBase64, "base64");
      }
      audioUrl = run.output?.audioUrl || null;
    } catch (triggerErr) {
      console.warn("[VoiceClonesGenerate] Trigger.dev error or unavailable, falling back to direct Modal call:", triggerErr.message);
      audioBuffer = await generateClonedAudio({
        voiceName: voiceName.trim(),
        text: text.trim(),
        language: language.trim() || "English",
      });
    }

    if (!audioBuffer) {
      throw new Error("No audio returned from voice cloning service");
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(voiceName.trim())}-speech.wav"`,
        "Cache-Control": "no-store",
        ...(audioUrl ? { "X-Audio-Url": audioUrl } : {}),
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

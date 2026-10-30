import { NextResponse } from "next/server";
import {
  listVoiceClones,
  createVoiceClone,
  deleteVoiceClone,
  checkVoiceClonerHealth,
  resolveModalVoiceCloneUrl,
} from "@/lib/voice-cloner";

const MODEL = "qwen";

// GET /api/voice-clones/qwen - List Qwen3-TTS clones and check health
export async function GET() {
  try {
    const [listResult, healthResult] = await Promise.all([
      listVoiceClones(MODEL),
      checkVoiceClonerHealth(MODEL),
    ]);

    return NextResponse.json({
      success: true,
      model: MODEL,
      modelName: "Qwen3-TTS 1.7B Base (L4)",
      endpoint: listResult.endpoint || healthResult.endpoint,
      online: healthResult.online,
      voices: listResult.voices || [],
      count: listResult.count || 0,
      error: listResult.error || (!healthResult.online ? healthResult.error : null),
    });
  } catch (error) {
    console.error("Error fetching Qwen voice clones:", error);
    return NextResponse.json(
      { success: false, model: MODEL, error: error.message, voices: [], count: 0 },
      { status: 500 }
    );
  }
}

// POST /api/voice-clones/qwen - Register a new Qwen3-TTS voice clone
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let voiceName = "";
    let refText = "";
    let refAudioBase64 = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      voiceName = (formData.get("voiceName") || formData.get("voice_name") || "").toString();
      refText = (formData.get("refText") || formData.get("ref_text") || "").toString();
      const file = formData.get("audioFile") || formData.get("audio") || formData.get("file");

      if (file && typeof file.arrayBuffer === "function") {
        const buffer = await file.arrayBuffer();
        refAudioBase64 = Buffer.from(buffer).toString("base64");
      }
    } else {
      const body = await request.json();
      voiceName = body.voiceName || body.voice_name || "";
      refText = body.refText || body.ref_text || "";
      refAudioBase64 = body.refAudioBase64 || body.ref_audio_base64 || "";
    }

    if (!voiceName.trim()) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }
    if (!refText.trim()) {
      return NextResponse.json({ error: "Reference text is required" }, { status: 400 });
    }
    if (!refAudioBase64) {
      return NextResponse.json({ error: "Reference audio file is required" }, { status: 400 });
    }

    let result = null;
    try {
      const { tasks, runs } = await import("@trigger.dev/sdk");
      const handle = await tasks.trigger("voice-cloner", {
        action: "register",
        voiceName: voiceName.trim(),
        refText: refText.trim(),
        refAudioBase64,
        model: MODEL,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });
      if (run.status !== "COMPLETED") {
        throw new Error(run.error?.message || `Voice cloner task ended with status ${run.status}`);
      }
      result = run.output?.registration || run.output;
    } catch (triggerErr) {
      console.warn("[VoiceClonesQwenRoute] Trigger.dev unavailable or failed, falling back to direct Modal call:", triggerErr.message);
      result = await createVoiceClone({
        voiceName: voiceName.trim(),
        refText: refText.trim(),
        refAudioBase64,
        model: MODEL,
      });
    }

    return NextResponse.json({
      success: true,
      model: MODEL,
      ...result,
    });
  } catch (error) {
    console.error("Error creating Qwen voice clone:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create Qwen voice clone" },
      { status: error.message?.includes("already registered") ? 409 : 500 }
    );
  }
}

// DELETE /api/voice-clones/qwen?name=... - Delete a Qwen voice clone
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let voiceName = searchParams.get("name") || searchParams.get("voice_name");

    if (!voiceName) {
      try {
        const body = await request.json();
        voiceName = body.voiceName || body.voice_name;
      } catch {}
    }

    if (!voiceName || !voiceName.trim()) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }

    const result = await deleteVoiceClone(voiceName.trim(), MODEL);
    return NextResponse.json({
      success: true,
      model: MODEL,
      ...result,
    });
  } catch (error) {
    console.error("Error deleting Qwen voice clone:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete voice clone" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  listVoiceClones,
  createVoiceClone,
  deleteVoiceClone,
  checkVoiceClonerHealth,
  resolveModalVoiceCloneUrl,
} from "@/lib/voice-cloner";

// GET /api/voice-clones - List all registered voice clones and check cloner health
export async function GET() {
  try {
    const [listResult, healthResult] = await Promise.all([
      listVoiceClones(),
      checkVoiceClonerHealth(),
    ]);

    return NextResponse.json({
      success: true,
      endpoint: listResult.endpoint || healthResult.endpoint,
      online: healthResult.online,
      voices: listResult.voices || [],
      count: listResult.count || 0,
      error: listResult.error || (!healthResult.online ? healthResult.error : null),
    });
  } catch (error) {
    console.error("Error fetching voice clones:", error);
    return NextResponse.json(
      { success: false, error: error.message, voices: [], count: 0 },
      { status: 500 }
    );
  }
}

// POST /api/voice-clones - Register a new voice clone
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

    const result = await createVoiceClone({
      voiceName: voiceName.trim(),
      refText: refText.trim(),
      refAudioBase64,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error creating voice clone:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create voice clone" },
      { status: error.message?.includes("already registered") ? 409 : 500 }
    );
  }
}

// DELETE /api/voice-clones?name=... - Delete a voice clone
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

    const result = await deleteVoiceClone(voiceName.trim());
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error deleting voice clone:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete voice clone" },
      { status: 500 }
    );
  }
}

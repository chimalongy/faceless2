import { NextResponse } from "next/server";
import {
  listVoiceClones,
  createVoiceClone,
  deleteVoiceClone,
  checkVoiceClonerHealth,
  resolveModalVoiceCloneUrl,
} from "@/lib/voice-cloner";

// GET /api/voice-clones - List voice clones strictly from Database (zero Modal GPU cold-starts)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelFilter = searchParams.get("model");
    const sync = searchParams.get("sync") === "true";

    const [listResult, fishUrl, qwenUrl] = await Promise.all([
      listVoiceClones({ model: modelFilter || undefined, syncWithModal: sync }),
      resolveModalVoiceCloneUrl("fish"),
      resolveModalVoiceCloneUrl("qwen"),
    ]);

    return NextResponse.json({
      success: true,
      endpoint: fishUrl || qwenUrl,
      online: true,
      models: {
        fish: {
          name: "Fish Audio S2 Pro (T4)",
          online: Boolean(fishUrl),
          endpoint: fishUrl,
        },
        qwen: {
          name: "Qwen3-TTS 1.7B Base (L4)",
          online: Boolean(qwenUrl),
          endpoint: qwenUrl,
        },
      },
      voices: listResult.voices || [],
      count: listResult.count || 0,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching voice clones:", error);
    return NextResponse.json(
      { success: false, error: error.message, voices: [], count: 0 },
      { status: 500 }
    );
  }
}

// POST /api/voice-clones - Register a new voice clone with selected model
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let voiceName = "";
    let refText = "";
    let refAudioBase64 = "";
    let model = "fish"; // default to fish s2

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      voiceName = (formData.get("voiceName") || formData.get("voice_name") || "").toString();
      refText = (formData.get("refText") || formData.get("ref_text") || "").toString();
      model = (formData.get("model") || formData.get("model_type") || "fish").toString();
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
      model = body.model || body.model_type || "fish";
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

    const sanitizedModel = model.toLowerCase().includes("qwen") ? "qwen" : "fish";

    let result = null;
    try {
      const { tasks, runs } = await import("@trigger.dev/sdk");
      const handle = await tasks.trigger("voice-cloner", {
        action: "register",
        voiceName: voiceName.trim(),
        refText: refText.trim(),
        refAudioBase64,
        model: sanitizedModel,
      });

      const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });
      if (run.status !== "COMPLETED") {
        throw new Error(run.error?.message || `Voice cloner task ended with status ${run.status}`);
      }
      result = run.output?.registration || run.output;
    } catch (triggerErr) {
      console.warn("[VoiceClonesRoute] Trigger.dev execution error or unavailable, falling back to direct Modal call:", triggerErr.message);
      result = await createVoiceClone({
        voiceName: voiceName.trim(),
        refText: refText.trim(),
        refAudioBase64,
        model: sanitizedModel,
      });
    }

    return NextResponse.json({
      success: true,
      model: sanitizedModel,
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
    const model = searchParams.get("model");

    if (!voiceName) {
      try {
        const body = await request.json();
        voiceName = body.voiceName || body.voice_name;
      } catch {}
    }

    if (!voiceName || !voiceName.trim()) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }

    const result = await deleteVoiceClone(voiceName.trim(), model || undefined);
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

import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { generateAudio } from "@/lib/audio-generator";
import { applyAudioEffects, buildAudioFilterString, AUDIO_EFFECT_PRESETS } from "@/lib/audio-effects";

export const maxDuration = 60;

// GET /api/channels/[channel-name]/audio-effects
export async function GET(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const rows = await sql`
      SELECT 
        id, 
        name, 
        slug, 
        default_voice AS "defaultVoice", 
        tts_model AS "ttsModel", 
        audio_theme AS "audioTheme", 
        audio_effects AS "audioEffects"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = rows[0];

    return NextResponse.json({
      success: true,
      channelSlug,
      channelName: channel.name,
      defaultVoice: channel.defaultVoice || "af_heart",
      ttsModel: channel.ttsModel || "kokoro",
      audioTheme: channel.audioTheme || "",
      audioEffects: channel.audioEffects || { enabled: false, preset: "none" },
      presets: AUDIO_EFFECT_PRESETS,
    });
  } catch (err) {
    console.error("Error fetching audio effects:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load channel audio effects" },
      { status: 500 }
    );
  }
}

// POST /api/channels/[channel-name]/audio-effects
export async function POST(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const channelRows = await sql`
      SELECT id, name, slug, default_voice, tts_model, audio_theme, audio_effects
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = channelRows[0];
    const body = await request.json();
    const action = body.action || "save";

    // Sub-action: Preview audio filter with short synthesis
    if (action === "preview") {
      const sampleText = (
        body.text ||
        "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity to improve our condition."
      ).trim();

      const testVoice = body.voice || channel.default_voice || "af_heart";
      const testModel = body.ttsModel || channel.tts_model || "kokoro";
      const testInstruct = body.instruct || channel.audio_theme || null;
      const audioEffectsConfig = body.audioEffects || { enabled: true };

      // 1. Synthesize sample TTS narration
      const audioResult = await generateAudio({
        text: sampleText,
        voice: testVoice,
        ttsModel: testModel,
        instruct: testInstruct,
        format: "wav",
      });

      // 2. Apply FFmpeg audio post-processing filter
      const fxResult = await applyAudioEffects(audioResult.audioBuffer, {
        ...audioEffectsConfig,
        enabled: true, // Force enabled for preview
      });

      return NextResponse.json({
        success: true,
        filterApplied: fxResult.filterApplied || buildAudioFilterString(audioEffectsConfig),
        rawAudioUrl: `data:audio/wav;base64,${audioResult.audioBuffer.toString("base64")}`,
        processedAudioUrl: `data:audio/wav;base64,${fxResult.buffer.toString("base64")}`,
        sampleText,
        voiceUsed: testVoice,
        ttsModelUsed: testModel,
      });
    }

    // Default Action: Save audio_effects settings to database
    const audioEffects = body.audioEffects || {};

    await sql`
      UPDATE channels
      SET audio_effects = ${JSON.stringify(audioEffects)}::jsonb,
          updated_at = NOW()
      WHERE slug = ${channelSlug};
    `;

    return NextResponse.json({
      success: true,
      message: "Audio post-processing settings saved successfully",
      audioEffects,
    });
  } catch (err) {
    console.error("Error updating audio effects:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save audio effects" },
      { status: 500 }
    );
  }
}

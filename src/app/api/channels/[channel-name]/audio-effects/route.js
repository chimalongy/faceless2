import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { generateAudio } from "@/lib/audio-generator";
import { applyAudioEffects, buildAudioFilterString, AUDIO_EFFECT_PRESETS } from "@/lib/audio-effects";
import { uploadToR2, deleteFromR2, getPresignedR2UploadUrl } from "@/lib/storage";

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
        audio_effects AS "audioEffects",
        background_music AS "backgroundMusic"
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
      backgroundMusic: channel.backgroundMusic || {
        enabled: false,
        fileUrl: null,
        fileKey: null,
        fileName: null,
        volume: 0.15,
      },
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
      SELECT id, name, slug, default_voice, tts_model, audio_theme, audio_effects, background_music
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = channelRows[0];

    // Handle Multipart Form Upload for Background Music
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No audio file provided for upload" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const originalName = file.name || "background-music.mp3";
      const ext = originalName.includes(".") ? originalName.split(".").pop().toLowerCase() : "mp3";
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const key = `channels/${channelSlug}/background-music/bgm-${timestamp}-${randomSuffix}.${ext}`;
      const mimeType = file.type || "audio/mpeg";

      // If replacing an existing background music track, clean up the previous file from R2
      const existingKey = channel.background_music?.fileKey;
      if (existingKey) {
        try {
          await deleteFromR2(existingKey);
        } catch (delErr) {
          console.warn("[audio-effects] Failed to delete previous background music from R2:", delErr);
        }
      }

      const uploadResult = await uploadToR2({
        key,
        buffer,
        mimeType,
        metadata: {
          channelSlug,
          originalName,
          assetType: "background-music",
        },
      });

      return NextResponse.json({
        success: true,
        fileUrl: uploadResult.publicUrl,
        fileKey: uploadResult.key,
        fileName: originalName,
        sizeBytes: buffer.length,
      });
    }

    // JSON Payload Actions
    const body = await request.json();
    const action = body.action || "save";

    // Action: Generate Presigned URL for Direct Cloudflare R2 Upload (bypasses Vercel 4.5MB payload limit)
    if (action === "presign_music") {
      const fileName = body.fileName || "background-music.mp3";
      const mimeType = body.mimeType || "audio/mpeg";
      const ext = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "mp3";
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const key = `channels/${channelSlug}/background-music/bgm-${timestamp}-${randomSuffix}.${ext}`;

      // Clean up previous background music from R2 if one existed
      const existingKey = channel.background_music?.fileKey;
      if (existingKey) {
        try {
          await deleteFromR2(existingKey);
        } catch (delErr) {
          console.warn("[audio-effects] Failed to delete previous background music from R2:", delErr);
        }
      }

      const presigned = await getPresignedR2UploadUrl({
        key,
        mimeType,
        expiresIn: 3600,
      });

      return NextResponse.json({
        success: true,
        uploadUrl: presigned.uploadUrl,
        publicUrl: presigned.publicUrl,
        fileKey: presigned.key,
        fileName,
      });
    }

    // Action: Delete background music file
    if (action === "delete_music") {
      const fileKey = body.fileKey || channel.background_music?.fileKey;
      if (fileKey) {
        try {
          await deleteFromR2(fileKey);
        } catch (delErr) {
          console.warn("[audio-effects] Failed to delete background music from R2:", delErr);
        }
      }

      const updatedBgMusic = {
        ...(channel.background_music || {}),
        enabled: false,
        fileUrl: null,
        fileKey: null,
        fileName: null,
      };

      await sql`
        UPDATE channels
        SET background_music = ${JSON.stringify(updatedBgMusic)}::jsonb,
            updated_at = NOW()
        WHERE slug = ${channelSlug};
      `;

      return NextResponse.json({
        success: true,
        message: "Background music removed successfully",
        backgroundMusic: updatedBgMusic,
      });
    }

    // Action: Preview voice filter with sample synthesis
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

    // Action: Save audio_effects & background_music settings to database
    const audioEffects = body.audioEffects !== undefined ? body.audioEffects : (channel.audio_effects || {});
    const backgroundMusic = body.backgroundMusic !== undefined ? body.backgroundMusic : (channel.background_music || { enabled: false, volume: 0.15 });

    await sql`
      UPDATE channels
      SET audio_effects = ${JSON.stringify(audioEffects)}::jsonb,
          background_music = ${JSON.stringify(backgroundMusic)}::jsonb,
          updated_at = NOW()
      WHERE slug = ${channelSlug};
    `;

    return NextResponse.json({
      success: true,
      message: "Audio and background music settings saved successfully",
      audioEffects,
      backgroundMusic,
    });
  } catch (err) {
    console.error("Error updating audio effects:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save audio effects" },
      { status: 500 }
    );
  }
}

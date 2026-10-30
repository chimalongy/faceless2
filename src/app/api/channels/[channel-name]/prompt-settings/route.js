import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { SCRIPT_GENERATION_SYSTEM_PROMPT } from "@/lib/LLMPrompts/ScriptGenerationPrompt";
import { SHORT_SCRIPT_GENERATION_SYSTEM_PROMPT } from "@/lib/LLMPrompts/ShortScriptGenerationPrompt";
import { SCENE_GENERATION_SYSTEM_PROMPT } from "@/lib/LLMPrompts/SceneGenerationPrompt";
import { SHORT_SCENE_GENERATION_SYSTEM_PROMPT } from "@/lib/LLMPrompts/ShortSceneGenerationPrompt";
import { THUMBNAIL_PROMPT_SYSTEM_PROMPT } from "@/lib/LLMPrompts/ThumbnailPromptGeneration";

export const DEFAULT_PROMPTS = {
  scriptPrompt: SCRIPT_GENERATION_SYSTEM_PROMPT,
  shortScriptPrompt: SHORT_SCRIPT_GENERATION_SYSTEM_PROMPT,
  scenePrompt: SCENE_GENERATION_SYSTEM_PROMPT,
  shortScenePrompt: SHORT_SCENE_GENERATION_SYSTEM_PROMPT,
  thumbnailPrompt: THUMBNAIL_PROMPT_SYSTEM_PROMPT,
};

export const PROMPT_VARIABLES = {
  script: [
    { tag: "{channel_name}", label: "Channel Name", desc: "Full name of this channel" },
    { tag: "{channel_niche}", label: "Niche", desc: "Primary channel niche" },
    { tag: "{channel_sub_niche}", label: "Sub-Niche", desc: "Specific sub-niche" },
    { tag: "{channel_description}", label: "Description", desc: "Core channel description" },
    { tag: "{channel_mission}", label: "Mission", desc: "Channel mission & vision" },
    { tag: "{content_pillar_name}", label: "Pillar Name", desc: "Selected content pillar title" },
    { tag: "{content_pillar_category_tag}", label: "Pillar Tag", desc: "Category tag of content pillar" },
    { tag: "{content_pillar_tone}", label: "Pillar Tone", desc: "Authoritative voice & narrative tone" },
    { tag: "{content_pillar_length}", label: "Target Length", desc: "Target video duration (e.g. 8-12 mins)" },
    { tag: "{content_pillar_words_count}", label: "Word Count", desc: "Target script word count (e.g. 1400-1800 words)" },
    { tag: "{content_pillar_description}", label: "Pillar Desc", desc: "Strategic directive for this pillar" },
    { tag: "{topic}", label: "Topic Title", desc: "Exact title of the video topic" },
    { tag: "{channel_script_structure_block}", label: "Script Structure", desc: "Channel hook, retention & delivery blueprint" },
  ],
  scenes: [
    { tag: "{CHANNEL_NAME}", label: "Channel Name", desc: "Name of the channel" },
    { tag: "{CHANNEL_NICHE}", label: "Niche", desc: "Niche and category" },
    { tag: "{CHANNEL_DESCRIPTION}", label: "Description", desc: "Channel positioning & audience" },
    { tag: "{CHANNEL_MISSION}", label: "Mission", desc: "Channel mission statement" },
    { tag: "{CHANNEL_IMAGE_THEME}", label: "Image Theme", desc: "Artistic style, lighting & visual universe" },
    { tag: "{CONTENT_PILLAR_NAME}", label: "Pillar Name", desc: "Active content pillar" },
    { tag: "{CONTENT_PILLAR_CATEGORY_TAG}", label: "Pillar Tag", desc: "Content pillar category tag" },
    { tag: "{CONTENT_PILLAR_TONE}", label: "Pillar Tone", desc: "Emotional tone & visual mood" },
    { tag: "{CONTENT_PILLAR_DESCRIPTION}", label: "Pillar Desc", desc: "Visual storytelling guidance" },
    { tag: "{USE_MAIN_CHARACTER}", label: "Use Main Character", desc: "True / False flag" },
    { tag: "{MAIN_CHARACTER_DESCRIPTION}", label: "Character Spec", desc: "Consistent recurring character details" },
    { tag: "{ACTIVE_SCRIPT}", label: "Active Script", desc: "The verbatim narration script to convert into scenes" },
  ],
  thumbnail: [
    { tag: "{channel_image_generation_theme}", label: "Image Theme", desc: "Overarching visual and artistic universe" },
    { tag: "{channel_thumbnail_generation_theme}", label: "Thumbnail Theme", desc: "Primary thumbnail composition & hierarchy rules" },
    { tag: "{topic}", label: "Topic Title", desc: "Target video topic title" },
  ],
};

function normalizePromptSettings(raw = {}) {
  const settings = raw && typeof raw === "object" ? raw : {};
  return {
    scriptPrompt: typeof settings.scriptPrompt === "string" && settings.scriptPrompt.trim().length > 0
      ? settings.scriptPrompt
      : (typeof settings.script_prompt === "string" && settings.script_prompt.trim().length > 0 ? settings.script_prompt : null),
    shortScriptPrompt: typeof settings.shortScriptPrompt === "string" && settings.shortScriptPrompt.trim().length > 0
      ? settings.shortScriptPrompt
      : (typeof settings.short_script_prompt === "string" && settings.short_script_prompt.trim().length > 0 ? settings.short_script_prompt : null),
    scenePrompt: typeof settings.scenePrompt === "string" && settings.scenePrompt.trim().length > 0
      ? settings.scenePrompt
      : (typeof settings.scene_prompt === "string" && settings.scene_prompt.trim().length > 0 ? settings.scene_prompt : null),
    shortScenePrompt: typeof settings.shortScenePrompt === "string" && settings.shortScenePrompt.trim().length > 0
      ? settings.shortScenePrompt
      : (typeof settings.short_scene_prompt === "string" && settings.short_scene_prompt.trim().length > 0 ? settings.short_scene_prompt : null),
    thumbnailPrompt: typeof settings.thumbnailPrompt === "string" && settings.thumbnailPrompt.trim().length > 0
      ? settings.thumbnailPrompt
      : (typeof settings.thumbnail_prompt === "string" && settings.thumbnail_prompt.trim().length > 0 ? settings.thumbnail_prompt : null),
  };
}

// GET /api/channels/[channel-name]/prompt-settings
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
      SELECT id, name, slug, prompt_settings AS "promptSettings"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = rows[0];
    const promptSettings = normalizePromptSettings(channel.promptSettings);

    return NextResponse.json({
      success: true,
      channelId: channel.id,
      channelName: channel.name,
      channelSlug: channel.slug,
      promptSettings,
      defaults: DEFAULT_PROMPTS,
      placeholders: PROMPT_VARIABLES,
    });
  } catch (error) {
    console.error("[PromptSettings] GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch prompt settings" }, { status: 500 });
  }
}

// PUT /api/channels/[channel-name]/prompt-settings
export async function PUT(request, { params }) {
  try {
    const rawSlug = (await params)?.["channel-name"] || "";
    const channelSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    const body = await request.json().catch(() => ({}));
    const incoming = body.promptSettings || body;
    const normalized = normalizePromptSettings(incoming);

    const updatedRows = await sql`
      UPDATE channels
      SET 
        prompt_settings = ${JSON.stringify(normalized)}::jsonb,
        updated_at = NOW()
      WHERE slug = ${channelSlug}
      RETURNING id, name, slug, prompt_settings AS "promptSettings";
    `;

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const savedSettings = normalizePromptSettings(updatedRows[0].promptSettings);

    return NextResponse.json({
      success: true,
      message: "Prompt settings saved successfully",
      promptSettings: savedSettings,
      defaults: DEFAULT_PROMPTS,
      placeholders: PROMPT_VARIABLES,
    });
  } catch (error) {
    console.error("[PromptSettings] PUT error:", error);
    return NextResponse.json({ error: error.message || "Failed to save prompt settings" }, { status: 500 });
  }
}


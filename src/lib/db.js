import { Pool, neon } from "@neondatabase/serverless";

// Singleton connection pool instance for serverless environments
let poolInstance = null;

export function getDbPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: databaseUrl });
  }
  return poolInstance;
}

export function getDbSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }
  return neon(databaseUrl);
}

// Automatically create database schema if tables do not exist yet
export async function initDbSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not configured. Database initialization skipped.");
    return false;
  }

  const sql = neon(databaseUrl);

  try {
    // 1. Channels Table
    await sql`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        handle TEXT,
        channel_url TEXT,
        description TEXT,
        tagline TEXT,
        niche TEXT,
        sub_niche TEXT,
        content_category TEXT,
        target_audience TEXT,
        mission TEXT,
        value_proposition TEXT,
        personality TEXT,
        brand_positioning TEXT,
        brand_promise TEXT,
        image_theme TEXT,
        thumbnail_theme TEXT,
        audio_theme TEXT,
        banner_url TEXT,
        avatar_url TEXT,
        default_voice TEXT DEFAULT 'af_heart',
        postershive_api TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS banner_url TEXT;`;
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS avatar_url TEXT;`;
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS default_voice TEXT DEFAULT 'af_heart';`;
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS postershive_api TEXT;`;
    } catch {}

    // 2. Content Pillars Table
    await sql`
      CREATE TABLE IF NOT EXISTS content_pillars (
        id SERIAL PRIMARY KEY,
        channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        tag TEXT,
        description TEXT,
        tone TEXT,
        content_length TEXT,
        content_words_count TEXT,
        use_main_character BOOLEAN DEFAULT FALSE,
        main_character_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, slug)
      );
    `;

    try {
      await sql`ALTER TABLE content_pillars ADD COLUMN IF NOT EXISTS tone TEXT;`;
      await sql`ALTER TABLE content_pillars ADD COLUMN IF NOT EXISTS content_length TEXT;`;
      await sql`ALTER TABLE content_pillars ADD COLUMN IF NOT EXISTS content_words_count TEXT;`;
      await sql`ALTER TABLE content_pillars ADD COLUMN IF NOT EXISTS use_main_character BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE content_pillars ADD COLUMN IF NOT EXISTS main_character_description TEXT;`;
    } catch {}

    // 3. Topics Table
    await sql`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        pillar_id INT REFERENCES content_pillars(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        script_content TEXT,
        scenes_json JSONB,
        thumbnail_url TEXT,
        thumbnail_prompt TEXT,
        story_description TEXT,
        master_video_url TEXT,
        youtube_video_id TEXT,
        youtube_url TEXT,
        youtube_published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, slug)
      );
    `;

    try {
      await sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS story_description TEXT;`;
      await sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS story_discription TEXT;`;
      await sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;`;
      await sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS youtube_url TEXT;`;
      await sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS youtube_published_at TIMESTAMPTZ;`;
    } catch {}

    // 4. Topic Assets Table (Cloudflare R2 media links)
    await sql`
      CREATE TABLE IF NOT EXISTS topic_assets (
        id SERIAL PRIMARY KEY,
        topic_id INT REFERENCES topics(id) ON DELETE CASCADE,
        channel_id INT REFERENCES channels(id) ON DELETE CASCADE,
        asset_type TEXT NOT NULL, -- 'thumbnail', 'audio', 'image', 'video', 'completedvideo'
        scene_index INT,
        file_url TEXT NOT NULL,
        file_key TEXT NOT NULL,
        file_name TEXT,
        mime_type TEXT,
        size_bytes BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 5. Image Endpoints Table
    await sql`
      CREATE TABLE IF NOT EXISTS image_endpoints (
        id SERIAL PRIMARY KEY,
        account_email TEXT NOT NULL,
        gen_url TEXT NOT NULL,
        usage INT DEFAULT 0,
        last_reset_month TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 6. Audio Endpoints Table
    await sql`
      CREATE TABLE IF NOT EXISTS audio_endpoints (
        id SERIAL PRIMARY KEY,
        account_email TEXT NOT NULL,
        gen_url TEXT NOT NULL,
        usage INT DEFAULT 0,
        last_reset_month TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 7. LLM Accounts Table
    await sql`
      CREATE TABLE IF NOT EXISTS llm_accounts (
        id SERIAL PRIMARY KEY,
        account_email TEXT NOT NULL,
        source TEXT DEFAULT 'gemini',
        account_id TEXT,
        api_token TEXT NOT NULL,
        created TIMESTAMPTZ DEFAULT NOW(),
        updated TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 8. General Settings Table
    await sql`
      CREATE TABLE IF NOT EXISTS general_settings (
        id SERIAL PRIMARY KEY,
        default_llm_source TEXT DEFAULT 'gemini',
        default_llm_model TEXT DEFAULT 'gemini-2.5-flash',
        script_gen_source TEXT DEFAULT 'gemini',
        script_gen_strict_source BOOLEAN DEFAULT false,
        script_gen_model TEXT DEFAULT 'gemini-2.5-flash',
        script_gen_strict_model BOOLEAN DEFAULT false,
        scene_gen_source TEXT DEFAULT 'gemini',
        scene_gen_strict_source BOOLEAN DEFAULT false,
        scene_gen_model TEXT DEFAULT 'gemini-2.5-flash',
        scene_gen_strict_model BOOLEAN DEFAULT false,
        gemma_base_url TEXT DEFAULT 'https://generativelanguage.googleapis.com/v1beta/openai/',
        open_router_base_url TEXT DEFAULT 'https://openrouter.ai/api/v1',
        modal_video_render_url TEXT DEFAULT 'https://me-chimaobi--faceless-video-renderer-api.modal.run',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE image_endpoints ADD COLUMN IF NOT EXISTS last_reset_month TEXT;`;
      await sql`ALTER TABLE audio_endpoints ADD COLUMN IF NOT EXISTS last_reset_month TEXT;`;
      await sql`ALTER TABLE llm_accounts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'gemini';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS default_llm_source TEXT DEFAULT 'gemini';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS default_llm_model TEXT DEFAULT 'gemini-2.5-flash';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS script_gen_source TEXT DEFAULT 'gemini';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS script_gen_strict_source BOOLEAN DEFAULT false;`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS script_gen_model TEXT DEFAULT 'gemini-2.5-flash';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS script_gen_strict_model BOOLEAN DEFAULT false;`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS scene_gen_source TEXT DEFAULT 'gemini';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS scene_gen_strict_source BOOLEAN DEFAULT false;`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS scene_gen_model TEXT DEFAULT 'gemini-2.5-flash';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS scene_gen_strict_model BOOLEAN DEFAULT false;`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS gemma_base_url TEXT DEFAULT 'https://generativelanguage.googleapis.com/v1beta/openai/';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS open_router_base_url TEXT DEFAULT 'https://openrouter.ai/api/v1';`;
      await sql`ALTER TABLE general_settings ADD COLUMN IF NOT EXISTS modal_video_render_url TEXT DEFAULT 'https://me-chimaobi--faceless-video-renderer-api.modal.run';`;
    } catch {}

    return true;
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    return false;
  }
}

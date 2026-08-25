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
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS banner_url TEXT;`;
      await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS avatar_url TEXT;`;
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
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, slug)
      );
    `;

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
        master_video_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, slug)
      );
    `;

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

    try {
      await sql`ALTER TABLE image_endpoints ADD COLUMN IF NOT EXISTS last_reset_month TEXT;`;
      await sql`ALTER TABLE audio_endpoints ADD COLUMN IF NOT EXISTS last_reset_month TEXT;`;
    } catch {}

    return true;
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    return false;
  }
}

-- ==============================================================================
-- FACELESS 2.0 - NEON POSTGRESQL DATABASE SCHEMA
-- ==============================================================================
-- Run this script in the Neon SQL Editor or via psql to create the full relational schema.

-- 1. CHANNELS TABLE
-- Stores channel identity, social handles, URLs, and all 17 canonical brand strategy & theme directives.
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

-- 2. CONTENT PILLARS TABLE
-- Stores content pillars referencing channel_id foreign key.
CREATE TABLE IF NOT EXISTS content_pillars (
    id SERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    tag TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_channel_pillar UNIQUE (channel_id, slug)
);

-- 3. TOPICS TABLE
-- Stores story topics referencing channel_id and pillar_id foreign keys, with script, scenes, thumbnail, and master cut.
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
    CONSTRAINT uq_channel_topic UNIQUE (channel_id, slug)
);

-- 4. TOPIC ASSETS TABLE
-- Records media files stored in Cloudflare R2 bucket (thumbnails, audio voiceovers, scene images, video clips, master cuts).
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

-- 5. IMAGE ENDPOINTS TABLE
-- Multiple image generation accounts with generation URLs and integer usage counters.
CREATE TABLE IF NOT EXISTS image_endpoints (
    id SERIAL PRIMARY KEY,
    account_email TEXT NOT NULL,
    gen_url TEXT NOT NULL,
    usage INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AUDIO ENDPOINTS TABLE
-- Multiple audio/TTS accounts with generation URLs and integer usage counters.
CREATE TABLE IF NOT EXISTS audio_endpoints (
    id SERIAL PRIMARY KEY,
    account_email TEXT NOT NULL,
    gen_url TEXT NOT NULL,
    usage INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LLM ACCOUNTS TABLE
-- Multiple LLM accounts with provider account ID, API token/key, and timestamps.
CREATE TABLE IF NOT EXISTS llm_accounts (
    id SERIAL PRIMARY KEY,
    account_email TEXT NOT NULL,
    account_id TEXT,
    api_token TEXT NOT NULL,
    created TIMESTAMPTZ DEFAULT NOW(),
    updated TIMESTAMPTZ DEFAULT NOW()
);

-- 8. GENERAL SETTINGS TABLE
-- Stores global system configuration such as default LLM model, script gen model, and scene gen model.
CREATE TABLE IF NOT EXISTS general_settings (
    id SERIAL PRIMARY KEY,
    default_llm_model TEXT DEFAULT '@cf/meta/llama-3.1-70b-instruct',
    script_gen_model TEXT DEFAULT '@cf/meta/llama-3.1-70b-instruct',
    scene_gen_model TEXT DEFAULT '@cf/meta/llama-3.1-70b-instruct',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR HIGH-SPEED QUERIES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug);
CREATE INDEX IF NOT EXISTS idx_pillars_channel_id ON content_pillars(channel_id);
CREATE INDEX IF NOT EXISTS idx_topics_channel_id ON topics(channel_id);
CREATE INDEX IF NOT EXISTS idx_topics_pillar_id ON topics(pillar_id);
CREATE INDEX IF NOT EXISTS idx_topic_assets_topic_id ON topic_assets(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_assets_channel_id ON topic_assets(channel_id);
CREATE INDEX IF NOT EXISTS idx_image_endpoints_email ON image_endpoints(account_email);
CREATE INDEX IF NOT EXISTS idx_audio_endpoints_email ON audio_endpoints(account_email);
CREATE INDEX IF NOT EXISTS idx_llm_accounts_email ON llm_accounts(account_email);

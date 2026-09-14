import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

// GET /api/channels/[channel-name]/topics/[topic-name] - Fetch single topic with studio details
export async function GET(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ topic: null }, { status: 404 });
    }

    await initDbSchema();

    const topics = await sql`
      SELECT 
        t.id,
        t.channel_id AS "channelId",
        c.slug AS "channelSlug",
        c.name AS "channelName",
        c.niche AS "channelNiche",
        c.sub_niche AS "channelSubNiche",
        c.description AS "channelDescription",
        c.mission AS "channelMission",
        c.image_theme AS "channelImageTheme",
        c.thumbnail_theme AS "channelThumbnailTheme",
        c.postershive_api AS "postershiveApi",
        c.script_structure AS "channelScriptStructure",
        t.pillar_id AS "pillarId",
        cp.slug AS "pillarSlug",
        cp.name AS "pillarName",
        cp.tag AS "pillarTag",
        cp.description AS "pillarDescription",
        cp.tone AS "pillarTone",
        cp.content_length AS "pillarContentLength",
        cp.content_words_count AS "pillarContentWordsCount",
        cp.use_main_character AS "pillarUseMainCharacter",
        cp.main_character_description AS "pillarMainCharacterDescription",
        t.title,
        t.slug,
        COALESCE(t.video_type, 'longform') AS "videoType",
        COALESCE(t.aspect_ratio, '16:9') AS "aspectRatio",
        t.parent_topic_id AS "parentTopicId",
        t.script_content AS "scriptContent",
        t.scenes_json AS "scenesJson",
        t.thumbnail_url AS "thumbnailUrl",
        t.thumbnail_prompt AS "thumbnailPrompt",
        t.story_description AS "storyDescription",
        t.master_video_url AS "masterVideoUrl",
        t.youtube_video_id AS "youtubeVideoId",
        t.youtube_url AS "youtubeUrl",
        t.youtube_published_at AS "youtubePublishedAt",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM topics t
      JOIN channels c ON c.id = t.channel_id
      LEFT JOIN content_pillars cp ON cp.id = t.pillar_id
      WHERE c.slug = ${channelSlug} AND t.slug = ${topicSlug}
      LIMIT 1;
    `;

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: "Topic not found", topic: null }, { status: 404 });
    }

    const topic = topics[0];

    // Fetch associated assets (audio files, scene frames, images, master cuts)
    const assets = await sql`
      SELECT 
        id,
        topic_id AS "topicId",
        channel_id AS "channelId",
        asset_type AS "assetType",
        scene_index AS "sceneIndex",
        file_url AS "fileUrl",
        file_key AS "fileKey",
        file_name AS "fileName",
        mime_type AS "mimeType"
      FROM topic_assets
      WHERE topic_id = ${topic.id}
      ORDER BY created_at ASC;
    `;

    return NextResponse.json({
      topic: {
        ...topic,
        assets: assets || [],
      },
    });
  } catch (error) {
    console.error("Error fetching topic:", error);
    return NextResponse.json(
      { error: "Failed to fetch topic", topic: null },
      { status: 500 }
    );
  }
}

// PUT /api/channels/[channel-name]/topics/[topic-name] - Save and update topic studio state
export async function PUT(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured in .env" },
        { status: 503 }
      );
    }

    await initDbSchema();

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    const body = await request.json();
    const title = body.title?.trim();
    const scenesJson = body.scenesJson ? JSON.stringify(body.scenesJson) : null;
    const storyDesc = body.storyDescription !== undefined ? body.storyDescription : (body.story_description !== undefined ? body.story_description : (body.story_discription !== undefined ? body.story_discription : null));

    let pillarId = undefined;
    if (body.pillarSlug || body.pillar) {
      const targetPillar = body.pillarSlug || body.pillar;
      const pRows = await sql`
        SELECT id FROM content_pillars
        WHERE channel_id = ${channelId} AND (slug = ${targetPillar} OR name = ${targetPillar})
        LIMIT 1;
      `;
      if (pRows && pRows.length > 0) {
        pillarId = pRows[0].id;
      }
    }

    const videoType = body.videoType || body.video_type || undefined;
    const aspectRatio = body.aspectRatio || body.aspect_ratio || undefined;

    const hasMasterVideo = "masterVideoUrl" in body || "master_video_url" in body;
    const masterVideoVal = hasMasterVideo
      ? (body.masterVideoUrl || body.master_video_url || null)
      : undefined;

    const hasThumbnail = "thumbnailUrl" in body || "thumbnail_url" in body;
    const thumbnailVal = hasThumbnail
      ? (body.thumbnailUrl || body.thumbnail_url || null)
      : undefined;

    const hasYoutubeVideoId = "youtubeVideoId" in body || "youtube_video_id" in body;
    const youtubeVideoIdVal = hasYoutubeVideoId
      ? (body.youtubeVideoId || body.youtube_video_id || null)
      : undefined;

    const hasYoutubeUrl = "youtubeUrl" in body || "youtube_url" in body;
    const youtubeUrlVal = hasYoutubeUrl
      ? (body.youtubeUrl || body.youtube_url || null)
      : undefined;

    const hasYoutubePublishedAt = "youtubePublishedAt" in body || "youtube_published_at" in body;
    const youtubePublishedAtVal = hasYoutubePublishedAt
      ? (body.youtubePublishedAt || body.youtube_published_at || null)
      : undefined;

    const updated = await sql`
      UPDATE topics
      SET
        title = COALESCE(${title}, title),
        pillar_id = COALESCE(${pillarId}, pillar_id),
        script_content = COALESCE(${body.scriptContent}, script_content),
        scenes_json = COALESCE(${scenesJson}::jsonb, scenes_json),
        thumbnail_url = CASE WHEN ${hasThumbnail} THEN ${thumbnailVal} ELSE thumbnail_url END,
        thumbnail_prompt = COALESCE(${body.thumbnailPrompt}, thumbnail_prompt),
        story_description = COALESCE(${storyDesc}, story_description),
        master_video_url = CASE WHEN ${hasMasterVideo} THEN ${masterVideoVal} ELSE master_video_url END,
        video_type = COALESCE(${videoType}, video_type),
        aspect_ratio = COALESCE(${aspectRatio}, aspect_ratio),
        youtube_video_id = CASE WHEN ${hasYoutubeVideoId} THEN ${youtubeVideoIdVal} ELSE youtube_video_id END,
        youtube_url = CASE WHEN ${hasYoutubeUrl} THEN ${youtubeUrlVal} ELSE youtube_url END,
        youtube_published_at = CASE WHEN ${hasYoutubePublishedAt} THEN ${youtubePublishedAtVal} ELSE youtube_published_at END,
        updated_at = NOW()
      WHERE channel_id = ${channelId} AND slug = ${topicSlug}
      RETURNING *;
    `;

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // If masterVideoUrl was cleared to null, also clear any completedvideo rows in topic_assets
    if (hasMasterVideo && !masterVideoVal) {
      try {
        await sql`
          DELETE FROM topic_assets
          WHERE channel_id = ${channelId}
            AND topic_id = ${updated[0].id}
            AND asset_type = 'completedvideo';
        `;
      } catch (assetDelErr) {
        console.warn("Could not delete completedvideo from topic_assets:", assetDelErr);
      }
    }

    return NextResponse.json({ topic: updated[0] });
  } catch (error) {
    console.error("Error updating topic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update topic" },
      { status: 500 }
    );
  }
}

// Helper to extract Cloudflare R2 object key from public URL or file path
function extractR2KeyFromUrl(targetUrl, publicBase = "") {
  if (!targetUrl || typeof targetUrl !== "string" || targetUrl === "generated") return null;
  const trimmed = targetUrl.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed.replace(/^\//, "");
  }
  if (publicBase && trimmed.startsWith(publicBase)) {
    return trimmed.replace(publicBase, "").replace(/^\//, "");
  }
  const parts = trimmed.split(".r2.dev/");
  if (parts.length > 1) {
    return parts[1];
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

// DELETE /api/channels/[channel-name]/topics/[topic-name] - Delete topic and all its uploaded files in Cloudflare R2
export async function DELETE(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured in .env" },
        { status: 503 }
      );
    }

    const channelRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channelId = channelRows[0].id;

    // 1. Fetch topic details (master_video_url, thumbnail_url, scenes_json) before deletion
    const topicRows = await sql`
      SELECT id, master_video_url, thumbnail_url, scenes_json
      FROM topics
      WHERE channel_id = ${channelId} AND slug = ${topicSlug}
      LIMIT 1;
    `;

    if (!topicRows || topicRows.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const topic = topicRows[0];

    // 2. Fetch all asset keys for this topic from topic_assets
    const assetRows = await sql`
      SELECT ta.file_key, ta.file_url 
      FROM topic_assets ta
      WHERE ta.topic_id = ${topic.id};
    `;

    const { deleteMultipleFromR2, deletePrefixFromR2, getPublicBaseUrl } = await import("@/lib/storage");
    const publicBase = getPublicBaseUrl ? getPublicBaseUrl() : "";
    const keysToDelete = new Set();

    // Add keys from topic_assets
    for (const row of assetRows || []) {
      if (row.file_key) keysToDelete.add(row.file_key);
      const urlKey = extractR2KeyFromUrl(row.file_url, publicBase);
      if (urlKey) keysToDelete.add(urlKey);
    }

    // Add keys from master_video_url and thumbnail_url
    const masterKey = extractR2KeyFromUrl(topic.master_video_url, publicBase);
    if (masterKey) keysToDelete.add(masterKey);

    const thumbKey = extractR2KeyFromUrl(topic.thumbnail_url, publicBase);
    if (thumbKey) keysToDelete.add(thumbKey);

    // Add keys from scenes_json (audio tracks, scene frame videos, images)
    let scenes = topic.scenes_json;
    if (typeof scenes === "string") {
      try {
        scenes = JSON.parse(scenes);
      } catch {
        scenes = [];
      }
    }
    if (Array.isArray(scenes)) {
      for (const scn of scenes) {
        const audioKey = extractR2KeyFromUrl(scn.audio_url || scn.audioUrl, publicBase);
        if (audioKey) keysToDelete.add(audioKey);

        const videoKey = extractR2KeyFromUrl(scn.video_url || scn.videoUrl, publicBase);
        if (videoKey) keysToDelete.add(videoKey);

        if (Array.isArray(scn.images)) {
          for (const img of scn.images) {
            const imgKey = extractR2KeyFromUrl(img?.url || img?.image_url || (typeof img === "string" ? img : null), publicBase);
            if (imgKey) keysToDelete.add(imgKey);
          }
        }
      }
    }

    const uniqueKeys = Array.from(keysToDelete).filter(Boolean);

    // 3. Delete all explicitly tracked physical files from Cloudflare R2
    if (uniqueKeys.length > 0) {
      try {
        await deleteMultipleFromR2(uniqueKeys);
      } catch (r2Err) {
        console.warn("Could not delete some individual files from R2:", r2Err);
      }
    }

    // 4. Also wipe the entire R2 directory for this topic to clean any untracked or temp render files
    const topicPrefix = `channels/${channelSlug}/topics/${topicSlug}/`;
    try {
      await deletePrefixFromR2(topicPrefix);
    } catch (prefixErr) {
      console.warn(`Could not clean topic prefix ${topicPrefix} in R2:`, prefixErr);
    }

    // 5. Delete topic from DB (cascades to topic_assets records)
    await sql`
      DELETE FROM topics
      WHERE channel_id = ${channelId} AND slug = ${topicSlug};
    `;

    return NextResponse.json({
      success: true,
      deletedTopic: topicSlug,
      deletedFilesCount: uniqueKeys.length,
    });
  } catch (error) {
    console.error("Error deleting topic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete topic" },
      { status: 500 }
    );
  }
}

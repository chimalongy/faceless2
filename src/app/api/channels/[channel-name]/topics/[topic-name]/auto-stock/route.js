import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { searchStockMedia, extractKeywords, importStockMediaToScene } from "@/lib/stock-media";
import { sortSceneImages, getImageIndex } from "@/lib/scene-images";

// POST /api/channels/[channel-name]/topics/[topic-name]/auto-stock
export async function POST(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";
    const topicSlug = rawParams?.["topic-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }

    await initDbSchema();

    // 1. Fetch channel & topic details
    const channelRows = await sql`
      SELECT id, name, slug
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;
    if (!channelRows || channelRows.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const channel = channelRows[0];

    const topicRows = await sql`
      SELECT id, title, slug, video_type AS "videoType", aspect_ratio AS "aspectRatio", scenes_json AS "scenesJson"
      FROM topics
      WHERE slug = ${topicSlug} AND channel_id = ${channel.id}
      LIMIT 1;
    `;
    if (!topicRows || topicRows.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    const topic = topicRows[0];

    const body = await request.json().catch(() => ({}));
    const {
      mediaType = "photos", // "photos" | "videos" | "all"
      source = "all",        // "all" | "pexels" | "pixabay"
      onlyMissing = false,   // only populate scenes that don't have an image yet
    } = body;

    // Determine aspect ratio orientation
    const isShort =
      topic.videoType === "short" ||
      topic.aspectRatio === "9:16" ||
      String(topic.slug || "").includes("short");

    const orientation = isShort ? "portrait" : "landscape";

    // Parse scenes
    let scenes = [];
    if (topic.scenesJson) {
      try {
        const parsed = typeof topic.scenesJson === "string" ? JSON.parse(topic.scenesJson) : topic.scenesJson;
        scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : Array.isArray(parsed) ? parsed : [];
      } catch {}
    }

    if (scenes.length === 0) {
      return NextResponse.json({ error: "No scenes found for this topic to populate" }, { status: 400 });
    }

    // Existing assets check if onlyMissing is true
    const existingAssetRows = await sql`
      SELECT scene_index AS "sceneIndex", file_name AS "fileName"
      FROM topic_assets
      WHERE topic_id = ${topic.id} AND asset_type = 'image';
    `;
    const existingScenesSet = new Set((existingAssetRows || []).map((r) => Number(r.sceneIndex)));

    const assignedResults = [];
    const usedDownloadUrls = new Set();

    // Process each scene sequentially with a slight delay to respect free rate limits
    for (const scene of scenes) {
      const sNum = scene.scene_number || scene.sceneIndex || scene.scene;
      if (!sNum) continue;

      if (onlyMissing && existingScenesSet.has(Number(sNum))) {
        continue;
      }

      const promptText = scene.image_prompt || scene.visual_prompt || scene.prompt || "";
      const narrativeText = scene.audio_text || scene.narration || scene.script || scene.text || "";
      const searchKeywords = extractKeywords(promptText, narrativeText, 3);

      try {
        const searchRes = await searchStockMedia({
          query: searchKeywords,
          mediaType,
          orientation,
          source,
          page: 1,
          perPage: 12,
        });

        const candidates = searchRes.results || [];
        // Pick top candidate that hasn't been used yet for another scene in this topic
        const chosen = candidates.find((c) => !usedDownloadUrls.has(c.downloadUrl)) || candidates[0];

        if (chosen && chosen.downloadUrl) {
          usedDownloadUrls.add(chosen.downloadUrl);

          const imported = await importStockMediaToScene({
            channelSlug,
            topicSlug,
            sceneIndex: sNum,
            imageIndex: 1,
            downloadUrl: chosen.downloadUrl,
            mediaType: chosen.mediaType,
            title: chosen.title,
            author: chosen.author,
          });

          assignedResults.push({
            sceneNumber: sNum,
            query: searchKeywords,
            source: chosen.source,
            assignedUrl: imported.publicUrl,
            assignedKey: imported.fileKey,
            fileName: imported.fileName,
          });
        }
      } catch (sceneErr) {
        console.warn(`Failed to auto-fetch stock media for scene ${sNum}:`, sceneErr);
      }
    }

    // Fetch updated sceneImages mapping for the frontend
    const updatedRows = await sql`
      SELECT id, scene_index AS "sceneIndex", file_url AS "fileUrl", file_key AS "fileKey", file_name AS "fileName"
      FROM topic_assets
      WHERE topic_id = ${topic.id} AND asset_type = 'image'
      ORDER BY scene_index ASC, id ASC;
    `;

    const nextSceneImages = {};
    (updatedRows || []).forEach((row) => {
      const sIdx = Number(row.sceneIndex);
      const frameIndex = getImageIndex(row.fileName, sIdx);
      const imgObj = {
        url: row.fileUrl,
        key: row.fileKey,
        name: row.fileName || `Scene ${sIdx} Image ${frameIndex}`,
        imageIndex: frameIndex,
      };
      if (!nextSceneImages[sIdx]) {
        nextSceneImages[sIdx] = {
          url: row.fileUrl,
          key: row.fileKey,
          name: row.fileName || `Scene ${sIdx} Image 1`,
          images: [imgObj],
        };
      } else {
        if (!nextSceneImages[sIdx].images) {
          nextSceneImages[sIdx].images = [
            {
              url: nextSceneImages[sIdx].url,
              key: nextSceneImages[sIdx].key,
              name: nextSceneImages[sIdx].name,
              imageIndex: getImageIndex(nextSceneImages[sIdx].name, sIdx),
            },
          ];
        }
        nextSceneImages[sIdx].images.push(imgObj);
      }
    });

    Object.keys(nextSceneImages).forEach((sNum) => {
      if (Array.isArray(nextSceneImages[sNum]?.images) && nextSceneImages[sNum].images.length > 1) {
        nextSceneImages[sNum].images = sortSceneImages(nextSceneImages[sNum].images, sNum);
        if (nextSceneImages[sNum].images[0]) {
          nextSceneImages[sNum].url = nextSceneImages[sNum].images[0].url;
          nextSceneImages[sNum].key = nextSceneImages[sNum].images[0].key;
          nextSceneImages[sNum].name = nextSceneImages[sNum].images[0].name;
        }
      }
    });

    return NextResponse.json({
      ok: true,
      assignedCount: assignedResults.length,
      totalScenes: scenes.length,
      assignedResults,
      nextSceneImages,
    });
  } catch (error) {
    console.error("Auto stock route error:", error);
    return NextResponse.json({ error: error?.message || "Failed to auto-fetch stock media" }, { status: 500 });
  }
}


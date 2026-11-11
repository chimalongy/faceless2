import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { searchStockMedia, extractKeywords, importStockMediaToScene } from "@/lib/stock-media";
import { sortSceneImages, getImageIndex } from "@/lib/scene-images";

export const maxDuration = 60; // Extend Vercel function timeout for multi-image stock media importing

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
      onlyMissing = false,   // only populate frames that don't have an image yet
      sceneNumber = null,    // optional: limit to a single scene
      sceneIndex = null,
      imageIndex = null,     // optional: limit to a single frame
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

    // Existing assets check by specific frame "sceneIndex-frameIndex"
    const existingAssetRows = await sql`
      SELECT scene_index AS "sceneIndex", file_name AS "fileName"
      FROM topic_assets
      WHERE topic_id = ${topic.id} AND asset_type = 'image';
    `;
    const existingFramesSet = new Set(
      (existingAssetRows || []).map((r) => {
        const sIdx = Number(r.sceneIndex);
        const fIdx = getImageIndex(r.fileName, sIdx);
        return `${sIdx}-${fIdx}`;
      })
    );

    const targetSceneFilter = sceneNumber || sceneIndex ? Number(sceneNumber || sceneIndex) : null;
    const targetFrameFilter = imageIndex ? Number(imageIndex) : null;

    // Build assignment targets across all scenes (multi-image & multi-frame aware)
    const assignmentTargets = [];
    scenes.forEach((scene, sIdx) => {
      const sNum = Number(scene.scene_number || scene.sceneIndex || scene.scene || (sIdx + 1));
      if (!sNum) return;
      if (targetSceneFilter && sNum !== targetSceneFilter) return;

      const multiCount = Array.isArray(scene.images) && scene.images.length > 0
        ? scene.images.length
        : Number(scene.number_of_images) > 1
          ? Number(scene.number_of_images)
          : 1;

      for (let fIdx = 1; fIdx <= multiCount; fIdx++) {
        if (targetFrameFilter && fIdx !== targetFrameFilter) continue;

        if (onlyMissing && existingFramesSet.has(`${sNum}-${fIdx}`)) {
          continue;
        }

        // Resolve frame-specific prompt
        let framePrompt = "";
        if (Array.isArray(scene.images) && scene.images[fIdx - 1]) {
          framePrompt = scene.images[fIdx - 1].image_prompt || scene.images[fIdx - 1].prompt || "";
        }
        if (!framePrompt) {
          framePrompt = scene.image_prompt || scene.visual_prompt || scene.prompt || "";
        }

        const narrativeText = scene.audio_text || scene.narration || scene.script || scene.text || "";

        assignmentTargets.push({
          sceneNumber: sNum,
          imageIndex: fIdx,
          promptText: framePrompt,
          narrativeText,
          keywords: extractKeywords(framePrompt, narrativeText, 3),
        });
      }
    });

    const assignedResults = [];
    const usedDownloadUrls = new Set();

    // Process each target frame sequentially with unique image selection
    for (const target of assignmentTargets) {
      const { sceneNumber: sNum, imageIndex: fIdx, keywords: searchKeywords } = target;

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
        // Pick top candidate that hasn't been used yet for another scene/frame in this topic
        const chosen = candidates.find((c) => !usedDownloadUrls.has(c.downloadUrl)) || candidates[0];

        if (chosen && chosen.downloadUrl) {
          usedDownloadUrls.add(chosen.downloadUrl);

          const imported = await importStockMediaToScene({
            channelSlug,
            topicSlug,
            sceneIndex: sNum,
            imageIndex: fIdx,
            downloadUrl: chosen.downloadUrl,
            mediaType: chosen.mediaType,
            title: chosen.title,
            author: chosen.author,
          });

          assignedResults.push({
            sceneNumber: sNum,
            imageIndex: fIdx,
            query: searchKeywords,
            source: chosen.source,
            assignedUrl: imported.publicUrl,
            assignedKey: imported.fileKey,
            fileName: imported.fileName,
          });
        }
      } catch (sceneErr) {
        console.warn(`Failed to auto-fetch stock media for scene ${sNum} frame ${fIdx}:`, sceneErr);
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
      totalFrames: assignmentTargets.length,
      assignedResults,
      nextSceneImages,
    });
  } catch (error) {
    console.error("Auto stock route error:", error);
    return NextResponse.json({ error: error?.message || "Failed to auto-fetch stock media" }, { status: 500 });
  }
}


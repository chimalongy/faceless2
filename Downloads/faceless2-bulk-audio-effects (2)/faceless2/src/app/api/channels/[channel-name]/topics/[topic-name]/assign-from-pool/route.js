import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";
import { sortSceneImages, getImageIndex } from "@/lib/scene-images";

/**
 * Fisher-Yates array shuffle helper
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// POST /api/channels/[channel-name]/topics/[topic-name]/assign-from-pool
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
      SELECT id, name, slug, use_image_pool AS "useImagePool"
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

    // Determine whether this topic requires Shorts (9:16) or Longform (16:9) images
    const isShortTopic =
      topic.videoType === "short" ||
      topic.aspectRatio === "9:16" ||
      String(topic.slug || "").includes("short");

    const targetPool = isShortTopic ? "shorts" : "longform";
    const poolLabel = isShortTopic ? "Shorts (9:16)" : "Longform (16:9)";

    // 2. Fetch images from the matching channel pool
    const poolImages = await sql`
      SELECT id, file_url AS "fileUrl", file_key AS "fileKey", file_name AS "fileName"
      FROM channel_image_pool
      WHERE channel_id = ${channel.id} AND pool_type = ${targetPool}
      ORDER BY created_at DESC;
    `;

    if (!poolImages || poolImages.length === 0) {
      return NextResponse.json(
        {
          error: `Your channel's ${poolLabel} image pool is empty. Please upload images to the ${poolLabel} pool first before assigning.`,
          poolType: targetPool,
          poolEmpty: true,
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetSceneIndex = body.sceneIndex ? Number(body.sceneIndex) : null;
    const targetImageIndex = body.imageIndex ? Number(body.imageIndex) : 1;

    // 3. Parse scene list from topic scenes_json
    let scenes = [];
    if (topic.scenesJson) {
      try {
        const parsed = typeof topic.scenesJson === "string" ? JSON.parse(topic.scenesJson) : topic.scenesJson;
        scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : Array.isArray(parsed) ? parsed : [];
      } catch {}
    }

    // Fallback: If no scenesJson, find highest existing scene_index in topic_assets or default to 1 scene
    if (scenes.length === 0) {
      const existingAssetRows = await sql`
        SELECT MAX(scene_index) AS "maxScene"
        FROM topic_assets
        WHERE topic_id = ${topic.id} AND scene_index IS NOT NULL;
      `;
      const maxScene = existingAssetRows?.[0]?.maxScene || 1;
      scenes = Array.from({ length: maxScene }, (_, i) => ({ scene_number: i + 1 }));
    }

    // 4. Case A: Single scene reroll
    if (targetSceneIndex !== null) {
      const randomImage = poolImages[Math.floor(Math.random() * poolImages.length)];
      const imageSuffix = targetImageIndex > 1 ? `-${targetImageIndex}` : "";
      const assetFileName = `scene-${targetSceneIndex}${imageSuffix}.png`;

      // Clean up previous image asset for this specific scene frame
      await sql`
        DELETE FROM topic_assets
        WHERE topic_id = ${topic.id} 
          AND asset_type = 'image' 
          AND scene_index = ${targetSceneIndex}
          AND (file_name = ${assetFileName} OR (scene_index = ${targetSceneIndex} AND ${targetImageIndex === 1}));
      `;

      // Insert new assigned asset
      await sql`
        INSERT INTO topic_assets (
          topic_id,
          channel_id,
          asset_type,
          scene_index,
          file_url,
          file_key,
          file_name,
          mime_type
        ) VALUES (
          ${topic.id},
          ${channel.id},
          'image',
          ${targetSceneIndex},
          ${randomImage.fileUrl},
          ${randomImage.fileKey},
          ${assetFileName},
          'image/png'
        );
      `;

      return NextResponse.json({
        success: true,
        poolType: targetPool,
        assignedScene: targetSceneIndex,
        assignedImageIndex: targetImageIndex,
        assignedUrl: randomImage.fileUrl,
        assignedKey: randomImage.fileKey,
      });
    }

    // 5. Case B: Bulk assignment across all scenes
    // Build list of frame targets across all scenes
    const assignmentTargets = [];
    scenes.forEach((scene, sIdx) => {
      const sNum = scene.scene_number || scene.scene_index || scene.index || (sIdx + 1);
      const multiCount = Array.isArray(scene.images) && scene.images.length > 0 
        ? scene.images.length 
        : Number(scene.number_of_images) > 1 
          ? Number(scene.number_of_images) 
          : 1;

      for (let fIdx = 1; fIdx <= multiCount; fIdx++) {
        assignmentTargets.push({
          sceneNumber: sNum,
          imageIndex: fIdx,
        });
      }
    });

    // Distribute pool images randomly with shuffle
    let shuffledPool = shuffleArray(poolImages);
    let poolPointer = 0;

    const plannedAssignments = [];
    for (const target of assignmentTargets) {
      if (poolPointer >= shuffledPool.length) {
        // Re-shuffle when pool exhausted to continue filling scenes smoothly
        shuffledPool = shuffleArray(poolImages);
        poolPointer = 0;
      }
      const chosenImage = shuffledPool[poolPointer];
      poolPointer++;

      const isMulti = target.imageIndex > 1;
      const imageSuffix = isMulti ? `-${target.imageIndex}` : "";
      const assetFileName = `scene-${target.sceneNumber}${imageSuffix}.png`;

      plannedAssignments.push({
        sceneNumber: target.sceneNumber,
        imageIndex: target.imageIndex,
        fileUrl: chosenImage.fileUrl,
        fileKey: chosenImage.fileKey,
        fileName: assetFileName,
      });
    }

    // Clean up existing image assets for this topic
    await sql`
      DELETE FROM topic_assets
      WHERE topic_id = ${topic.id} AND asset_type = 'image';
    `;

    // Insert all assigned image assets
    for (const item of plannedAssignments) {
      await sql`
        INSERT INTO topic_assets (
          topic_id,
          channel_id,
          asset_type,
          scene_index,
          file_url,
          file_key,
          file_name,
          mime_type
        ) VALUES (
          ${topic.id},
          ${channel.id},
          'image',
          ${item.sceneNumber},
          ${item.fileUrl},
          ${item.fileKey},
          ${item.fileName},
          'image/png'
        );
      `;
    }

    // Fetch the updated sceneImages map structure for the client
    const updatedRows = await sql`
      SELECT id, scene_index AS "sceneIndex", file_url AS "fileUrl", file_key AS "fileKey", file_name AS "fileName"
      FROM topic_assets
      WHERE topic_id = ${topic.id} AND asset_type = 'image'
      ORDER BY scene_index ASC, id ASC;
    `;

    const nextSceneImages = {};
    (updatedRows || []).forEach((row) => {
      const sNum = row.sceneIndex;
      if (!sNum) return;
      const fNum = getImageIndex(row.fileName, sNum);
      const current = nextSceneImages[sNum] || {
        url: row.fileUrl,
        key: row.fileKey,
        name: row.fileName,
        images: [],
      };
      const frameList = Array.isArray(current.images) ? [...current.images] : [];
      frameList.push({
        url: row.fileUrl,
        key: row.fileKey,
        name: row.fileName,
        imageIndex: fNum,
      });

      nextSceneImages[sNum] = {
        ...current,
        url: frameList[0]?.url || row.fileUrl,
        key: frameList[0]?.key || row.fileKey,
        name: frameList[0]?.name || row.fileName,
        images: sortSceneImages(frameList, sNum),
      };
    });

    return NextResponse.json({
      success: true,
      poolType: targetPool,
      assignedCount: plannedAssignments.length,
      sceneImages: nextSceneImages,
    });
  } catch (err) {
    console.error("Error assigning images from pool:", err);
    return NextResponse.json(
      { error: err.message || "Failed to assign images from pool" },
      { status: 500 }
    );
  }
}

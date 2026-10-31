import { task, logger } from "@trigger.dev/sdk";
import { generateImage } from "@/lib/image-generator";
import { uploadToR2, deleteFromR2 } from "@/lib/storage";
import { getDbSql, initDbSchema } from "@/lib/db";

export const generateThumbnailImageTask = task({
  id: "generate-thumbnail-image",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      customPrompt = null,
      isShort = false,
      width = null,
      height = null,
      seed = null,
      numInferenceSteps = 50,
    } = payload;

    if (!channelSlug || typeof channelSlug !== "string" || !channelSlug.trim()) {
      throw new Error("channelSlug is required for generate-thumbnail-image task.");
    }

    if (!topicSlug || typeof topicSlug !== "string" || !topicSlug.trim()) {
      throw new Error("topicSlug is required for generate-thumbnail-image task.");
    }

    logger.log("[GenerateThumbnailImage] Starting task...", { channelSlug, topicSlug, isShort });

    const sql = getDbSql();
    if (!sql) {
      throw new Error("Database not connected. DATABASE_URL is required.");
    }

    await initDbSchema();

    // 1. Fetch channel and topic records
    const channelRows = await sql`
      SELECT id, name, slug, thumbnail_theme, image_theme
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    if (!channelRows || channelRows.length === 0) {
      throw new Error(`Channel not found with slug "${channelSlug}".`);
    }
    const channel = channelRows[0];

    const topicRows = await sql`
      SELECT 
        id, 
        channel_id, 
        title, 
        slug, 
        thumbnail_prompt, 
        thumbnail_url, 
        COALESCE(video_type, 'longform') AS "videoType",
        COALESCE(aspect_ratio, '16:9') AS "aspectRatio"
      FROM topics
      WHERE slug = ${topicSlug} AND channel_id = ${channel.id}
      LIMIT 1;
    `;

    if (!topicRows || topicRows.length === 0) {
      throw new Error(`Topic not found with slug "${topicSlug}" for channel "${channelSlug}".`);
    }
    const topic = topicRows[0];

    // 2. Resolve thumbnail prompt
    const promptToUse = (customPrompt?.trim() || topic.thumbnail_prompt?.trim() || "");
    if (!promptToUse) {
      throw new Error(
        "No thumbnail prompt found. Please generate or enter a thumbnail prompt before generating the thumbnail image."
      );
    }

    // 3. Resolve aspect ratio and dimensions
    const isTopicShort = topic.videoType === "short" || topic.videoType === "shorts" || topic.aspectRatio === "9:16";
    const isShortVideo = isShort !== null && isShort !== undefined ? Boolean(isShort) : isTopicShort;
    const finalWidth = width ? Number(width) : isShortVideo ? 768 : 1376;
    const finalHeight = height ? Number(height) : isShortVideo ? 1376 : 768;

    logger.log(`[GenerateThumbnailImage] Generating image with dimensions ${finalWidth}x${finalHeight} (isShort=${isShortVideo})...`);

    // 4. Generate image via endpoint pool / Modal GPU
    const genResult = await generateImage({
      prompt: promptToUse,
      width: finalWidth,
      height: finalHeight,
      seed,
      numInferenceSteps,
    });

    if (!genResult?.imageBuffer) {
      throw new Error("Image generator did not return an image buffer.");
    }

    // 5. Upload to Cloudflare R2
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const key = `channels/${channelSlug}/topics/${topicSlug}/thumbnail/thumbnail-${timestamp}-${randomSuffix}.png`;

    logger.log(`[GenerateThumbnailImage] Uploading generated thumbnail to R2 at key: ${key}...`);

    const uploadResult = await uploadToR2({
      key,
      buffer: genResult.imageBuffer,
      mimeType: "image/png",
      metadata: {
        channelSlug,
        topicSlug,
        assetType: "thumbnail",
        endpointUsed: genResult.endpointUsed || "",
      },
    });

    // 6. Clean up any previous thumbnail topic_assets and R2 files
    try {
      const oldAssets = await sql`
        SELECT id, file_key FROM topic_assets
        WHERE topic_id = ${topic.id} AND asset_type = 'thumbnail';
      `;
      if (oldAssets && oldAssets.length > 0) {
        for (const oldAsset of oldAssets) {
          if (oldAsset.file_key && oldAsset.file_key !== uploadResult.key) {
            await deleteFromR2(oldAsset.file_key).catch(() => {});
          }
          await sql`DELETE FROM topic_assets WHERE id = ${oldAsset.id};`;
        }
      }
    } catch (cleanupErr) {
      logger.warn("[GenerateThumbnailImage] Error cleaning up old thumbnail assets:", { error: cleanupErr.message });
    }

    // 7. Insert new asset record and update topics.thumbnail_url
    await sql`
      INSERT INTO topic_assets (
        topic_id,
        channel_id,
        asset_type,
        file_url,
        file_key,
        file_name,
        mime_type,
        size_bytes
      ) VALUES (
        ${topic.id},
        ${channel.id},
        'thumbnail',
        ${uploadResult.publicUrl},
        ${uploadResult.key},
        'thumbnail.png',
        'image/png',
        ${genResult.imageBuffer.length}
      );
    `;

    await sql`
      UPDATE topics
      SET 
        thumbnail_url = ${uploadResult.publicUrl},
        updated_at = NOW()
      WHERE id = ${topic.id};
    `;

    logger.log(`[GenerateThumbnailImage] Successfully generated and saved thumbnail for topic "${topicSlug}". URL: ${uploadResult.publicUrl}`);

    return {
      success: true,
      channelSlug,
      topicSlug,
      thumbnailUrl: uploadResult.publicUrl,
      key: uploadResult.key,
      endpointUsed: genResult.endpointUsed,
      remainingUsage: genResult.remainingUsage,
    };
  },
});

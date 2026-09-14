import { task, logger } from "@trigger.dev/sdk";
import JSZip from "jszip";
import { uploadToR2, deleteFromR2, getR2Client, getBucketName } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getDbSql, initDbSchema } from "@/lib/db";
import { parseImageFileName } from "@/lib/scene-images";

export const extractZipImagesTask = task({
  id: "extract-zip-images",
  run: async (payload) => {
    const {
      channelSlug,
      topicSlug,
      zipFileKey,
      zipBase64,
    } = payload;

    if (!channelSlug || !topicSlug) {
      throw new Error("channelSlug and topicSlug are required for extract-zip-images task.");
    }

    logger.log("Starting ZIP extraction task for scene images and thumbnail...", {
      channelSlug,
      topicSlug,
      hasBase64: !!zipBase64,
      hasKey: !!zipFileKey,
    });

    try {
      // 1. Obtain ZIP Buffer (in-memory, no ZIP stored in R2)
      let zipBuffer = null;

      if (zipBase64) {
        zipBuffer = Buffer.from(zipBase64, "base64");
      } else if (zipFileKey) {
        const client = getR2Client();
        const bucket = getBucketName();
        if (!client) throw new Error("Cloudflare R2 client is not configured.");

        const getCommand = new GetObjectCommand({
          Bucket: bucket,
          Key: zipFileKey,
        });

        const response = await client.send(getCommand);
        const chunks = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        zipBuffer = Buffer.concat(chunks);
      } else {
        throw new Error("ZIP data (zipBase64 or zipFileKey) must be provided to extract-zip-images task.");
      }

      if (!zipBuffer || zipBuffer.length === 0) {
        throw new Error("Empty or invalid ZIP file buffer.");
      }

      // 2. Load and parse ZIP with JSZip
      const zip = await JSZip.loadAsync(zipBuffer);
      const imageFiles = [];

      zip.forEach((relativePath, file) => {
        if (file.dir) return;
        // Filter out OS junk files (e.g. __MACOSX, .DS_Store)
        if (relativePath.includes("__MACOSX") || relativePath.startsWith(".")) return;

        const lowerPath = relativePath.toLowerCase();
        const isImage =
          lowerPath.includes(".png") ||
          lowerPath.includes(".jpg") ||
          lowerPath.includes(".jpeg") ||
          lowerPath.includes(".jfif") ||
          lowerPath.includes(".webp") ||
          lowerPath.includes(".gif");

        if (isImage) {
          imageFiles.push({
            path: relativePath,
            file,
          });
        }
      });

      if (imageFiles.length === 0) {
        throw new Error("No supported image files (.png, .jpg, .jpeg, .jfif, .webp) found in the uploaded ZIP.");
      }

      logger.log(`Found ${imageFiles.length} image candidate(s) in ZIP archive.`);

      // 3. Parse candidates and sort deterministically by sceneIndex and imageIndex
      const parsedCandidates = [];
      const sceneCounts = new Map();

      for (const item of imageFiles) {
        const fullFileName = item.path.split("/").pop() || item.path;
        const parsed = parseImageFileName(fullFileName);

        if (!parsed.isThumbnail && !parsed.sceneIndex) {
          logger.warn(`Could not extract scene number or thumbnail identifier from filename: ${fullFileName}. Skipping.`);
          continue;
        }

        if (!parsed.isThumbnail && parsed.sceneIndex) {
          const currentCount = sceneCounts.get(parsed.sceneIndex) || 0;
          sceneCounts.set(parsed.sceneIndex, currentCount + 1);
        }

        parsedCandidates.push({
          ...item,
          fullFileName,
          ...parsed,
        });
      }

      // Sort: Thumbnails first, then scene images ordered strictly by sceneIndex ASC, imageIndex ASC
      parsedCandidates.sort((a, b) => {
        if (a.isThumbnail && !b.isThumbnail) return -1;
        if (!a.isThumbnail && b.isThumbnail) return 1;
        if (a.isThumbnail && b.isThumbnail) return 0;
        if (a.sceneIndex !== b.sceneIndex) return a.sceneIndex - b.sceneIndex;
        return a.imageIndex - b.imageIndex;
      });

      const sql = getDbSql();
      let channelId = null;
      let topicId = null;

      if (sql) {
        await initDbSchema();
        const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
        const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;
        channelId = cRows?.[0]?.id || null;
        topicId = tRows?.[0]?.id || null;
      }

      const results = [];
      let thumbnailResult = null;
      const cleanedScenes = new Set();

      for (const item of parsedCandidates) {
        const { fullFileName, ext, mimeType, isThumbnail, sceneIndex, imageIndex, isMultiIndexed } = item;
        const imgBuffer = await item.file.async("nodebuffer");

        // ── THUMBNAIL PROCESSING ──
        if (isThumbnail) {
          logger.log(`Processing thumbnail image from ZIP: ${fullFileName}`);
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 7);
          const key = `channels/${channelSlug}/topics/${topicSlug}/thumbnail/thumb-${timestamp}-${randomSuffix}.${ext}`;

          const uploadResult = await uploadToR2({
            key,
            buffer: imgBuffer,
            mimeType,
            metadata: {
              channelSlug,
              topicSlug,
              assetType: "thumbnail",
              source: "zip_upload",
              originalName: fullFileName,
            },
          });

          // Update topic record in Neon database
          if (sql && topicId) {
            try {
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
                  ${topicId},
                  ${channelId},
                  'thumbnail',
                  ${uploadResult.publicUrl},
                  ${uploadResult.key},
                  ${`thumbnail.${ext}`},
                  ${mimeType},
                  ${imgBuffer.length}
                );
              `;
              await sql`
                UPDATE topics
                SET thumbnail_url = ${uploadResult.publicUrl}, updated_at = NOW()
                WHERE id = ${topicId};
              `;
            } catch (dbErr) {
              logger.warn("Could not save thumbnail DB record:", dbErr.message);
            }
          }

          logger.log(`Mapped Thumbnail (${fullFileName}) -> ${uploadResult.publicUrl}`);

          thumbnailResult = {
            fileName: `thumbnail.${ext}`,
            publicUrl: uploadResult.publicUrl,
            key: uploadResult.key,
            mimeType,
            size: imgBuffer.length,
          };
          continue;
        }

        // ── SCENE IMAGE PROCESSING ──
        // Clean up any previous image assets for this scene from R2 and DB (only once per scene in this ZIP extraction)
        if (sql && channelId && topicId && !cleanedScenes.has(sceneIndex)) {
          try {
            const oldRows = await sql`
              SELECT file_key FROM topic_assets
              WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'image' AND scene_index = ${sceneIndex};
            `;
            if (oldRows && oldRows.length > 0) {
              for (const row of oldRows) {
                if (row.file_key) {
                  await deleteFromR2(row.file_key).catch(() => {});
                }
              }
              await sql`
                DELETE FROM topic_assets
                WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'image' AND scene_index = ${sceneIndex};
              `;
            }
            cleanedScenes.add(sceneIndex);
          } catch (cleanErr) {
            logger.warn(`Old asset cleanup error for scene ${sceneIndex}:`, cleanErr.message);
          }
        }

        // Determine if scene is multi-image to name files consistently
        const hasMultiple = (sceneCounts.get(sceneIndex) || 0) > 1 || isMultiIndexed || imageIndex > 1;
        const imageSuffix = hasMultiple ? `-${imageIndex}` : "";
        const assetFileName = hasMultiple ? `scene-${sceneIndex}-${imageIndex}.${ext}` : `scene-${sceneIndex}.${ext}`;

        // Upload extracted image directly to Cloudflare R2
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const key = `channels/${channelSlug}/topics/${topicSlug}/images/scene-${sceneIndex}${imageSuffix}-${timestamp}-${randomSuffix}.${ext}`;

        const uploadResult = await uploadToR2({
          key,
          buffer: imgBuffer,
          mimeType,
          metadata: {
            channelSlug,
            topicSlug,
            sceneIndex: String(sceneIndex),
            imageIndex: String(imageIndex),
            source: "zip_upload",
            originalName: fullFileName,
          },
        });

        // Record in Neon database
        if (sql && channelId && topicId) {
          try {
            await sql`
              INSERT INTO topic_assets (
                topic_id,
                channel_id,
                asset_type,
                scene_index,
                file_url,
                file_key,
                file_name,
                mime_type,
                size_bytes
              ) VALUES (
                ${topicId},
                ${channelId},
                'image',
                ${sceneIndex},
                ${uploadResult.publicUrl},
                ${uploadResult.key},
                ${assetFileName},
                ${mimeType},
                ${imgBuffer.length}
              );
            `;
          } catch (dbErr) {
            logger.warn(`Could not save DB record for scene ${sceneIndex} image ${imageIndex}:`, dbErr.message);
          }
        }

        logger.log(`Mapped Scene ${sceneIndex}${hasMultiple ? ` (Image ${imageIndex})` : ""} (${fullFileName}) -> ${uploadResult.publicUrl}`);

        results.push({
          sceneIndex,
          imageIndex,
          fileName: assetFileName,
          publicUrl: uploadResult.publicUrl,
          key: uploadResult.key,
          mimeType,
          size: imgBuffer.length,
        });
      }

      return {
        success: true,
        channelSlug,
        topicSlug,
        extractedCount: results.length,
        hasThumbnail: !!thumbnailResult,
        thumbnail: thumbnailResult,
        images: results,
      };
    } finally {
      // Guaranteed cleanup: delete temporary ZIP archive from R2
      if (zipFileKey) {
        logger.log(`Cleaning up temporary ZIP archive from R2: ${zipFileKey}`);
        await deleteFromR2(zipFileKey).catch((delErr) => {
          logger.warn(`Failed to clean up temporary ZIP: ${zipFileKey}`, delErr?.message);
        });
      }
    }
  },
});

export default extractZipImagesTask;

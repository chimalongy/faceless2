import { task, logger } from "@trigger.dev/sdk";
import JSZip from "jszip";
import { uploadToR2, deleteFromR2, getR2Client, getBucketName } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getDbSql, initDbSchema } from "@/lib/db";

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

      // 3. Process each image, extract scene number or thumbnail, and upload to R2
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

      for (const item of imageFiles) {
        const fullFileName = item.path.split("/").pop() || item.path;
        const lowerFull = fullFileName.toLowerCase();

        // Determine extension and MIME type
        let ext = "png";
        let mimeType = "image/png";
        if (lowerFull.includes(".jfif")) {
          ext = "jfif";
          mimeType = "image/jpeg";
        } else if (lowerFull.includes(".jpg") || lowerFull.includes(".jpeg")) {
          ext = "jpg";
          mimeType = "image/jpeg";
        } else if (lowerFull.includes(".webp")) {
          ext = "webp";
          mimeType = "image/webp";
        } else if (lowerFull.includes(".gif")) {
          ext = "gif";
          mimeType = "image/gif";
        }

        const imgBuffer = await item.file.async("nodebuffer");

        // ── THUMBNAIL DETECTION: Any image containing "thumbnail" in its filename ──
        if (lowerFull.includes("thumbnail")) {
          logger.log(`Found thumbnail image in ZIP: ${fullFileName}`);

          // Clean up any previous thumbnail asset from R2 and DB
          if (sql && channelId && topicId) {
            try {
              const oldRows = await sql`
                SELECT file_key FROM topic_assets
                WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'thumbnail';
              `;
              if (oldRows && oldRows.length > 0) {
                for (const row of oldRows) {
                  if (row.file_key) {
                    await deleteFromR2(row.file_key).catch(() => {});
                  }
                }
                await sql`
                  DELETE FROM topic_assets
                  WHERE topic_id = ${topicId} AND channel_id = ${channelId} AND asset_type = 'thumbnail';
                `;
              }
            } catch (cleanErr) {
              logger.warn("Old thumbnail asset cleanup error:", cleanErr.message);
            }
          }

          // Upload thumbnail directly to Cloudflare R2
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 7);
          const key = `channels/${channelSlug}/topics/${topicSlug}/thumbnail/thumbnail-${timestamp}-${randomSuffix}.${ext}`;

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

          // Record in Neon database and update topics.thumbnail_url
          if (sql && channelId && topicId) {
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

        // ── SCENE IMAGE DETECTION ──
        // Filenames in ZIP can be e.g. "1.jfif", "2.jfif", "1.png_202608210053", "2.jpg_timestamp", "scene_3.png"
        // Step A: Strip extension to extract the basename
        const nameWithoutExt = fullFileName.replace(/\.[^/.]+$/, "");
        const primaryPart = nameWithoutExt.split("_")[0];
        
        // Step B: Extract scene number from primary part or full filename
        const numberMatch = primaryPart.match(/(\d+)/) || nameWithoutExt.match(/(\d+)/) || fullFileName.match(/(\d+)/);
        if (!numberMatch) {
          logger.warn(`Could not extract scene number or thumbnail identifier from filename: ${fullFileName}. Skipping.`);
          continue;
        }

        const sceneIndex = parseInt(numberMatch[1], 10);

        // Clean up any previous image asset for this scene from R2 and DB
        if (sql && channelId && topicId && sceneIndex) {
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
          } catch (cleanErr) {
            logger.warn(`Old asset cleanup error for scene ${sceneIndex}:`, cleanErr.message);
          }
        }

        // Upload extracted image directly to Cloudflare R2
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const key = `channels/${channelSlug}/topics/${topicSlug}/images/scene-${sceneIndex}-${timestamp}-${randomSuffix}.${ext}`;

        const uploadResult = await uploadToR2({
          key,
          buffer: imgBuffer,
          mimeType,
          metadata: {
            channelSlug,
            topicSlug,
            sceneIndex: String(sceneIndex),
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
                ${`scene-${sceneIndex}.${ext}`},
                ${mimeType},
                ${imgBuffer.length}
              );
            `;
          } catch (dbErr) {
            logger.warn(`Could not save DB record for scene ${sceneIndex}:`, dbErr.message);
          }
        }

        logger.log(`Mapped Scene ${sceneIndex} (${fullFileName}) -> ${uploadResult.publicUrl}`);

        results.push({
          sceneIndex,
          fileName: `scene-${sceneIndex}.${ext}`,
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

import { getDbSql, initDbSchema } from "./db.js";
import { uploadToR2, deleteFromR2 } from "./storage.js";

/**
 * Common stop words and AI prompt boilerplate words to strip when extracting
 * clean, focused search terms for Pexels & Pixabay stock search.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "of", "and", "or", "to", "for", "with",
  "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "it",
  "its", "that", "this", "these", "those", "into", "onto", "over", "under",
  "about", "against", "between", "through", "during", "before", "after",
  "above", "below", "up", "down", "out", "off", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "should",
  "now", "cinematic", "photorealistic", "ultra", "realistic", "hyperrealistic",
  "8k", "4k", "hd", "shot", "detailed", "lighting", "dramatic", "hyper",
  "studio", "camera", "lens", "macro", "wide", "close", "view", "angle",
  "style", "composition", "background", "foreground", "sharp", "focus",
  "vibrant", "moody", "atmosphere", "highly", "rendered", "octane", "unreal",
  "engine", "concept", "art", "photography", "photo", "image", "picture",
  "illustration", "masterpiece", "epic", "stunning", "beautiful", "gorgeous"
]);

/**
 * Extract clean, high-signal search keywords from a scene's prompt or narration.
 * Example: "Cinematic 8k shot of an ancient Roman colosseum in golden hour" -> "ancient roman colosseum"
 */
export function extractKeywords(promptText = "", narrativeText = "", maxWords = 3) {
  const combined = `${promptText} ${narrativeText}`.toLowerCase();
  
  // Clean punctuation and non-alphanumeric chars
  const words = combined
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Remove duplicates while preserving original sequence
  const uniqueWords = [];
  const seen = new Set();
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      uniqueWords.push(w);
      if (uniqueWords.length >= maxWords) break;
    }
  }

  return uniqueWords.length > 0 ? uniqueWords.join(" ") : (promptText.slice(0, 30).trim() || "cinematic landscape");
}

/**
 * Resolve Pexels and Pixabay API keys from database settings or environment variables.
 */
export async function resolveStockApiKeys() {
  let pexelsKey = (process.env.PEXELS_API_KEY || "").trim();
  let pixabayKey = (process.env.PIXABAY_API_KEY || "").trim();

  try {
    const sql = getDbSql();
    if (sql) {
      await initDbSchema();
      const rows = await sql`
        SELECT pexels_api_key AS "pexelsApiKey", pixabay_api_key AS "pixabayApiKey"
        FROM general_settings
        ORDER BY id ASC
        LIMIT 1;
      `;
      if (rows?.[0]) {
        if (rows[0].pexelsApiKey && rows[0].pexelsApiKey.trim()) {
          pexelsKey = rows[0].pexelsApiKey.trim();
        }
        if (rows[0].pixabayApiKey && rows[0].pixabayApiKey.trim()) {
          pixabayKey = rows[0].pixabayApiKey.trim();
        }
      }
    }
  } catch (err) {
    console.warn("Could not query stock API keys from database:", err?.message || err);
  }

  return {
    pexelsKey,
    pixabayKey,
    hasPexels: Boolean(pexelsKey),
    hasPixabay: Boolean(pixabayKey),
  };
}

/**
 * Search Pexels for royalty-free photos or videos.
 */
export async function searchPexels({
  query,
  mediaType = "photos", // "photos" | "videos"
  orientation = "all",  // "landscape" | "portrait" | "all"
  page = 1,
  perPage = 15,
  apiKey,
}) {
  if (!apiKey) return [];

  const headers = { Authorization: apiKey };
  const orientationParam = orientation === "landscape" ? "landscape" : orientation === "portrait" ? "portrait" : null;

  try {
    if (mediaType === "videos") {
      const url = new URL("https://api.pexels.com/videos/search");
      url.searchParams.set("query", query);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));
      if (orientationParam) url.searchParams.set("orientation", orientationParam);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`Pexels video search failed (${res.status}):`, errorText);
        return [];
      }
      const data = await res.json();
      const videos = Array.isArray(data?.videos) ? data.videos : [];

      return videos.map((v) => {
        // Find best video file (prefer HD or SD mp4)
        const files = Array.isArray(v.video_files) ? v.video_files : [];
        const sortedFiles = [...files].sort((a, b) => (b.width || 0) - (a.width || 0));
        const bestFile = sortedFiles.find((f) => f.quality === "hd") || sortedFiles[0] || {};

        return {
          id: `pexels-video-${v.id}`,
          source: "pexels",
          mediaType: "video",
          title: v.url ? `Video by ${v.user?.name || "Pexels Creator"}` : "Stock Video",
          author: v.user?.name || "Pexels",
          authorUrl: v.user?.url || "https://www.pexels.com",
          previewUrl: v.image || "",
          thumbnailUrl: v.image || "",
          downloadUrl: bestFile.link || v.image || "",
          posterUrl: v.image || "",
          width: v.width || 1920,
          height: v.height || 1080,
          aspectRatio: v.width && v.height ? (v.width / v.height > 1.2 ? "16:9" : v.width / v.height < 0.8 ? "9:16" : "1:1") : "16:9",
          duration: v.duration || null,
          pageUrl: v.url || "https://www.pexels.com",
        };
      });
    } else {
      // Default: Photos
      const url = new URL("https://api.pexels.com/v1/search");
      url.searchParams.set("query", query);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));
      if (orientationParam) url.searchParams.set("orientation", orientationParam);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`Pexels photo search failed (${res.status}):`, errorText);
        return [];
      }
      const data = await res.json();
      const photos = Array.isArray(data?.photos) ? data.photos : [];

      return photos.map((p) => ({
        id: `pexels-photo-${p.id}`,
        source: "pexels",
        mediaType: "photo",
        title: p.alt || `Photo by ${p.photographer}`,
        author: p.photographer || "Pexels",
        authorUrl: p.photographer_url || "https://www.pexels.com",
        previewUrl: p.src?.medium || p.src?.small || p.src?.large || "",
        thumbnailUrl: p.src?.tiny || p.src?.small || "",
        downloadUrl: p.src?.large2x || p.src?.large || p.src?.original || "",
        posterUrl: p.src?.large || p.src?.medium || "",
        width: p.width || 1920,
        height: p.height || 1080,
        aspectRatio: p.width && p.height ? (p.width / p.height > 1.2 ? "16:9" : p.width / p.height < 0.8 ? "9:16" : "1:1") : "16:9",
        duration: null,
        pageUrl: p.url || "https://www.pexels.com",
      }));
    }
  } catch (err) {
    console.error("Pexels API fetch error:", err);
    return [];
  }
}

/**
 * Search Pixabay for royalty-free photos or videos.
 */
export async function searchPixabay({
  query,
  mediaType = "photos", // "photos" | "videos"
  orientation = "all",  // "landscape" | "portrait" | "all"
  page = 1,
  perPage = 15,
  apiKey,
}) {
  if (!apiKey) return [];

  // Pixabay orientation: "all", "horizontal", "vertical"
  const orientationParam = orientation === "landscape" ? "horizontal" : orientation === "portrait" ? "vertical" : "all";

  try {
    if (mediaType === "videos") {
      const url = new URL("https://pixabay.com/api/videos/");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("q", query);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));
      if (orientationParam !== "all") url.searchParams.set("video_type", "all");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`Pixabay video search failed (${res.status}):`, errorText);
        return [];
      }
      const data = await res.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];

      return hits.map((h) => {
        const poster = h.picture_id
          ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg`
          : "";
        const bestVideo = h.videos?.large || h.videos?.medium || h.videos?.small || {};
        const width = bestVideo.width || 1920;
        const height = bestVideo.height || 1080;

        return {
          id: `pixabay-video-${h.id}`,
          source: "pixabay",
          mediaType: "video",
          title: h.tags || `Video by ${h.user}`,
          author: h.user || "Pixabay",
          authorUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
          previewUrl: poster,
          thumbnailUrl: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg` : poster,
          downloadUrl: bestVideo.url || poster,
          posterUrl: poster,
          width,
          height,
          aspectRatio: width && height ? (width / height > 1.2 ? "16:9" : width / height < 0.8 ? "9:16" : "1:1") : "16:9",
          duration: h.duration || null,
          pageUrl: h.pageURL || "https://pixabay.com",
        };
      });
    } else {
      // Default: Photos
      const url = new URL("https://pixabay.com/api/");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("q", query);
      url.searchParams.set("image_type", "photo");
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(perPage));
      if (orientationParam !== "all") url.searchParams.set("orientation", orientationParam);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`Pixabay photo search failed (${res.status}):`, errorText);
        return [];
      }
      const data = await res.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];

      return hits.map((h) => ({
        id: `pixabay-photo-${h.id}`,
        source: "pixabay",
        mediaType: "photo",
        title: h.tags || `Photo by ${h.user}`,
        author: h.user || "Pixabay",
        authorUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
        previewUrl: h.webformatURL || h.previewURL || "",
        thumbnailUrl: h.previewURL || h.webformatURL || "",
        downloadUrl: h.largeImageURL || h.webformatURL || "",
        posterUrl: h.largeImageURL || h.webformatURL || "",
        width: h.imageWidth || 1920,
        height: h.imageHeight || 1080,
        aspectRatio: h.imageWidth && h.imageHeight ? (h.imageWidth / h.imageHeight > 1.2 ? "16:9" : h.imageWidth / h.imageHeight < 0.8 ? "9:16" : "1:1") : "16:9",
        duration: null,
        pageUrl: h.pageURL || "https://pixabay.com",
      }));
    }
  } catch (err) {
    console.error("Pixabay API fetch error:", err);
    return [];
  }
}

/**
 * Search both Pexels and Pixabay stock providers concurrently and return
 * an interleaved, diverse list of results.
 */
export async function searchStockMedia({
  query,
  mediaType = "all",    // "all" | "photos" | "videos"
  orientation = "all",  // "all" | "landscape" | "portrait"
  source = "all",       // "all" | "pexels" | "pixabay"
  page = 1,
  perPage = 20,
}) {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) {
    return { results: [], total: 0, pexelsAvailable: false, pixabayAvailable: false, query: "" };
  }

  const { pexelsKey, pixabayKey, hasPexels, hasPixabay } = await resolveStockApiKeys();

  if (!hasPexels && !hasPixabay) {
    return {
      results: [],
      total: 0,
      pexelsAvailable: false,
      pixabayAvailable: false,
      query: cleanQuery,
      warning: "No stock media API keys configured. Please add your Pexels or Pixabay API key in Settings.",
    };
  }

  const fetchPromises = [];

  // Determine which media types to query
  const typesToFetch = mediaType === "all" ? ["photos", "videos"] : [mediaType];

  for (const type of typesToFetch) {
    if ((source === "all" || source === "pexels") && hasPexels) {
      fetchPromises.push(
        searchPexels({
          query: cleanQuery,
          mediaType: type,
          orientation,
          page,
          perPage: Math.ceil(perPage / 2),
          apiKey: pexelsKey,
        })
      );
    }
    if ((source === "all" || source === "pixabay") && hasPixabay) {
      fetchPromises.push(
        searchPixabay({
          query: cleanQuery,
          mediaType: type,
          orientation,
          page,
          perPage: Math.ceil(perPage / 2),
          apiKey: pixabayKey,
        })
      );
    }
  }

  const settled = await Promise.allSettled(fetchPromises);
  const resultLists = settled
    .filter((r) => r.status === "fulfilled" && Array.isArray(r.value))
    .map((r) => r.value);

  // Interleave results from all active providers/types
  const combined = [];
  let maxLen = Math.max(0, ...resultLists.map((l) => l.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of resultLists) {
      if (list[i]) {
        combined.push(list[i]);
      }
    }
  }

  return {
    results: combined.slice(0, perPage),
    total: combined.length,
    pexelsAvailable: hasPexels,
    pixabayAvailable: hasPixabay,
    query: cleanQuery,
  };
}

/**
 * Downloads a stock photo/frame from its external URL and imports it into
 * Cloudflare R2 and the topic_assets table for a specific scene frame.
 */
export async function importStockMediaToScene({
  channelSlug,
  topicSlug,
  sceneIndex,
  imageIndex = 1,
  downloadUrl,
  mediaType = "photo",
  title = "",
  author = "",
}) {
  if (!downloadUrl) throw new Error("Missing download URL for stock asset.");
  if (!channelSlug || !topicSlug) throw new Error("channelSlug and topicSlug are required.");
  if (sceneIndex === undefined || sceneIndex === null) throw new Error("sceneIndex is required.");

  const sNum = parseInt(sceneIndex, 10);
  const imgIdx = parseInt(imageIndex, 10) || 1;

  // 1. Download buffer from external CDN
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Failed to download stock media from CDN (status ${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || (mediaType === "video" ? "video/mp4" : "image/jpeg");
  
  // Choose file extension based on MIME type
  let ext = "jpg";
  if (contentType.includes("png")) ext = "png";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("mp4")) ext = "mp4";

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const imageSuffix = imgIdx > 1 ? `-${imgIdx}` : "";

  // Cloudflare R2 Key & Filename
  const key = `channels/${channelSlug}/topics/${topicSlug}/images/scene-${sNum}${imageSuffix}-${timestamp}-${randomSuffix}.${ext}`;
  const assetFileName = `scene-${sNum}${imageSuffix}.${ext}`;

  // 2. Upload to Cloudflare R2
  const uploadResult = await uploadToR2({
    key,
    buffer,
    mimeType: contentType,
    metadata: {
      channelSlug,
      topicSlug,
      assetType: "image",
      sceneIndex: String(sNum),
      imageIndex: String(imgIdx),
      stockTitle: title.slice(0, 100),
      stockAuthor: author.slice(0, 100),
    },
  });

  const finalUrl = uploadResult.publicUrl;

  // 3. Record in topic_assets database table
  const sql = getDbSql();
  if (sql) {
    await initDbSchema();

    const cRows = await sql`SELECT id FROM channels WHERE slug = ${channelSlug} LIMIT 1;`;
    const tRows = await sql`SELECT id FROM topics WHERE slug = ${topicSlug} LIMIT 1;`;

    const channelId = cRows?.[0]?.id || null;
    const topicId = tRows?.[0]?.id || null;

    if (topicId && channelId) {
      try {
        // Delete previous frame asset for this scene
        const existingRows = imgIdx > 1
          ? await sql`
              SELECT id, file_key FROM topic_assets
              WHERE topic_id = ${topicId} AND asset_type = 'image' AND scene_index = ${sNum}
              AND (file_name LIKE ${`%scene-${sNum}-${imgIdx}.%`} OR file_key LIKE ${`%scene-${sNum}-${imgIdx}-%`});
            `
          : await sql`
              SELECT id, file_key FROM topic_assets
              WHERE topic_id = ${topicId} AND asset_type = 'image' AND scene_index = ${sNum}
              AND (
                file_name LIKE ${`%scene-${sNum}-1.%`} OR file_name LIKE ${`%scene-${sNum}.%`}
                OR file_key LIKE ${`%scene-${sNum}-1-%`} OR file_key LIKE ${`%scene-${sNum}-%`}
              );
            `;

        if (existingRows && existingRows.length > 0) {
          for (const row of existingRows) {
            if (row.file_key) await deleteFromR2(row.file_key).catch(() => {});
            await sql`DELETE FROM topic_assets WHERE id = ${row.id};`;
          }
        }
      } catch (cleanErr) {
        console.warn("Could not clean old scene asset:", cleanErr);
      }

      // Insert new stock asset
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
          ${sNum},
          ${finalUrl},
          ${key},
          ${assetFileName},
          ${contentType},
          ${buffer.length}
        );
      `;
    }
  }

  return {
    ok: true,
    publicUrl: finalUrl,
    fileKey: key,
    fileName: assetFileName,
    sceneIndex: sNum,
    imageIndex: imgIdx,
  };
}


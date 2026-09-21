import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

/**
 * Resolve PostersHive API URL & Token from channel settings or environment.
 */
function resolvePosthiveConfig(rawApiKey) {
  const envPosthiveUrl = (
    process.env.POSTHIVE_API_URL ||
    process.env.POSTERSHIVE_API_URL ||
    process.env.NEXT_PUBLIC_POSTHIVE_URL ||
    ""
  ).trim();

  let posthiveBaseUrl = envPosthiveUrl;
  let apiKey = (rawApiKey || "").trim();

  if (apiKey.includes("|")) {
    const parts = apiKey.split("|");
    if (parts[0].startsWith("http")) {
      posthiveBaseUrl = parts[0].trim();
      apiKey = parts[1].trim();
    }
  } else if (apiKey.startsWith("http://") || apiKey.startsWith("https://")) {
    posthiveBaseUrl = apiKey;
  }

  let publishUrl = posthiveBaseUrl;
  if (publishUrl && !publishUrl.endsWith("/api/publish")) {
    publishUrl = publishUrl.replace(/\/+$/, "") + "/api/publish";
  }

  return { posthiveBaseUrl, publishUrl, apiKey };
}

/**
 * GET - Query available/connected platforms from PostersHive for this channel
 */
export async function GET(request, { params }) {
  try {
    const rawParams = await params;
    const channelSlug = rawParams?.["channel-name"] || "";

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ platforms: ["youtube", "tiktok"] });
    }

    await initDbSchema();

    const channelRows = await sql`
      SELECT postershive_api AS "postershiveApi", channel_tags AS "channelTags"
      FROM channels
      WHERE slug = ${channelSlug}
      LIMIT 1;
    `;

    const channel = channelRows?.[0];
    const rawApiKey = (channel?.postershiveApi || "").trim();

    if (!rawApiKey) {
      return NextResponse.json({
        platforms: ["youtube", "tiktok"],
        channelTags: channel?.channelTags || "",
        configured: false,
      });
    }

    const { publishUrl, apiKey } = resolvePosthiveConfig(rawApiKey);

    if (!publishUrl) {
      return NextResponse.json({
        platforms: ["youtube", "tiktok"],
        channelTags: channel?.channelTags || "",
        configured: false,
      });
    }

    try {
      const res = await fetch(publishUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-api-key": apiKey,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const active = Array.isArray(data.platforms) && data.platforms.length > 0
          ? data.platforms
          : ["youtube", "tiktok"];
        return NextResponse.json({
          platforms: active,
          channelTags: channel?.channelTags || "",
          configured: true,
        });
      }
    } catch {
      // Fall back if PostersHive GET endpoint is unavailable
    }

    return NextResponse.json({
      platforms: ["youtube", "tiktok"],
      channelTags: channel?.channelTags || "",
      configured: true,
    });
  } catch (err) {
    return NextResponse.json({ platforms: ["youtube", "tiktok"] });
  }
}

/**
 * POST - Publish or schedule video to YouTube, TikTok, or both via PostersHive
 */
export async function POST(request, { params }) {
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

    // 1. Fetch channel & topic details
    const rows = await sql`
      SELECT 
        t.id AS "topicId",
        t.title AS "topicTitle",
        t.slug AS "topicSlug",
        t.script_content AS "scriptContent",
        t.story_description AS "storyDescription",
        t.master_video_url AS "masterVideoUrl",
        t.thumbnail_url AS "thumbnailUrl",
        COALESCE(t.video_type, 'longform') AS "videoType",
        t.youtube_video_id AS "youtubeVideoId",
        t.youtube_url AS "youtubeUrl",
        t.tiktok_publish_id AS "tiktokPublishId",
        c.id AS "channelId",
        c.name AS "channelName",
        c.slug AS "channelSlug",
        c.postershive_api AS "postershiveApi",
        c.channel_tags AS "channelTags"
      FROM topics t
      JOIN channels c ON c.id = t.channel_id
      WHERE c.slug = ${channelSlug} AND t.slug = ${topicSlug}
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Channel or topic record not found." },
        { status: 404 }
      );
    }

    const item = rows[0];

    // 2. Validate PostersHive API key
    const rawApiKey = (item.postershiveApi || "").trim();
    if (!rawApiKey) {
      return NextResponse.json(
        {
          error: `PostersHive API Key is not configured for channel "${item.channelName || channelSlug}". Please go to Channel Settings to save your PostersHive API Key.`,
          code: "MISSING_API_KEY",
        },
        { status: 400 }
      );
    }

    // 3. Validate Master Video URL
    const masterVideoUrl = item.masterVideoUrl?.trim();
    if (!masterVideoUrl || masterVideoUrl === "generated") {
      return NextResponse.json(
        {
          error: "No completed master video compiled for this topic. Please render or upload the master video in the Completed Video tab before publishing.",
          code: "MISSING_MASTER_VIDEO",
        },
        { status: 400 }
      );
    }

    // 4. Parse request body
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // Determine target platforms
    const rawPlatforms = body.platforms || (body.platform ? [body.platform] : ["youtube"]);
    const selectedPlatforms = (Array.isArray(rawPlatforms) ? rawPlatforms : [rawPlatforms])
      .map((p) => String(p).toLowerCase().trim())
      .filter((p) => p === "youtube" || p === "tiktok");

    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one target platform (YouTube or TikTok)." },
        { status: 400 }
      );
    }

    // Validate Thumbnail URL (Required only for longform YouTube videos)
    const isShort = (item.videoType || "").toLowerCase() === "short";
    const thumbnailUrl = item.thumbnailUrl?.trim();
    const validThumbnail = thumbnailUrl && thumbnailUrl !== "generated" ? thumbnailUrl : null;

    if (selectedPlatforms.includes("youtube") && !isShort && !validThumbnail) {
      return NextResponse.json(
        {
          error: "A custom thumbnail is required for longform YouTube publishing. Please generate or upload a thumbnail in the Thumbnail tab.",
          code: "MISSING_THUMBNAIL",
        },
        { status: 400 }
      );
    }

    // Titles, Descriptions, Tags
    const postTitle = (body.title || item.topicTitle || "Faceless Video").trim();
    const rawDescription = (
      body.description ||
      item.storyDescription ||
      item.scriptContent ||
      `${item.topicTitle}\n\nGenerated with Faceless 2.0 Studio`
    ).trim();

    // Parse Tags
    const inputTags = body.tags !== undefined ? body.tags : (item.channelTags || "");
    const tagArray = (Array.isArray(inputTags) ? inputTags : String(inputTags).split(","))
      .map((t) => String(t).trim().replace(/^#/, ""))
      .filter(Boolean);

    // Format hashtags block
    const hashtagText = tagArray.length > 0
      ? tagArray.map((t) => `#${t.replace(/\s+/g, "")}`).join(" ")
      : "";

    // Append hashtags to description if not already present
    let finalDescription = rawDescription;
    if (hashtagText && !finalDescription.includes(tagArray[0])) {
      finalDescription = `${finalDescription}\n\n${hashtagText}`.trim();
    }

    // Privacy & Scheduling options
    const scheduledAt = body.scheduledAt || body.scheduled_at || null;
    const youtubeUploadPrivate = Boolean(body.youtubeUploadPrivate || body.upload_as_private);
    const privacyStatus = youtubeUploadPrivate ? "private" : (body.privacyStatus || body.privacy_status || "public");

    const { publishUrl, apiKey } = resolvePosthiveConfig(rawApiKey);
    if (!publishUrl) {
      return NextResponse.json(
        {
          error: "PostersHive API URL is not configured. Please check your environment variables or Channel Settings.",
          code: "MISSING_POSTHIVE_ENV",
        },
        { status: 400 }
      );
    }

    console.log(`[Publish] Calling PostersHive at ${publishUrl} for platforms: ${selectedPlatforms.join(", ")}`);

    // Helper to call PostersHive for a single platform
    async function postSinglePlatform(platformName) {
      const isYt = platformName === "youtube";
      const payload = {
        platform: platformName,
        post_title: postTitle,
        description: finalDescription,
        caption: isYt ? postTitle : `${postTitle}\n\n${hashtagText}`.trim(),
        media_url: masterVideoUrl,
        ...(isYt && validThumbnail ? { thumbnail_url: validThumbnail } : {}),
        tags: tagArray,
        channel_tags: tagArray.join(", "),
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
        ...(isYt
          ? {
              privacy_status: privacyStatus,
              upload_as_private: youtubeUploadPrivate,
              youtube_schedule_type: youtubeUploadPrivate && scheduledAt ? "youtube_native" : (scheduledAt ? "youtube_native" : undefined),
            }
          : {}),
      };

      const res = await fetch(publishUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        data = { error: text || `HTTP ${res.status} response from PostersHive` };
      }

      return { ok: res.ok, status: res.status, data };
    }

    // Execute posts for each selected platform
    const platformResults = {};
    const errors = [];

    for (const platform of selectedPlatforms) {
      try {
        const res = await postSinglePlatform(platform);
        if (res.ok && !res.data.error && res.data.success !== false) {
          platformResults[platform] = res.data;
        } else {
          const errMsg = res.data.error || res.data.message || `Failed to post to ${platform} (status ${res.status})`;
          platformResults[platform] = { error: errMsg, success: false };
          errors.push(`${platform.toUpperCase()}: ${errMsg}`);
        }
      } catch (networkErr) {
        platformResults[platform] = { error: networkErr.message, success: false };
        errors.push(`${platform.toUpperCase()}: ${networkErr.message}`);
      }
    }

    const anySuccess = selectedPlatforms.some((p) => platformResults[p] && platformResults[p].success !== false && !platformResults[p].error);
    const allSuccess = errors.length === 0;

    if (!anySuccess) {
      return NextResponse.json(
        {
          error: errors.join(" | "),
          results: platformResults,
        },
        { status: 500 }
      );
    }

    // Extract returned IDs
    const ytData = platformResults.youtube;
    const ytPostId = ytData?.postId || ytData?.results?.youtube?.postId || ytData?.id;
    const ytUrl = ytPostId ? `https://www.youtube.com/watch?v=${ytPostId}` : null;

    const ttData = platformResults.tiktok;
    const ttPostId = ttData?.postId || ttData?.results?.tiktok?.postId || ttData?.id;

    // Persist published status in Neon DB
    if (ytPostId || ttPostId) {
      await sql`
        UPDATE topics
        SET
          youtube_video_id = COALESCE(${ytPostId || null}, youtube_video_id),
          youtube_url = COALESCE(${ytUrl || null}, youtube_url),
          youtube_published_at = ${ytPostId ? sql`NOW()` : sql`youtube_published_at`},
          tiktok_publish_id = COALESCE(${ttPostId || null}, tiktok_publish_id),
          tiktok_published_at = ${ttPostId ? sql`NOW()` : sql`tiktok_published_at`},
          published_platforms = ${JSON.stringify(platformResults)},
          updated_at = NOW()
        WHERE id = ${item.topicId};
      `;
    }

    const isScheduled = Boolean(scheduledAt);
    return NextResponse.json({
      success: true,
      scheduled: isScheduled,
      scheduledAt,
      platforms: selectedPlatforms,
      youtubeVideoId: ytPostId || null,
      youtubeUrl: ytUrl || null,
      tiktokPostId: ttPostId || null,
      privacyStatus,
      results: platformResults,
      message: isScheduled
        ? `Successfully scheduled video on ${selectedPlatforms.join(" & ")} for ${scheduledAt}`
        : `Successfully published video to ${selectedPlatforms.join(" & ")}!`,
      warnings: errors.length > 0 ? errors.join(" | ") : null,
    });
  } catch (err) {
    console.error("[Publish Route] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during publishing." },
      { status: 500 }
    );
  }
}

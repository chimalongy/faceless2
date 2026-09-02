import { NextResponse } from "next/server";
import { getDbSql, initDbSchema } from "@/lib/db";

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
        t.youtube_video_id AS "youtubeVideoId",
        t.youtube_url AS "youtubeUrl",
        c.id AS "channelId",
        c.name AS "channelName",
        c.slug AS "channelSlug",
        c.postershive_api AS "postershiveApi"
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

    // 4. Validate Thumbnail URL
    const thumbnailUrl = item.thumbnailUrl?.trim();
    if (!thumbnailUrl || thumbnailUrl === "generated") {
      return NextResponse.json(
        {
          error: "A custom thumbnail is required for YouTube publishing. Please generate or upload a thumbnail image in the Thumbnail tab.",
          code: "MISSING_THUMBNAIL",
        },
        { status: 400 }
      );
    }

    // 5. Parse request body for optional overrides
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const postTitle = (body.title || item.topicTitle || "Faceless Video").trim();
    const postDescription = (
      body.description ||
      item.storyDescription ||
      item.scriptContent ||
      `${item.topicTitle}\n\nGenerated with Faceless 2.0 Studio`
    ).trim();
    const scheduledAt = body.scheduledAt || body.scheduled_at || null;

    // 6. Determine PostHive API base URL & Auth Token
    const envPosthiveUrl = (
      process.env.POSTHIVE_API_URL ||
      process.env.POSTERSHIVE_API_URL ||
      process.env.NEXT_PUBLIC_POSTHIVE_URL ||
      ""
    ).trim();

    let posthiveBaseUrl = envPosthiveUrl;
    let apiKey = rawApiKey;

    // Check if the user entered "https://custom-domain.com|ph_live_..."
    if (rawApiKey.includes("|")) {
      const parts = rawApiKey.split("|");
      if (parts[0].startsWith("http")) {
        posthiveBaseUrl = parts[0].trim();
        apiKey = parts[1].trim();
      }
    } else if (rawApiKey.startsWith("http://") || rawApiKey.startsWith("https://")) {
      // If user provided direct endpoint URL
      posthiveBaseUrl = rawApiKey;
    }

    if (!posthiveBaseUrl) {
      return NextResponse.json(
        {
          error: "You must add Postershive Environment Variables",
          code: "MISSING_POSTHIVE_ENV",
        },
        { status: 400 }
      );
    }

    // Clean publish URL
    let publishUrl = posthiveBaseUrl;
    if (!publishUrl.endsWith("/api/publish")) {
      publishUrl = publishUrl.replace(/\/+$/, "") + "/api/publish";
    }

    console.log(`[YouTube Publish] Calling PostersHive at: ${publishUrl} for topic "${item.topicTitle}"`);

    // 7. Make request to PostHive
    const postPayload = {
      platform: "youtube",
      post_title: postTitle,
      description: postDescription,
      media_url: masterVideoUrl,
      thumbnail_url: thumbnailUrl,
      ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    };

    let posthiveRes;
    try {
      posthiveRes = await fetch(publishUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "x-api-key": apiKey,
        },
        body: JSON.stringify(postPayload),
      });
    } catch (networkErr) {
      console.error("[YouTube Publish] Network error connecting to PostHive:", networkErr);
      return NextResponse.json(
        {
          error: `Could not connect to PostersHive server at ${publishUrl}. Please ensure PostersHive is running and reachable. Error: ${networkErr.message}`,
          code: "POSTHIVE_UNREACHABLE",
        },
        { status: 502 }
      );
    }

    let posthiveData = {};
    try {
      posthiveData = await posthiveRes.json();
    } catch {
      const rawText = await posthiveRes.text().catch(() => "");
      posthiveData = { error: rawText || "Non-JSON response from PostersHive" };
    }

    if (!posthiveRes.ok || posthiveData.error || posthiveData.success === false) {
      const errorMsg =
        posthiveData.error ||
        posthiveData.message ||
        `PostersHive responded with status ${posthiveRes.status}`;
      console.error("[YouTube Publish] PostersHive publishing failed:", errorMsg);
      return NextResponse.json(
        {
          error: errorMsg,
          status: posthiveRes.status,
          details: posthiveData,
        },
        { status: posthiveRes.status >= 400 && posthiveRes.status < 600 ? posthiveRes.status : 500 }
      );
    }

    // 8. Extract YouTube Video ID & persist to Neon database
    const postId = posthiveData.postId || posthiveData.results?.youtube?.postId || posthiveData.id;
    const isScheduled = !!posthiveData.scheduled;
    const youtubeUrl = postId ? `https://www.youtube.com/watch?v=${postId}` : null;

    if (postId) {
      await sql`
        UPDATE topics
        SET
          youtube_video_id = ${postId},
          youtube_url = ${youtubeUrl},
          youtube_published_at = NOW(),
          updated_at = NOW()
        WHERE id = ${item.topicId};
      `;
    }

    return NextResponse.json({
      success: true,
      scheduled: isScheduled,
      postId: postId || null,
      youtubeUrl: youtubeUrl || null,
      message: isScheduled
        ? `Video successfully scheduled for publication on YouTube at ${posthiveData.scheduledAt}`
        : "Video successfully uploaded and published to YouTube!",
      details: posthiveData,
    });
  } catch (err) {
    console.error("[YouTube Publish] Unexpected error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during YouTube publishing." },
      { status: 500 }
    );
  }
}

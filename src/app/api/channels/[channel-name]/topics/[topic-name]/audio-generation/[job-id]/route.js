import { NextResponse } from "next/server";
import { getDbSql } from "@/lib/db";

export async function GET(_request, { params }) {
  try {
    const routeParams = await params;
    const channelSlug = routeParams?.["channel-name"] || "";
    const topicSlug = routeParams?.["topic-name"] || "";
    const jobId = routeParams?.["job-id"] || "";
    if (!channelSlug || !topicSlug || !jobId) {
      return NextResponse.json({ error: "Channel, topic, and job ID are required." }, { status: 400 });
    }

    const sql = getDbSql();
    if (!sql) {
      return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    }
    const rows = await sql`
      SELECT
        j.generation_id AS "jobId",
        j.status,
        j.total_scenes AS "totalScenes",
        j.processed_scenes AS "processedScenes",
        j.succeeded_scenes AS "succeededScenes",
        j.failed_scenes AS "failedScenes",
        j.results,
        j.error,
        j.updated_at AS "updatedAt"
      FROM audio_generation_jobs j
      JOIN channels c ON c.id = j.channel_id
      JOIN topics t ON t.id = j.topic_id
      WHERE j.generation_id = ${jobId}
        AND c.slug = ${channelSlug}
        AND t.slug = ${topicSlug}
      LIMIT 1;
    `;

    if (!rows?.length) {
      // Modal may still be starting the worker and creating its first job row.
      return NextResponse.json({ jobId, status: "starting" }, { status: 202 });
    }

    const job = rows[0];
    return NextResponse.json({
      ...job,
      results: Array.isArray(job.results) ? job.results : [],
    }, { status: 200 });
  } catch (error) {
    console.error("Failed to read bulk audio job status:", error);
    return NextResponse.json({ error: "Could not read bulk audio generation status." }, { status: 500 });
  }
}

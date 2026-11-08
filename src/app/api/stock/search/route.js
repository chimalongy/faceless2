import { NextResponse } from "next/server";
import { searchStockMedia } from "@/lib/stock-media";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const mediaType = searchParams.get("mediaType") || "all";
    const orientation = searchParams.get("orientation") || "all";
    const source = searchParams.get("source") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "24", 10);

    if (!query.trim()) {
      return NextResponse.json({
        ok: true,
        results: [],
        total: 0,
        query: "",
      });
    }

    const data = await searchStockMedia({
      query,
      mediaType,
      orientation,
      source,
      page,
      perPage,
    });

    return NextResponse.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    console.error("Stock search API error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to search stock media",
      },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";
import { normalizeNewsTab } from "../../../../lib/newsTaxonomy";
import { getNewsListing, parseNewsPage } from "../../../news/newsQueries";

export const dynamic = "force-dynamic";

// /news の「もっと見る」用。公開記事の一覧表示データだけを返す読み取り専用 API。
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = normalizeNewsTab(searchParams.get("category"));
  const q = String(searchParams.get("q") || "").slice(0, 200);
  const page = parseNewsPage(searchParams.get("page"));
  const listing = await getNewsListing({ category, q, page });
  return NextResponse.json(
    { items: listing.items, page: listing.page, totalPages: listing.totalPages, hasMore: listing.hasMore, total: listing.total },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}

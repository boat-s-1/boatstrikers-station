import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function snippet(text, keyword, radius = 700) {
  const source = String(text || "");
  const index = source.indexOf(keyword);
  if (index < 0) return null;
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + keyword.length + radius));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const race = Math.min(12, Math.max(1, Number(searchParams.get("race") || 12)));
  const url = `https://www.boatrace-tsu.com/sp/index.php?page=yosou-yosou&race=${race}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });
    const html = await response.text();
    const keywords = ["一周", "まわり足", "回り足", "直線", "オリジナル展示", "展示タイム", "cyokuzen", "group-tenji"];
    const snippets = Object.fromEntries(keywords.map((k) => [k, snippet(html, k)]));
    const tables = [];
    for (const match of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
      const table = match[0];
      if (/(一周|まわり足|回り足|直線|オリジナル展示|展示タイム)/.test(table)) {
        tables.push(table.slice(0, 12000));
      }
      if (tables.length >= 4) break;
    }
    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      race,
      url: response.url,
      length: html.length,
      keywordPresence: Object.fromEntries(keywords.map((k) => [k, html.includes(k)])),
      snippets,
      tables,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "fetch failed" }, { status: 500 });
  }
}

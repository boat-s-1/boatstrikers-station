import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function snippet(text, keyword, radius = 900) {
  const source = String(text || "");
  const index = source.indexOf(keyword);
  if (index < 0) return null;
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + keyword.length + radius));
}

async function fetchText(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        accept: "text/html,application/javascript,text/javascript,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });
    return { ok: response.ok, status: response.status, url: response.url, text: await response.text(), contentType: response.headers.get("content-type") };
  } catch (error) {
    return { ok: false, status: null, url, text: "", contentType: null, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

function scriptUrls(html, baseUrl) {
  const out = [];
  for (const match of String(html || "").matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    try { out.push(new URL(match[1], baseUrl).toString()); } catch {}
  }
  return unique(out);
}

function endpointCandidates(text) {
  const out = [];
  const source = String(text || "");
  for (const match of source.matchAll(/["'`]([^"'`]{2,260})["'`]/g)) {
    const value = match[1];
    if (/(api|ajax|race|tenji|exhibit|display|original|chokuzen|直前|展示|syussou|json|php)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 220);
}

function dataAttributes(html) {
  const out = [];
  for (const match of String(html || "").matchAll(/\b(data-[\w-]+)=["']([^"']+)["']/gi)) {
    const value = `${match[1]}=${match[2]}`;
    if (/(race|tenji|original|display|ajax|api|tab|url|req|day|date)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 220);
}

export async function GET() {
  const response = await fetchText("https://www.boatrace-toda.jp/");
  const html = response.text;
  const keywords = ["オリジナル展示データ", "オリジナル展示", "一周", "まわり足", "直線", "展示タイム", "直前情報", "展示情報"];
  const scripts = [];
  for (const url of scriptUrls(html, response.url).filter((u) => /boatrace-toda\.jp/.test(u)).slice(0, 24)) {
    const fetched = await fetchText(url, 6000);
    scripts.push({
      url,
      ok: fetched.ok,
      status: fetched.status,
      contentType: fetched.contentType,
      endpoints: fetched.ok ? endpointCandidates(fetched.text) : [],
      keywordPresence: fetched.ok ? Object.fromEntries(keywords.map((k) => [k, fetched.text.includes(k)])) : null,
      snippets: fetched.ok ? Object.fromEntries(["オリジナル展示", "一周", "まわり足", "直線", "ajax", "api", "race"].map((k) => [k, snippet(fetched.text, k, 1200)])) : null,
      error: fetched.error || null,
    });
  }

  const tables = [];
  for (const match of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const table = match[0];
    if (/(オリジナル展示|一周|まわり足|直線)/.test(table)) tables.push(table.slice(0, 16000));
    if (tables.length >= 4) break;
  }

  return NextResponse.json({
    ok: response.ok,
    status: response.status,
    url: response.url,
    length: html.length,
    keywordPresence: Object.fromEntries(keywords.map((k) => [k, html.includes(k)])),
    snippets: Object.fromEntries(keywords.map((k) => [k, snippet(html, k)])),
    dataAttributes: dataAttributes(html),
    inlineEndpoints: endpointCandidates(html),
    tables,
    scripts,
    ranAt: new Date().toISOString(),
  });
}

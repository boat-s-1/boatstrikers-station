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
        accept: "text/html,application/javascript,text/javascript,application/xml,text/xml,*/*;q=0.8",
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
  for (const match of source.matchAll(/["'`]([^"'`]{2,300})["'`]/g)) {
    const value = match[1];
    if (/(api|ajax|race|tenji|exhibit|display|original|chokuzen|直前|展示|syussou|xml|kaisai|json|php)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 300);
}

function dataAttributes(html) {
  const out = [];
  for (const match of String(html || "").matchAll(/\b(data-[\w-]+)=["']([^"']+)["']/gi)) {
    const value = `${match[1]}=${match[2]}`;
    if (/(race|tenji|original|display|ajax|api|tab|url|req|day|date)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 300);
}

function xmlPaths(text) {
  const out = [];
  for (const match of String(text || "").matchAll(/["'`]([^"'`]*\.xml(?:\?[^"'`]*)?)["'`]/gi)) out.push(match[1]);
  return unique(out).slice(0, 300);
}

export async function GET() {
  const response = await fetchText("https://www.boatrace-toda.jp/");
  const html = response.text;
  const keywords = ["オリジナル展示データ", "オリジナル展示", "一周", "まわり足", "直線", "展示タイム", "直前情報", "展示情報"];
  const allScripts = scriptUrls(html, response.url).filter((u) => /boatrace-toda\.jp/.test(u));
  const interestingScripts = allScripts.filter((u) => /(race|tenji|choku|display|syus|series|xml|index|top)/i.test(u));
  const scripts = [];
  for (const url of unique([...interestingScripts, ...allScripts]).slice(0, 60)) {
    const fetched = await fetchText(url, 6000);
    if (!fetched.ok) {
      scripts.push({ url, ok: false, status: fetched.status, error: fetched.error || null });
      continue;
    }
    const endpoints = endpointCandidates(fetched.text);
    const xml = xmlPaths(fetched.text);
    const hasUseful = endpoints.length || xml.length || keywords.some((k) => fetched.text.includes(k)) || /(TENJI|CHOKUZEN|RACE_NO|kaisai)/i.test(fetched.text);
    if (!hasUseful) continue;
    scripts.push({
      url,
      ok: true,
      status: fetched.status,
      contentType: fetched.contentType,
      endpoints,
      xmlPaths: xml,
      keywordPresence: Object.fromEntries(keywords.map((k) => [k, fetched.text.includes(k)])),
      snippets: Object.fromEntries(["オリジナル展示", "一周", "まわり足", "直線", "tenji", "chokuzen", "xml/kaisai", "RACE_NO", "download("].map((k) => [k, snippet(fetched.text, k, 1400)])),
      error: null,
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
    inlineXmlPaths: xmlPaths(html),
    allScriptUrls: allScripts,
    tables,
    scripts,
    ranAt: new Date().toISOString(),
  });
}

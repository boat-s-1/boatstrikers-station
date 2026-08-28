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
  return unique(out).slice(0, 400);
}

function dataAttributes(html) {
  const out = [];
  for (const match of String(html || "").matchAll(/\b(data-[\w-]+)=["']([^"']+)["']/gi)) {
    const value = `${match[1]}=${match[2]}`;
    if (/(race|tenji|original|display|ajax|api|tab|url|req|day|date)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 400);
}

function xmlPaths(text) {
  const out = [];
  for (const match of String(text || "").matchAll(/["'`]([^"'`]*\.xml(?:\?[^"'`]*)?)["'`]/gi)) out.push(match[1]);
  return unique(out).slice(0, 400);
}

function tableSnippets(html) {
  const tables = [];
  for (const match of String(html || "").matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const table = match[0];
    if (/(オリジナル展示|一周|まわり足|直線|展示タイム)/.test(table)) tables.push(table.slice(0, 18000));
    if (tables.length >= 6) break;
  }
  return tables;
}

async function diagnosePage(url, keywords) {
  const response = await fetchText(url);
  const html = response.text;
  const allScripts = scriptUrls(html, response.url).filter((u) => /boatrace-toda\.jp/.test(u));
  const scripts = [];
  for (const scriptUrl of allScripts.slice(0, 80)) {
    const fetched = await fetchText(scriptUrl, 6000);
    if (!fetched.ok) continue;
    const endpoints = endpointCandidates(fetched.text);
    const xml = xmlPaths(fetched.text);
    const hasUseful = endpoints.length || xml.length || keywords.some((k) => fetched.text.includes(k)) || /(TENJI|CHOKUZEN|RACE_NO|kaisai|original)/i.test(fetched.text);
    if (!hasUseful) continue;
    scripts.push({
      url: scriptUrl,
      status: fetched.status,
      endpoints,
      xmlPaths: xml,
      keywordPresence: Object.fromEntries(keywords.map((k) => [k, fetched.text.includes(k)])),
      snippets: Object.fromEntries(["オリジナル展示", "一周", "まわり足", "直線", "展示タイム", "tenji", "chokuzen", "xml/kaisai", "RACE_NO", "download("].map((k) => [k, snippet(fetched.text, k, 1800)])),
    });
  }
  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    length: html.length,
    keywordPresence: Object.fromEntries(keywords.map((k) => [k, html.includes(k)])),
    snippets: Object.fromEntries(keywords.map((k) => [k, snippet(html, k, 1400)])),
    dataAttributes: dataAttributes(html),
    inlineEndpoints: endpointCandidates(html),
    inlineXmlPaths: xmlPaths(html),
    allScriptUrls: allScripts,
    tables: tableSnippets(html),
    scripts,
  };
}

export async function GET() {
  const keywords = ["オリジナル展示データ", "オリジナル展示", "一周", "まわり足", "直線", "展示タイム", "直前情報", "展示情報"];
  const candidates = [
    "https://www.boatrace-toda.jp/",
    "https://www.boatrace-toda.jp/race/shusso_list.html",
    "https://www.boatrace-toda.jp/race/",
  ];
  const pages = [];
  for (const url of candidates) pages.push(await diagnosePage(url, keywords));
  return NextResponse.json({ ok: true, pages, ranAt: new Date().toISOString() });
}

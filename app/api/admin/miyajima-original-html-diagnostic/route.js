import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function snippet(text, keyword, radius = 1000) {
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
        accept: "text/html,application/javascript,text/javascript,application/json,application/xml,text/xml,*/*;q=0.8",
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
  for (const match of String(text || "").matchAll(/["'`]([^"'`]{2,320})["'`]/g)) {
    const value = match[1];
    if (/(api|ajax|race|tenji|exhibit|display|original|chokuzen|直前|展示|syus|json|php|xml|pdf)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 300);
}

function dataAttributes(html) {
  const out = [];
  for (const match of String(html || "").matchAll(/\b(data-[\w-]+)=["']([^"']+)["']/gi)) {
    const value = `${match[1]}=${match[2]}`;
    if (/(race|tenji|original|display|ajax|api|tab|url|req|day|date|rno)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 300);
}

export async function GET() {
  const targets = [
    "https://www.boatrace-miyajima.com/index.html",
    "https://www.boatrace-miyajima.com/race_info.html",
    "https://www.boatrace-miyajima.com/racedata.html",
  ];
  const keywords = ["オリジナル展示", "展示航走", "展示タイム", "一周", "まわり足", "回り足", "直線", "直前情報", "展示情報"];
  const pages = [];

  for (const target of targets) {
    const response = await fetchText(target);
    const html = response.text;
    const scripts = [];
    for (const url of scriptUrls(html, response.url).filter((u) => /boatrace-miyajima\.com/.test(u)).slice(0, 50)) {
      const fetched = await fetchText(url, 6000);
      if (!fetched.ok) {
        scripts.push({ url, ok: false, status: fetched.status, error: fetched.error || null });
        continue;
      }
      const endpoints = endpointCandidates(fetched.text);
      const useful = endpoints.length || keywords.some((k) => fetched.text.includes(k)) || /(ajax|race|tenji|chokuzen|display|rno)/i.test(fetched.text);
      if (!useful) continue;
      scripts.push({
        url,
        ok: true,
        status: fetched.status,
        contentType: fetched.contentType,
        endpoints,
        keywordPresence: Object.fromEntries(keywords.map((k) => [k, fetched.text.includes(k)])),
        snippets: Object.fromEntries(["オリジナル展示", "展示航走", "展示タイム", "一周", "まわり足", "回り足", "直線", "ajax", "race", "rno"].map((k) => [k, snippet(fetched.text, k, 1400)])),
      });
    }

    const tables = [];
    for (const match of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
      const table = match[0];
      if (/(オリジナル展示|展示航走|展示タイム|一周|まわり足|回り足|直線)/.test(table)) tables.push(table.slice(0, 18000));
      if (tables.length >= 5) break;
    }

    pages.push({
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
    });
  }

  return NextResponse.json({ ok: pages.some((p) => p.ok), pages, ranAt: new Date().toISOString() });
}

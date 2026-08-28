import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchText(url, timeoutMs = 7000, init = {}) {
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
        ...(init.headers || {}),
      },
      ...init,
    });
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type"),
      text: await response.text(),
    };
  } catch (error) {
    return { ok: false, status: null, url, text: "", contentType: null, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

function scripts(html, base) {
  const out = [];
  for (const m of String(html || "").matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)) {
    try { out.push(new URL(m[1], base).toString()); } catch {}
  }
  return uniq(out);
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function snippet(text, keyword, radius = 1500) {
  const source = String(text || "");
  const at = source.indexOf(keyword);
  if (at < 0) return null;
  return source.slice(Math.max(0, at - radius), Math.min(source.length, at + keyword.length + radius));
}

function endpointCandidates(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/["'`]([^"'`]{2,360})["'`]/g)) {
    const v = m[1];
    if (/(ajax|api|race|tenji|chokuzen|display|original|exhibit|json|xml|php|yoso|tyoku|直前|展示|周回|まわり)/i.test(v)) out.push(v);
  }
  return uniq(out).slice(0, 400);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const race = Math.min(12, Math.max(1, Number(searchParams.get("race") || 10)));
  const targets = [
    "https://www.boatrace-amagasaki.jp/sp/index.php",
    `https://www.boatrace-amagasaki.jp/sp/index.php?page=raceinfo-chokuzen&race=${race}`,
    `https://www.boatrace-amagasaki.jp/sp/index.php?page=raceinfo-before&race=${race}`,
    `https://www.boatrace-amagasaki.jp/sp/index.php?page=yosou-cyokuzen&race=${race}`,
    `https://www.boatrace-amagasaki.jp/sp/index.php?page=raceinfo-race&race=${race}`,
  ];
  const keywords = ["オリジナル展示", "展示タイム", "1周", "一周", "まわり足", "回り足", "直線", "直前情報", "周回展示"];
  const pages = [];

  for (const target of targets) {
    const response = await fetchText(target);
    const html = response.text;
    const scriptResults = [];
    for (const url of scripts(html, response.url).filter((u) => /boatrace-amagasaki\.jp/.test(u)).slice(0, 60)) {
      const fetched = await fetchText(url, 6000);
      if (!fetched.ok) {
        scriptResults.push({ url, ok: false, status: fetched.status, error: fetched.error || null });
        continue;
      }
      const endpoints = endpointCandidates(fetched.text);
      const useful = endpoints.length || keywords.some((k) => fetched.text.includes(k));
      if (!useful) continue;
      scriptResults.push({
        url,
        ok: true,
        status: fetched.status,
        contentType: fetched.contentType,
        endpoints,
        keywordPresence: Object.fromEntries(keywords.map((k) => [k, fetched.text.includes(k)])),
        snippets: Object.fromEntries(["オリジナル展示", "展示タイム", "一周", "1周", "まわり足", "回り足", "直線", "ajax", "race", "chokuzen"].map((k) => [k, snippet(fetched.text, k)])),
      });
    }

    const tables = [];
    for (const m of String(html || "").matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
      const table = m[0];
      if (/(オリジナル展示|展示タイム|一周|1周|まわり足|回り足|直線)/.test(table)) {
        tables.push({ text: stripTags(table).slice(0, 10000), raw: table.slice(0, 18000) });
      }
      if (tables.length >= 8) break;
    }

    pages.push({
      ok: response.ok,
      status: response.status,
      url: response.url,
      length: html.length,
      keywordPresence: Object.fromEntries(keywords.map((k) => [k, html.includes(k)])),
      snippets: Object.fromEntries(keywords.map((k) => [k, snippet(html, k)])),
      inlineEndpoints: endpointCandidates(html),
      tables,
      scripts: scriptResults,
    });
  }

  return NextResponse.json({ ok: pages.some((p) => p.ok), race, pages, ranAt: new Date().toISOString() });
}

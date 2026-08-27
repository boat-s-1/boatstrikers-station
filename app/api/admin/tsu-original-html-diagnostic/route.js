import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function snippet(text, keyword, radius = 700) {
  const source = String(text || "");
  const index = source.indexOf(keyword);
  if (index < 0) return null;
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + keyword.length + radius));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function links(html, baseUrl) {
  const out = [];
  for (const match of String(html || "").matchAll(/<(?:a|form)\b[^>]*(?:href|action)=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const absolute = new URL(match[1], baseUrl).toString();
      if (/(yosou|cyokuzen|tenji|sttenji|race|ajax|api)/i.test(absolute)) out.push(absolute);
    } catch {}
  }
  return unique(out).slice(0, 120);
}

function scripts(html, baseUrl) {
  const out = [];
  for (const match of String(html || "").matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    try { out.push(new URL(match[1], baseUrl).toString()); } catch {}
  }
  return unique(out);
}

function dataAttributes(html) {
  const out = [];
  for (const match of String(html || "").matchAll(/\b(data-[\w-]+)=["']([^"']+)["']/gi)) {
    if (/(tab|race|tenji|cyokuzen|page|url|req|run|day)/i.test(`${match[1]} ${match[2]}`)) out.push(`${match[1]}=${match[2]}`);
  }
  return unique(out).slice(0, 200);
}

function reqElements(html) {
  const out = [];
  for (const match of String(html || "").matchAll(/<[^>]+\bdata-req=["'](?:cyokuzen|sttenji)["'][^>]*>/gi)) {
    out.push(match[0]);
  }
  return unique(out).slice(0, 20);
}

function endpointCandidates(text) {
  const out = [];
  for (const match of String(text || "").matchAll(/["'`]([^"'`]{2,220})["'`]/g)) {
    const value = match[1];
    if (/(yosou|cyokuzen|tenji|sttenji|ajax|api|race=|rno|req=)/i.test(value)) out.push(value);
  }
  return unique(out).slice(0, 160);
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

function detectTargetDay(html) {
  const m = String(html || "").match(/getYosou\(\s*(\d{8})\s*,/);
  return m?.[1] || null;
}

function summarizeProbe(result) {
  const text = result?.text || "";
  const keywords = ["一周", "まわり足", "回り足", "直線", "オリジナル展示", "展示タイム"];
  return {
    ok: Boolean(result?.ok),
    status: result?.status ?? null,
    url: result?.url ?? null,
    length: text.length,
    keywordPresence: Object.fromEntries(keywords.map((k) => [k, text.includes(k)])),
    snippet: keywords.map((k) => snippet(text, k, 350)).find(Boolean) || text.slice(0, 1000),
    error: result?.error || null,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const race = Math.min(12, Math.max(1, Number(searchParams.get("race") || 12)));
  const url = `https://www.boatrace-tsu.com/sp/index.php?page=yosou-yosou&race=${race}`;
  try {
    const response = await fetchText(url);
    const html = response.text;
    const keywords = ["一周", "まわり足", "回り足", "直線", "オリジナル展示", "展示タイム", "cyokuzen", "group-tenji", "sttenji", "直前情報", "展示情報"];
    const snippets = Object.fromEntries(keywords.map((k) => [k, snippet(html, k)]));
    const tables = [];
    for (const match of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
      const table = match[0];
      if (/(一周|まわり足|回り足|直線|オリジナル展示|展示タイム)/.test(table)) tables.push(table.slice(0, 12000));
      if (tables.length >= 4) break;
    }

    const scriptUrls = scripts(html, response.url);
    const scriptDiagnostics = [];
    for (const scriptUrl of scriptUrls.filter((u) => u.includes("boatrace-tsu.com")).slice(0, 14)) {
      const fetched = await fetchText(scriptUrl, 6000);
      const ajaxNeedles = ["getYosou", "$.ajax", "url:", "data:", "data-req", "data-run", "cyokuzen", "sttenji", "resultrace"];
      scriptDiagnostics.push({
        url: scriptUrl,
        ok: fetched.ok,
        status: fetched.status,
        contentType: fetched.contentType,
        endpoints: fetched.ok ? endpointCandidates(fetched.text) : [],
        ajaxSnippets: fetched.ok ? Object.fromEntries(ajaxNeedles.map((k) => [k, snippet(fetched.text, k, 1200)])) : null,
        keywordPresence: fetched.ok ? Object.fromEntries(keywords.map((k) => [k, fetched.text.includes(k)])) : null,
        error: fetched.error || null,
      });
    }

    const targetDay = detectTargetDay(html);
    const ajaxProbes = [];
    if (targetDay) {
      for (const req of ["cyokuzen", "sttenji"]) {
        for (const run of [0, 1, 2, 3]) {
          const ajaxUrl = `https://www.boatrace-tsu.com/sp/ajax/ajax_yosou.php?targetday=${targetDay}&race=${race}&req=${req}&run=${run}`;
          const result = await fetchText(ajaxUrl, 5000);
          ajaxProbes.push({ req, run, ...summarizeProbe(result) });
        }
      }
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      race,
      url: response.url,
      targetDay,
      length: html.length,
      keywordPresence: Object.fromEntries(keywords.map((k) => [k, html.includes(k)])),
      snippets,
      tables,
      links: links(html, response.url),
      dataAttributes: dataAttributes(html),
      reqElements: reqElements(html),
      inlineEndpoints: endpointCandidates(html),
      scripts: scriptDiagnostics,
      ajaxProbes,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "fetch failed" }, { status: 500 });
  }
}

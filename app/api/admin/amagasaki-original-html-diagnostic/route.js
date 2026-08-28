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

function getYosouCalls(html) {
  return [...String(html || "").matchAll(/getYosou\s*\(\s*([^)]{1,240})\)/g)]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .slice(0, 30);
}

function dataReqs(html) {
  return uniq([...String(html || "").matchAll(/data-req=["']([^"']+)["']/gi)].map((m) => m[1])).slice(0, 30);
}

function summarizeAjax(response, req, run) {
  const raw = String(response.text || "");
  const text = stripTags(raw);
  const keywords = ["オリジナル展示", "展示タイム", "1周", "一周", "まわり足", "回り足", "直線", "直前情報", "スタート展示"];
  return {
    req,
    run,
    ok: response.ok,
    status: response.status,
    url: response.url,
    length: raw.length,
    text: text.slice(0, 6000),
    keywordPresence: Object.fromEntries(keywords.map((k) => [k, raw.includes(k) || text.includes(k)])),
    rawSnippet: raw.slice(0, 9000),
    error: response.error || null,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const race = Math.min(12, Math.max(1, Number(searchParams.get("race") || 10)));
  const day = String(searchParams.get("date") || "20260828").replace(/\D/g, "").slice(0, 8);
  const targets = ["https://www.boatrace-amagasaki.jp/sp/index.php"];
  const keywords = ["オリジナル展示", "展示タイム", "1周", "一周", "まわり足", "回り足", "直線", "直前情報", "周回展示"];
  const pages = [];
  const discoveredReqs = [];

  for (const target of targets) {
    const response = await fetchText(target);
    const html = response.text;
    const scriptResults = [];
    discoveredReqs.push(...dataReqs(html));
    for (const url of scripts(html, response.url).filter((u) => /boatrace-amagasaki\.jp/.test(u)).slice(0, 60)) {
      const fetched = await fetchText(url, 6000);
      if (!fetched.ok) continue;
      const endpoints = endpointCandidates(fetched.text);
      const useful = endpoints.length || keywords.some((k) => fetched.text.includes(k));
      if (!useful) continue;
      scriptResults.push({
        url,
        ok: true,
        status: fetched.status,
        endpoints,
        getYosouCalls: getYosouCalls(fetched.text),
        dataReqs: dataReqs(fetched.text),
        snippets: { ajax: snippet(fetched.text, "ajax_yosou.php", 2500), getYosou: snippet(fetched.text, "function getYosou", 2500) },
      });
      discoveredReqs.push(...dataReqs(fetched.text));
    }

    pages.push({
      ok: response.ok,
      status: response.status,
      url: response.url,
      length: html.length,
      getYosouCalls: getYosouCalls(html),
      dataReqs: dataReqs(html),
      snippets: { getYosou: snippet(html, "getYosou", 2200), ajaxYosou: snippet(html, "ajax_yosou.php", 2200) },
      scripts: scriptResults,
    });
  }

  const reqCandidates = uniq([...discoveredReqs, "cyokuzen", "sttenji", "tenji", "chokuzen"]).slice(0, 12);
  const ajaxProbes = [];
  for (const req of reqCandidates) {
    for (const run of [0, 1]) {
      const url = `https://www.boatrace-amagasaki.jp/sp/ajax/ajax_yosou.php?targetday=${day}&race=${race}&req=${encodeURIComponent(req)}&run=${run}`;
      const fetched = await fetchText(url, 7000, { headers: { referer: "https://www.boatrace-amagasaki.jp/sp/index.php", "x-requested-with": "XMLHttpRequest" } });
      ajaxProbes.push(summarizeAjax(fetched, req, run));
    }
  }

  return NextResponse.json({ ok: pages.some((p) => p.ok), race, day, reqCandidates, pages, ajaxProbes, ranAt: new Date().toISOString() });
}

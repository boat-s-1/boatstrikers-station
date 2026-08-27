import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORIGIN = "https://www.boatrace-tsu.com";
const START_PATHS = ["/", "/modules/raceinfo/"];
const KEYWORDS = [
  "直前情報", "展示情報", "オリジナル展示", "一周", "まわり足", "直線",
  "fetch(", "XMLHttpRequest", "axios", "/api/", "ajax", "raceinfo", "rno", "race_no", "race=",
];

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchText(url, timeoutMs = 7000) {
  const t = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: t.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        accept: "text/html,application/javascript,text/javascript,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, contentType: response.headers.get("content-type"), text };
  } catch (error) {
    return { ok: false, status: null, url, contentType: null, text: "", error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  } finally {
    t.clear();
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function scriptSources(html, baseUrl) {
  const urls = [];
  for (const match of String(html || "").matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    try {
      urls.push(new URL(match[1], baseUrl).toString());
    } catch {}
  }
  return unique(urls);
}

function hrefCandidates(html, baseUrl) {
  const urls = [];
  for (const match of String(html || "").matchAll(/(?:href|action)=["']([^"']+)["']/gi)) {
    const raw = match[1];
    if (!/(race|yoso|tenji|choku|exhibit|info|ajax|api)/i.test(raw)) continue;
    try { urls.push(new URL(raw, baseUrl).toString()); } catch {}
  }
  return unique(urls).slice(0, 50);
}

function snippetAround(text, needle, max = 260) {
  const index = String(text || "").toLowerCase().indexOf(String(needle).toLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, index - Math.floor(max / 2));
  return String(text).slice(start, start + max).replace(/\s+/g, " ").trim();
}

function analyzeText(text) {
  const keywordHits = {};
  for (const keyword of KEYWORDS) {
    const lower = String(text || "").toLowerCase();
    const needle = keyword.toLowerCase();
    let count = 0;
    let pos = 0;
    while ((pos = lower.indexOf(needle, pos)) >= 0) { count += 1; pos += needle.length; }
    if (count) keywordHits[keyword] = { count, snippet: snippetAround(text, keyword) };
  }

  const urlLike = unique([
    ...String(text || "").matchAll(/https?:\/\/[^"'\s)]+/gi),
  ].map((m) => m[0]).filter((u) => /(boatrace-tsu\.com|race|yoso|tenji|choku|exhibit|ajax|api)/i.test(u))).slice(0, 50);

  const relativeEndpoints = unique([
    ...String(text || "").matchAll(/["'`]((?:\/|\.\.\/|\.\/)[^"'`\s]{2,160})["'`]/g),
  ].map((m) => m[1]).filter((u) => /(race|yoso|tenji|choku|exhibit|info|ajax|api|rno)/i.test(u))).slice(0, 80);

  return { length: String(text || "").length, keywordHits, urlLike, relativeEndpoints };
}

export async function GET() {
  try {
    const pages = [];
    const allScripts = [];
    for (const path of START_PATHS) {
      const fetched = await fetchText(new URL(path, ORIGIN).toString());
      const scripts = fetched.ok ? scriptSources(fetched.text, fetched.url) : [];
      allScripts.push(...scripts);
      pages.push({
        requested: path,
        ok: fetched.ok,
        status: fetched.status,
        url: fetched.url,
        contentType: fetched.contentType,
        scripts,
        hrefCandidates: fetched.ok ? hrefCandidates(fetched.text, fetched.url) : [],
        analysis: fetched.ok ? analyzeText(fetched.text) : null,
        error: fetched.error || null,
      });
    }

    const firstPartyScripts = unique(allScripts)
      .filter((url) => {
        try { return new URL(url).hostname.endsWith("boatrace-tsu.com"); } catch { return false; }
      })
      .slice(0, 16);

    const scripts = [];
    for (let i = 0; i < firstPartyScripts.length; i += 4) {
      const chunk = firstPartyScripts.slice(i, i + 4);
      const results = await Promise.all(chunk.map(async (url) => {
        const fetched = await fetchText(url, 7000);
        return {
          url,
          ok: fetched.ok,
          status: fetched.status,
          contentType: fetched.contentType,
          analysis: fetched.ok ? analyzeText(fetched.text.slice(0, 800000)) : null,
          error: fetched.error || null,
        };
      }));
      scripts.push(...results);
    }

    return NextResponse.json({ ok: true, origin: ORIGIN, pages, scripts, ranAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "tsu diagnostic failed" }, { status: 500 });
  }
}

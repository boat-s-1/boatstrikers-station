import { createHash } from "node:crypto";
import { STADIUM_BASIC_GUIDES } from "../../stadiumBasicGuide24.js";
import { stadiumBySlug } from "./topics.mjs";

export const USER_AGENT = "BoatStrikersBlogBot/1.0 (+https://www.boat-strike.online/blog)";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 20000;
const BASE_HOSTS = ["www.boatrace.jp"];

// Official URLs already verified in the repository (lib/stadiumBasicGuide24.js). Stadium-run websites are
// not guessed: an administrator registers them (kind official_site or manual).
export function defaultSourceUrls(stadiumSlug) {
  const guide = STADIUM_BASIC_GUIDES.find(g => g.slug === stadiumSlug);
  const stadium = stadiumBySlug(stadiumSlug);
  if (!guide?.officialUrl || !stadium) return [];
  return [{ stadium_slug: stadiumSlug, url: guide.officialUrl, label: `BOAT RACE公式 場データ（${stadium.name}）`, kind: "official_data" }];
}

export function normalizeSourceUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /^\d+(\.\d+){3}$/.test(url.hostname)) return null;
  url.hash = "";
  return url.toString().length <= 2000 ? url.toString() : null;
}

// Only fetch hosts that are either BOAT RACE official or explicitly registered by an administrator.
export function allowedHost(url, registeredUrls = []) {
  const host = new URL(url).hostname;
  return BASE_HOSTS.includes(host) || registeredUrls.some(item => { try { return new URL(item.url).hostname === host; } catch { return false; } });
}

export function robotsAllows(robotsText, pathname, agent = "boatstrikersblogbot") {
  const groups = []; let current = null, lastWasAgent = false;
  for (const raw of String(robotsText || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push(current = { agents: [], rules: [] });
      current.agents.push(value.toLowerCase()); lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow")) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const mine = groups.filter(g => g.agents.some(a => a !== "*" && agent.includes(a)));
  const rules = (mine.length ? mine : groups.filter(g => g.agents.includes("*"))).flatMap(g => g.rules).filter(r => r.path);
  let best = null;
  for (const rule of rules) {
    const prefix = rule.path.replace(/\*.*$/, "").replace(/\$$/, "");
    if (pathname.startsWith(prefix) && (!best || prefix.length > best.len || (prefix.length === best.len && rule.allow))) best = { len: prefix.length, allow: rule.allow };
  }
  return best ? best.allow : true;
}

function decodeEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] === "#") { const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
    return named[code.toLowerCase()] ?? all;
  });
}

export function extractText(html) {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim()).slice(0, 500);
  const description = decodeEntities(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || "").trim();
  let body = html.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/dt|\/dd|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " ").replace(/<[^>]+>/g, " ");
  body = decodeEntities(body).split("\n").map(line => line.replace(/[ \t　]+/g, " ").trim()).filter(Boolean).join("\n");
  const text = [description, body].filter(Boolean).join("\n").slice(0, MAX_TEXT);
  return { title, text };
}

function charsetOf(contentType, bytes) {
  const header = /charset=([\w-]+)/i.exec(contentType || "")?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  const value = (header || meta || "utf-8").toLowerCase();
  return ["shift_jis", "shift-jis", "sjis", "x-sjis", "windows-31j", "cp932"].includes(value) ? "shift_jis" : value === "euc-jp" ? "euc-jp" : "utf-8";
}

async function readLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer()).subarray(0, MAX_BYTES);
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("ページが大きすぎます（2MB超）。"); }
    chunks.push(value);
  }
  const out = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

async function timedFetch(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchImpl(url, { signal: controller.signal, redirect: "manual", headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" } }); }
  finally { clearTimeout(timer); }
}

// Fetch one registered official URL. Every attempt returns a record with fetched_at; failures carry fetch_error.
export async function fetchOfficialDocument({ fetchImpl = fetch, source, registeredUrls = [], now = () => new Date(), timeoutMs = 15000 }) {
  const fetchedAt = now().toISOString();
  const base = { source_url_id: source.id ?? null, stadium_slug: source.stadium_slug, url: source.url, kind: source.kind, fetched_at: fetchedAt,
    http_status: null, content_type: null, content_sha256: null, title: null, extracted_text: null, fetch_error: null };
  const fail = (message, extra = {}) => ({ ...base, ...extra, fetch_error: String(message).slice(0, 500) });
  const url = normalizeSourceUrl(source.url);
  if (!url) return fail("https の正しいURLではありません。");
  if (!allowedHost(url, registeredUrls)) return fail("登録されていないサイトです。URLを登録してから取得してください。");
  try {
    const target = new URL(url);
    const robots = await timedFetch(fetchImpl, `${target.origin}/robots.txt`, timeoutMs);
    if (robots.status >= 500) return fail("robots.txt を確認できませんでした。時間をおいて再取得してください。");
    if (robots.status === 200 && !robotsAllows(new TextDecoder().decode(await readLimited(robots)), target.pathname + target.search)) return fail("robots.txt で取得が許可されていません。手動で内容を確認してください。");
    const response = await timedFetch(fetchImpl, url, timeoutMs);
    const contentType = response.headers.get("content-type") || "";
    if (response.status >= 300 && response.status < 400) return fail("転送先があります。転送先のURLを登録してください。", { http_status: response.status, content_type: contentType });
    if (response.status !== 200) return fail(`取得に失敗しました（HTTP ${response.status}）。`, { http_status: response.status, content_type: contentType });
    if (!/^text\/(html|plain)/i.test(contentType)) return fail("HTMLまたはテキストではありません。", { http_status: response.status, content_type: contentType });
    const bytes = await readLimited(response);
    const html = new TextDecoder(charsetOf(contentType, bytes)).decode(bytes);
    const { title, text } = extractText(html);
    if (text.length < 40) return fail("本文をほとんど取得できませんでした（画像やスクリプトで表示するページの可能性）。", { http_status: 200, content_type: contentType });
    return { ...base, http_status: 200, content_type: contentType.slice(0, 200), content_sha256: createHash("sha256").update(bytes).digest("hex"), title: title || null, extracted_text: text };
  } catch (error) {
    return fail(error.name === "AbortError" ? "時間内に応答がありませんでした。" : `取得できませんでした：${error.message}`);
  }
}

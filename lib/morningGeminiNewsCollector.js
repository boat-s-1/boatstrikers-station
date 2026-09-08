import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function cleanText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseJsonArray(text) {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    return [];
  }
}

function extractGeminiText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .join("\n")
    .trim();
}

function validUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function collectMorningGeminiNews({ limit = 12 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY が未設定です。");

  const model = process.env.GEMINI_NEWS_MODEL || "gemini-2.5-flash-lite";
  const targetDate = jstDate();
  const wanted = Math.max(3, Math.min(Number(limit) || 12, 16));
  const prompt = `あなたはBoatStrikersのニュース収集担当です。現在の対象日は ${targetDate}（JST）です。Google検索を使い、日本のボートレースについて朝7時のX投稿候補に使える具体的な公開情報を収集してください。\n\n優先対象：本日の開催・優勝戦・準優・G1/G2/G3/SG・女子戦・注目選手・モーター・初優出/初勝利/初優勝関連・前日夜に確定した主要ニュース。全国24場を広く確認してください。\n\n絶対条件：未来の結果を作らない。未確認の着順・払戻・決まり手・選手関係・数値を作らない。結果記事は公式結果が確認できない限り結果として断定しない。一般論で水増ししない。各候補には直接確認できる元記事URLを必ず1つ付ける。Google検索結果ページURLや架空URLは禁止。\n\n出力はJSON配列だけ。最大${wanted}件。各要素は次のキーのみ：title, summary, source_name, source_url, published_at, event_date, venue, race_no, importance, target_character。target_characterは ichika / hatsune / kiina / boatstrikers のいずれか。importanceは1〜100。race_no不明はnull。event_date不明はnull。summaryは確認できる事実だけを150〜300文字以内で。`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 5000 },
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini API error: ${response.status}`);

  const raw = parseJsonArray(extractGeminiText(payload));
  const normalized = raw.map((item) => {
    const sourceUrl = validUrl(item?.source_url);
    const raceNo = Number(item?.race_no);
    const targetCharacter = ["ichika", "hatsune", "kiina", "boatstrikers"].includes(item?.target_character) ? item.target_character : "boatstrikers";
    return {
      collected_at: new Date().toISOString(),
      published_at: item?.published_at ? new Date(item.published_at).toISOString() : new Date().toISOString(),
      title: cleanText(item?.title, 240),
      summary: cleanText(item?.summary, 600),
      source_name: cleanText(item?.source_name, 120) || "Gemini Google Search",
      source_url: sourceUrl,
      importance: Math.max(1, Math.min(Number(item?.importance) || 50, 100)),
      target_character: targetCharacter,
      status: "unreviewed",
      verification_status: "pending",
      result_status: "unknown",
      verified: false,
      event_date: /^20\d{2}-\d{2}-\d{2}$/.test(String(item?.event_date || "")) ? item.event_date : null,
      venue: cleanText(item?.venue, 20) || null,
      race_no: Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12 ? raceNo : null,
      x_candidate: false,
      x_status: "none",
      raw_payload: { collector: "morning_gemini_google_search", target_date: targetDate, gemini_model: model },
    };
  }).filter((item) => item.title && item.summary && item.source_url).slice(0, wanted);

  if (!normalized.length) return { targetDate, model, found: 0, inserted: 0, skipped: 0 };

  const supabase = getClient();
  const urls = [...new Set(normalized.map((x) => x.source_url))];
  const titles = [...new Set(normalized.map((x) => x.title))];
  const [{ data: existingByUrl }, { data: existingByTitle }] = await Promise.all([
    supabase.from("bs_news_candidates").select("source_url").in("source_url", urls),
    supabase.from("bs_news_candidates").select("title").in("title", titles),
  ]);
  const existingUrls = new Set((existingByUrl || []).map((x) => x.source_url));
  const existingTitles = new Set((existingByTitle || []).map((x) => x.title));
  const fresh = normalized.filter((x) => !existingUrls.has(x.source_url) && !existingTitles.has(x.title));
  if (!fresh.length) return { targetDate, model, found: normalized.length, inserted: 0, skipped: normalized.length };

  const { data, error } = await supabase.from("bs_news_candidates").insert(fresh).select("id,title,source_url,target_character");
  if (error) throw error;
  return { targetDate, model, found: normalized.length, inserted: data?.length || 0, skipped: normalized.length - (data?.length || 0), items: data || [] };
}

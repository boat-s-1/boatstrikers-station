import { createClient } from "@supabase/supabase-js";

const CTA = "詳しいニュースとデータはBoatStrikersで！";
const VALID_CHARACTERS = new Set(["ichika", "hatsune", "kiina", "boatstrikers"]);

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function dayRange(dateText) {
  const start = new Date(`${dateText}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[\s　\-―ー・【】「」『』（）()\[\]!?！？:：,，.。]/g, "");
}

function textOf(item) {
  return `${item.category || ""} ${item.title || ""} ${item.summary || ""}`;
}

function newsScore(item) {
  const text = textOf(item);
  let score = Number(item.importance || 0);
  if (/\bSG\b/i.test(text)) score += 30;
  if (/\bG1\b/i.test(text)) score += 25;
  if (/優勝戦|優勝|ファイナル/.test(text)) score += 20;
  if (/事故|失格|転覆|落水|妨害|賞典除外|フライング/.test(text)) score += 20;
  if (/10万|100,?000|万舟/.test(text)) score += 20;
  else if (/5万|50,?000|高配当/.test(text)) score += 15;
  if (/女子|ヴィーナス|オールレディース/.test(text)) score += 10;
  if (item.event_type === "result_claim") score += 10;
  if (item.result_status === "confirmed") score += 10;
  if (item.verification_evidence && Object.keys(item.verification_evidence).length > 0) score += 5;
  return score;
}

function dedupeAndRank(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return [...items]
    .map((item) => ({ ...item, short_score: newsScore(item) }))
    .sort((a, b) => b.short_score - a.short_score || new Date(b.collected_at) - new Date(a.collected_at))
    .filter((item) => {
      const url = String(item.source_url || "");
      const title = normalizeTitle(item.title);
      if ((url && seenUrls.has(url)) || (title && seenTitles.has(title))) return false;
      if (url) seenUrls.add(url);
      if (title) seenTitles.add(title);
      return true;
    });
}

function chooseCharacter(item) {
  const text = textOf(item);
  if (/事故|失格|転覆|落水|妨害|負傷|怪我/.test(text)) return "boatstrikers";
  if (/女子|ヴィーナス|オールレディース/.test(text)) return "hatsune";
  if (/万舟|高配当|穴|5号艇|５号艇|外枠/.test(text)) return "kiina";
  if (/SG|G1|優勝戦|1号艇|１号艇|イン逃げ|イン戦/i.test(text)) return "ichika";
  return VALID_CHARACTERS.has(item.target_character) ? item.target_character : "boatstrikers";
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function stripFence(text) {
  return String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function callAi(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");
  const model = process.env.EDITORIAL_AI_MODEL || process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const instructions = `あなたはBoatStrikersのショート動画編集者です。検証済みニュース3件だけを材料に、縦型30〜35秒の「今日のBOAT NEWS 3」を作ってください。

絶対ルール:
- 材料にない選手名、数字、着順、配当、事故内容、発言を作らない。
- 事実と推測を混ぜない。未確定・予定情報は未来形にする。
- 事故・負傷は煽らず、落ち着いた表現にする。
- 各NEWSのナレーションは35〜55文字程度。短文でテンポよく。
- headlineは12〜18文字程度、captionは最大2行を想定して25〜35文字程度。
- character_commentは10〜28文字程度。boatstrikersの場合は中立コメント。
- X投稿は140文字以内。URLは入れない。
- ハッシュタグは #ボートレース #競艇 #BoatStrikers を基本に最大3個。
- JSON以外は返さない。

出力形式:
{"segments":[{"headline":"...","caption":"...","narration":"..."},{"headline":"...","caption":"...","narration":"..."},{"headline":"...","caption":"...","narration":"..."}],"character_comment":"...","youtube_title":"...","description":"...","x_post":"...","hashtags":["#ボートレース","#競艇","#BoatStrikers"]}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, instructions, input: JSON.stringify(input, null, 2), max_output_tokens: 1600 }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);
  const text = extractOutputText(payload);
  let parsed;
  try { parsed = JSON.parse(stripFence(text)); } catch { throw new Error("NEWSショートJSONの解析に失敗しました。"); }
  if (!Array.isArray(parsed?.segments) || parsed.segments.length !== 3) throw new Error("NEWSショートは3件必要です。");
  return { parsed, model };
}

export async function generateDailyNewsShort({ date = jstDate(), force = false } = {}) {
  const client = getClient();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日付形式が不正です。");

  if (!force) {
    const { data: existing, error: existingError } = await client
      .from("bs_news_short_drafts").select("id,short_date,status").eq("short_date", date).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { ok: true, skipped: true, reason: "already_exists", draft: existing };
  }

  const { start, end } = dayRange(date);
  const { data: candidates, error } = await client
    .from("bs_news_candidates")
    .select("id,collected_at,published_at,title,category,summary,source_name,source_url,importance,target_character,event_date,venue,race_no,event_type,verification_status,result_status,verified,verification_note,verification_evidence")
    .eq("verified", true)
    .eq("verification_status", "verified")
    .gte("collected_at", start)
    .lt("collected_at", end)
    .order("importance", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(60);
  if (error) throw error;

  const ranked = dedupeAndRank(candidates || []);
  if (ranked.length < 3) return { ok: false, skipped: true, reason: "not_enough_verified_news", found: ranked.length };

  const selected = ranked.slice(0, 3);
  const character = chooseCharacter(selected[0]);
  const facts = selected.map((item, index) => ({
    rank: index + 1,
    id: item.id,
    score: item.short_score,
    title: item.title,
    summary: item.summary,
    category: item.category,
    source_name: item.source_name,
    source_url: item.source_url,
    event_date: item.event_date,
    venue: item.venue,
    race_no: item.race_no,
    event_type: item.event_type,
    result_status: item.result_status,
    verification_note: item.verification_note,
    verification_evidence: item.verification_evidence,
  }));

  const { parsed, model } = await callAi({ date, character, verified_news: facts });
  const hook = "今日のボートNEWS、30秒で3本！";
  const characterComment = String(parsed.character_comment || "").trim();
  const segments = parsed.segments.map((segment, index) => ({
    rank: index + 1,
    news_id: selected[index].id,
    headline: String(segment.headline || "").trim(),
    caption: String(segment.caption || "").trim(),
    narration: String(segment.narration || "").trim(),
    score: selected[index].short_score,
  }));
  const narration = [hook, ...segments.map((x) => x.narration), characterComment, CTA].filter(Boolean).join(" ");
  const captions = [
    { start: 0, end: 2, type: "hook", text: hook },
    { start: 2, end: 9, type: "news", rank: 1, text: segments[0].caption },
    { start: 9, end: 16, type: "news", rank: 2, text: segments[1].caption },
    { start: 16, end: 23, type: "news", rank: 3, text: segments[2].caption },
    { start: 23, end: 28, type: "character", character, text: characterComment },
    { start: 28, end: 33, type: "cta", text: CTA },
  ];
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).filter(Boolean).slice(0, 3) : ["#ボートレース", "#競艇", "#BoatStrikers"];
  const row = {
    short_date: date,
    status: "draft",
    character,
    title: `今日のBOAT NEWS 3｜${date.replaceAll("-", "/")}`,
    hook,
    narration,
    selected_news: facts,
    segments,
    captions,
    character_comment: characterComment,
    cta: CTA,
    youtube_title: String(parsed.youtube_title || "").trim(),
    description: String(parsed.description || "").trim(),
    x_post: String(parsed.x_post || "").trim().slice(0, 140),
    hashtags,
    ai_model: model,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await client
    .from("bs_news_short_drafts")
    .upsert(row, { onConflict: "short_date" })
    .select("*")
    .single();
  if (saveError) throw saveError;

  await client.from("bs_news_sync_logs").insert({
    run_type: "news_short_generate",
    source: "verified_news",
    found_count: candidates?.length || 0,
    error_count: 0,
  });

  return { ok: true, skipped: false, draft: saved };
}

export { jstDate };

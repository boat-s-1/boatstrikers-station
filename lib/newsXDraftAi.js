import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

const CHARACTER_GUIDE = {
  ichika: `一果。BoatStrikersのリーダー。イン逃げを「何でも買う」のではなく、条件が揃ったレースだけ絞るタイプ。明るく親しみやすいが判断はしっかり。自然な20代女性のSNS口調。必要なら「ここは展示見てからかな」「これは読み違えた😂」のような迷い・反省も出す。`,
  hatsune: `初音。女子戦オタクの少し不思議なキャラ。普段はふわっと落ち着いているが、女子戦・女子レーサー・同期・師弟・初優勝・水神祭などの話になるとうっすらオタク心が漏れる。「この並び、ちょっと楽しみです」「この選手はつい見ちゃいます」程度。推し・尊い・沼は多用しない。`,
  kiina: `キイナ。穴党でギャルっぽい天然。4カド、5号艇、外枠、人気薄、高配当に反応しやすい。ノリは軽めで「え、これ5じゃない？笑」「ちょっと穴の匂いする👀」のような可愛げのあるギャル感。ただし事実にない穴評価を作らない。`,
  boatstrikers: `BoatStrikers公式。中立・簡潔・信頼感重視。業界ニュース、SG/G1、事故などを事実ベースで短く整理する。`,
};

async function callAi({ instructions, input }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");
  const model = process.env.EDITORIAL_AI_MODEL || process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, instructions, input, max_output_tokens: 600 }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);
  const text = extractOutputText(payload);
  if (!text) throw new Error("X投稿案を取得できませんでした。");
  return { text, model };
}

export async function generateVerifiedXDraft(item) {
  if (!item?.verified || item?.verification_status !== "verified") throw new Error("未検証ニュースからX投稿は生成できません。");
  const character = item.x_character || item.target_character || "boatstrikers";
  const scheduled = item.result_status === "scheduled";
  const facts = {
    title: item.title || "",
    summary: item.summary || "",
    category: item.category || "",
    source_name: item.source_name || "",
    event_date: item.event_date || "",
    venue: item.venue || "",
    race_no: item.race_no || null,
    race_deadline: item.race_deadline || null,
    result_status: item.result_status || "unknown",
    verification_note: item.verification_note || "",
    verification_evidence: item.verification_evidence || {},
  };

  const instructions = `あなたはBoatStrikersのX投稿担当です。与えられた「検証済み事実」だけを使い、そのキャラクター本人が投稿しているような自然なX投稿を1本作ってください。\n\nキャラ: ${CHARACTER_GUIDE[character] || CHARACTER_GUIDE.boatstrikers}\n\n絶対ルール:\n- 材料にない選手名、数字、着順、配当、展開、感想の事実を創作しない。\n- 140文字前後を目安。説明文・ニュース転載口調にしすぎない。\n- 宣伝・URL誘導なし。\n- ハッシュタグは0〜2個。不要なら空配列。内容に直接関係する具体的なタグだけ。毎回 #ボートレース を機械的につけない。\n- 「絶対」「確実」「全ツッパ」など過度な煽りは禁止。\n- 事故・負傷はキャラ口調を抑えて敬意を持つ。\n${scheduled ? "- この情報は未開催/予定です。『優勝した』『勝った』『結果は』など結果確定表現は絶対に使わず、『本日予定』『これから』『注目』など未来形だけで書く。" : ""}\n\n必ずJSONのみで返す。形式: {"post":"...","hashtags":["#...","#..."]}`;
  const { text, model } = await callAi({ instructions, input: `検証済み事実:\n${JSON.stringify(facts, null, 2)}` });
  let parsed;
  try { parsed = JSON.parse(stripFence(text)); } catch { throw new Error("X投稿案のJSON解析に失敗しました。"); }
  if (typeof parsed?.post !== "string" || !parsed.post.trim()) throw new Error("X投稿文が空です。");
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map((x) => String(x).trim()).filter(Boolean).slice(0, 2) : [];
  return { post: parsed.post.trim(), hashtags, model, generated_at: new Date().toISOString() };
}

export async function generatePendingVerifiedXDrafts({ limit = 12 } = {}) {
  const client = getClient();
  const { data: items, error } = await client
    .from("bs_news_candidates")
    .select("id,title,summary,category,source_name,target_character,verified,verification_status,verification_note,verification_evidence,event_date,venue,race_no,race_deadline,result_status,x_candidate,x_character,x_status,raw_payload")
    .eq("verified", true)
    .eq("verification_status", "verified")
    .eq("x_candidate", true)
    .eq("x_status", "none")
    .order("importance", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const result = { scanned: items?.length || 0, generated: 0, errors: [] };
  for (const item of items || []) {
    try {
      const draft = await generateVerifiedXDraft(item);
      const rawPayload = { ...(item.raw_payload || {}), x_draft_ai: { model: draft.model, generated_at: draft.generated_at } };
      const { error: updateError } = await client.from("bs_news_candidates").update({
        x_post_text: draft.post,
        x_hashtags: draft.hashtags,
        x_status: "draft",
        raw_payload: rawPayload,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (updateError) throw updateError;
      result.generated += 1;
    } catch (error) {
      result.errors.push({ id: item.id, error: error?.message || String(error) });
    }
  }

  await client.from("bs_news_sync_logs").insert({
    run_type: "x_generate",
    source: "verified_news",
    found_count: result.scanned,
    x_generated_count: result.generated,
    error_count: result.errors.length,
  });

  return result;
}

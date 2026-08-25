import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
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

function parseJson(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI出力をJSONとして解析できませんでした。");
  }
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function promptFor(type, duration) {
  if (type === "weekly_news") {
    return "初音が担当する『週間ヴィーナスNEWS』の動画台本を作る。3〜5分程度を想定。重要度の高いニュースを4〜6件に整理し、同じ話題の重複を避ける。事実にない選手名・着順・数値・評価は創作しない。冒頭、各ニュース、次に注目する点、締めの順で自然なニュース番組にする。";
  }
  return `初音が担当する『今日のヴィーナスNEWS』の縦型ショート台本を作る。${duration}秒程度。最重要ニュースを中心に、必要なら2〜3件まで。冒頭2秒で内容が分かるフックを置き、短文でテンポよくする。事実にない選手名・着順・数値・評価は創作しない。`;
}

export async function generateHatsuneVideoDraft({
  videoType,
  articleIds,
  targetDate,
  periodStart,
  periodEnd,
  durationSeconds = 45,
}) {
  if (!["daily_short", "weekly_news"].includes(videoType)) {
    throw new Error("動画タイプが正しくありません。");
  }

  const duration = [30, 45, 60].includes(Number(durationSeconds)) ? Number(durationSeconds) : 45;
  if (videoType === "daily_short" && !isDate(targetDate)) throw new Error("対象日を指定してください。");
  if (videoType === "weekly_news") {
    if (!isDate(periodStart) || !isDate(periodEnd)) throw new Error("週間NEWSの期間を指定してください。");
    if (periodStart > periodEnd) throw new Error("期間開始日は期間終了日以前にしてください。");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");

  const ids = [...new Set((articleIds || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))];
  if (!ids.length) throw new Error("元ニュースを1件以上選択してください。");
  const maxItems = videoType === "weekly_news" ? 12 : 6;
  if (ids.length > maxItems) throw new Error(`元ニュースは最大${maxItems}件まで選択できます。`);

  const supabase = getAdminSupabase();
  const { data: articles, error } = await supabase
    .from("hatsune_news")
    .select("id,title,summary,article_body,category,source_type,source_name,source_url,place,published_at,is_published")
    .in("id", ids)
    .eq("is_published", true)
    .order("published_at", { ascending: true });
  if (error) throw error;
  if (!articles?.length) throw new Error("対象ニュースが見つかりません。");

  const model = process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const facts = articles.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    body: String(a.article_body || "").slice(0, 1800),
    category: a.category,
    place: a.place,
    source_name: a.source_name,
    published_at: a.published_at,
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: `${promptFor(videoType, duration)}\n出力はJSONのみ。キーは title, script, captions, youtube_title, youtube_description, x_text, hashtags。captionsは字幕用の短文文字列配列。hashtagsは#なしの文字列配列。X本文は140文字以内を目安。元情報の出典表現を長く転載しない。`,
      input: JSON.stringify(
        {
          video_type: videoType,
          target_date: targetDate,
          period_start: periodStart,
          period_end: periodEnd,
          facts,
        },
        null,
        2,
      ),
      max_output_tokens: videoType === "weekly_news" ? 2600 : 1200,
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);
  const generated = parseJson(extractOutputText(payload));
  if (!generated?.script) throw new Error("AI台本を取得できませんでした。");

  const row = {
    video_type: videoType,
    target_date: videoType === "daily_short" ? targetDate : null,
    period_start: videoType === "weekly_news" ? periodStart : null,
    period_end: videoType === "weekly_news" ? periodEnd : null,
    source_article_ids: articles.map((a) => a.id),
    title: generated.title || "初音のヴィーナスNEWS",
    script: generated.script,
    caption_json: Array.isArray(generated.captions)
      ? generated.captions.map((x) => ({ text: String(x).trim() })).filter((x) => x.text)
      : [],
    youtube_title: generated.youtube_title || generated.title || "初音のヴィーナスNEWS",
    youtube_description: generated.youtube_description || "",
    x_text: generated.x_text || "",
    hashtags: Array.isArray(generated.hashtags)
      ? generated.hashtags.map((x) => String(x).replace(/^#/, "").trim()).filter(Boolean)
      : [],
    status: "draft",
    duration_seconds: videoType === "daily_short" ? duration : null,
    ai_model: model,
    ai_generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error: saveError } = await supabase
    .from("hatsune_news_videos")
    .insert(row)
    .select("*")
    .single();
  if (saveError) throw saveError;
  return data;
}

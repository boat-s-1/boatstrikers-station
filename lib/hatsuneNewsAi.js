import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function categoryGuidance(category) {
  switch (category) {
    case "result": return "レース結果の事実を中心に、何が起きたかを最初に明確にする。";
    case "women": return "女子戦・シリーズ全体の位置づけと、今後チェックしたい流れを簡潔にまとめる。";
    case "suijinsai": return "レーサーの節目と、そのニュースの意味が分かるようにまとめる。";
    case "win": return "優勝・優出の事実、節目、今節で確認できるポイントを整理する。";
    case "grade": return "SG・G1などグレードレースの結果や注目点を初心者にも分かる言葉で整理する。";
    case "motor": return "モーター数値や機力情報を中心に、次に見るべきポイントを整理する。";
    case "tomorrow": return "翌日の注目理由と、進入・モーター・展示など確認したい項目を整理する。";
    default: return "ボートレースニュースとして、誰が・どこで・何をしたか、なぜ注目なのかを簡潔に整理する。";
  }
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

function parseAiJson(text) {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI出力JSONを解析できませんでした。");
  }
}

export async function generateHatsuneArticleBody(item) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");

  const model = process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const facts = {
    title: item.title || "",
    source_summary: item.summary || "",
    category: item.category || "topic",
    place: item.place || "",
    source_type: item.source_type || "news",
    source_name: item.source_name || "",
    published_at: item.published_at || "",
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions:
        "あなたはBoatStrikers NEWSの編集者です。与えられた事実だけを使ってニュースを要約してください。元記事の文章を長く引用せず、自分の言葉で整理します。事実にない選手名、着順、決まり手、数値、コメント、評価、展開を推測・創作してはいけません。出力は必ずJSONのみで、キーは summary と article_body の2つです。summaryは100〜200文字程度で、最初の1文で何が起きたニュースか分かるようにしてください。『記事を確認しました』『元記事を転載せず』『詳しくは出典元へ』のようなサイト運営上の説明はsummaryにもarticle_bodyにも入れないでください。article_bodyは300〜550文字程度、2〜4段落で、ニュースの事実→注目点→今後確認したい点の順に読みやすく整理してください。情報が不足している場合は、確認できる事実だけで短くまとめてください。Markdown見出しや箇条書きは不要です。",
      input: `以下の公開情報からBoatStrikers NEWS用の要約と本文を作成してください。\n\n事実データ:\n${JSON.stringify(facts, null, 2)}\n\n編集方針:\n${categoryGuidance(item.category)}`,
      max_output_tokens: 1000,
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);

  const parsed = parseAiJson(extractOutputText(payload));
  const summary = String(parsed?.summary || "").replace(/\s+/g, " ").trim();
  const articleBody = String(parsed?.article_body || "").trim();
  if (!summary || !articleBody) throw new Error("AI要約または記事本文を取得できませんでした。");

  return { summary, text: articleBody, model };
}

export async function generateAndSaveHatsuneArticle(id, { force = false } = {}) {
  const supabase = getAdminSupabase();
  const { data: item, error: fetchError } = await supabase
    .from("hatsune_news")
    .select("id,title,summary,category,source_type,source_name,source_url,image_url,place,published_at,article_body,article_body_source")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!item) throw new Error("対象ニュースが見つかりません。");
  if (!force && item.article_body_source === "manual") return { skipped: true, reason: "manual", item };

  try {
    const generated = await generateHatsuneArticleBody(item);
    const { data, error } = await supabase
      .from("hatsune_news")
      .update({
        summary: generated.summary,
        article_body: generated.text,
        article_body_source: "ai",
        article_ai_model: generated.model,
        article_ai_generated_at: new Date().toISOString(),
        article_ai_error: null,
      })
      .eq("id", id)
      .select("id,title,summary,article_body,article_body_source,article_ai_model,article_ai_generated_at")
      .single();

    if (error) throw error;
    return { skipped: false, item: data };
  } catch (error) {
    await supabase.from("hatsune_news").update({ article_ai_error: error?.message || String(error) }).eq("id", id);
    throw error;
  }
}

export async function generatePendingHatsuneArticles({ limit = 5 } = {}) {
  const supabase = getAdminSupabase();
  const wanted = Math.max(1, Math.min(Number(limit) || 5, 10));
  const { data, error } = await supabase
    .from("hatsune_news")
    .select("id,article_body_source")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(Math.max(20, wanted * 5));

  if (error) throw error;
  const pending = (data || []).filter((row) => !["manual", "ai"].includes(row.article_body_source)).slice(0, wanted);

  const results = [];
  for (const row of pending) {
    try {
      results.push({ id: row.id, ...(await generateAndSaveHatsuneArticle(row.id)) });
    } catch (error) {
      results.push({ id: row.id, error: error?.message || String(error) });
    }
  }
  return results;
}

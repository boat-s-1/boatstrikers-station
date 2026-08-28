import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function categoryGuidance(category) {
  switch (category) {
    case "result":
      return "レース結果の事実を中心に、読者と一緒に振り返るようなやさしい語り口で、次走で確認したいポイントまで簡潔にまとめる。";
    case "women":
      return "女子戦・シリーズ全体の位置づけをやわらかく紹介し、今後チェックしたい流れを読者に話しかけるようにまとめる。";
    case "suijinsai":
      return "レーサーの節目を明るく温かく伝え、これからの走りも応援したくなるような文章にする。";
    case "win":
      return "優勝・優出の事実を中心に、今節で光ったポイントをやさしく整理し、祝福感のある文章にする。";
    case "grade":
      return "級別・昇格などの意味を初心者にも分かる言葉で説明し、今後の出走で注目したい点をやわらかく整理する。";
    case "motor":
      return "モーター数値を中心に、難しくなりすぎないよう噛み砕き、展示・実戦気配と合わせて見たいポイントをやさしく整理する。";
    case "tomorrow":
      return "翌日の注目理由をワクワク感のあるやわらかい文章でまとめ、進入・モーター・展示など明日チェックしたい項目を自然に案内する。";
    default:
      return "女子ボートレースを見るうえで大切な事実を、親しみやすくやさしい言葉で整理し、次に確認したいポイントを案内する。";
  }
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export async function generateHatsuneArticleBody(item) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");

  const model = process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const facts = {
    title: item.title || "",
    summary: item.summary || "",
    category: item.category || "topic",
    place: item.place || "",
    source_type: item.source_type || "news",
    source_name: item.source_name || "",
    published_at: item.published_at || "",
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions:
        "あなたはBoatStrikersの女子ボートNEWS担当『初音』です。女子ボートレースが好きな女の子が、読者にやさしく話しかけるような記事本文を作成してください。文体は親しみやすく、明るく、少し可愛らしくしてください。ただし幼すぎる表現、過度なぶりっ子表現、ギャル口調、煽り表現は避け、ニュースとしての信頼感を残してください。『〜ですね』『〜したいところです』『〜もチェックしておきたいですね』『〜かもしれません』などの自然な語りかけを適度に使って構いません。絵文字や記号は1記事につき0〜2個までにし、✨、♡、🌸などを内容に合う場合だけ控えめに使用してください。毎段落に絵文字を入れたり、同じ語尾を連続させたりしないでください。与えられた事実だけを使い、事実にない選手名、着順、決まり手、数値、コメント、評価、展開を推測・創作してはいけません。確認できない情報は『今回の情報では確認できませんでした』などと正直に扱ってください。元記事の表現を長く引用せず、自分の言葉で要約してください。Markdown見出しや箇条書きは使わず、3〜5段落、350〜650文字程度を目安にしてください。最終段落は、初音NEWSらしく『次にどこを見ると楽しめるか』が自然に伝わる前向きな一文で締めてください。",
      input: `以下の情報から記事本文を作成してください。\n\n事実データ:\n${JSON.stringify(facts, null, 2)}\n\n編集方針:\n${categoryGuidance(item.category)}`,
      max_output_tokens: 900,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI API error: ${response.status}`;
    throw new Error(message);
  }

  const text = extractOutputText(payload);
  if (!text) throw new Error("AI記事本文を取得できませんでした。");

  return { text, model };
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
  if (!force && item.article_body_source === "manual") {
    return { skipped: true, reason: "manual", item };
  }

  try {
    const generated = await generateHatsuneArticleBody(item);
    const { data, error } = await supabase
      .from("hatsune_news")
      .update({
        article_body: generated.text,
        article_body_source: "ai",
        article_ai_model: generated.model,
        article_ai_generated_at: new Date().toISOString(),
        article_ai_error: null,
      })
      .eq("id", id)
      .select("id,title,article_body,article_body_source,article_ai_model,article_ai_generated_at")
      .single();

    if (error) throw error;
    return { skipped: false, item: data };
  } catch (error) {
    await supabase
      .from("hatsune_news")
      .update({ article_ai_error: error?.message || String(error) })
      .eq("id", id);
    throw error;
  }
}

export async function generatePendingHatsuneArticles({ limit = 5 } = {}) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("hatsune_news")
    .select("id")
    .eq("is_published", true)
    .neq("article_body_source", "manual")
    .neq("article_body_source", "ai")
    .order("published_at", { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit) || 5, 10)));

  if (error) throw error;

  const results = [];
  for (const row of data || []) {
    try {
      results.push({ id: row.id, ...(await generateAndSaveHatsuneArticle(row.id)) });
    } catch (error) {
      results.push({ id: row.id, error: error?.message || String(error) });
    }
  }
  return results;
}

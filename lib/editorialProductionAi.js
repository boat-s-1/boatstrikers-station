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
  ichika: "一果。イン逃げ・1コース視点が得意。落ち着いて分かりやすく、データや狙い目につながる視点を添える。",
  hatsune: "初音。女子戦・女子レーサー担当。やさしく親しみやすいが、ニュースとしての信頼感を保つ。",
  kiina: "キイナ。5号艇・4→5・穴狙い担当。ワクワク感は出すが、煽りすぎず事実ベース。",
  boatstrikers: "BoatStrikers編集部。中立で分かりやすいニュース編集。ブランド全体の公式トーン。",
};

async function callEditorialAi({ instructions, input, maxOutputTokens = 2600 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");

  const model = process.env.EDITORIAL_AI_MODEL || process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, instructions, input, max_output_tokens: maxOutputTokens }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);

  const text = extractOutputText(payload);
  if (!text) throw new Error("AI制作素材を取得できませんでした。");
  return { text, model };
}

export async function generateEditorialMaterials(item) {
  const character = item.target_character || "boatstrikers";
  const facts = {
    title: item.title || "",
    summary: item.summary || "",
    category: item.category || "",
    source_name: item.source_name || "",
    source_url: item.source_url || "",
    published_at: item.published_at || "",
    importance: item.importance || 3,
    character,
  };

  const instructions = `あなたはBoatStrikers AI編集部です。与えられた事実だけを使い、1件のニュースから複数媒体の下書きを作成してください。事実にない選手名、数値、着順、発言、展開、評価を創作しないでください。元記事の長い引用は禁止です。担当キャラのトーン: ${CHARACTER_GUIDE[character] || CHARACTER_GUIDE.boatstrikers}\n\n必ずJSONのみで返してください。キーは list_headline, x_post, shorts_script, note_title, note_body, news_title, news_body。\nlist_headline: ニュース一覧専用の短い見出し。原則14〜28文字程度。最重要の固有名詞・結果・変化を優先し、結論を先にする。句読点は最小限。煽りすぎない。「〜について」「〜を発表」のような冗長表現を避ける。例:「大山千広、今年3回目V」「○○選手がA1昇格へ」。\nx_post: X投稿用。140文字以内を目安。URLは本文に含めなくてよい。\nshorts_script: 30〜45秒程度の読み上げ台本。冒頭フック→事実→注目ポイント→締め。\nnote_title: note向け見出し。\nnote_body: 500〜900文字程度。見出しを2〜4個使ってよい。事実とBoatStrikers視点を分けて書く。\nnews_title: サイトニュース向け正式タイトル。検索や記事詳細で意味が伝わる情報量を保つ。\nnews_body: 350〜650文字程度。ニュースとして読みやすく3〜5段落。`;

  const { text, model } = await callEditorialAi({
    instructions,
    input: `事実データ:\n${JSON.stringify(facts, null, 2)}`,
  });

  let parsed;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new Error("AI制作素材のJSON解析に失敗しました。");
  }

  const required = ["list_headline", "x_post", "shorts_script", "note_title", "note_body", "news_title", "news_body"];
  for (const key of required) {
    if (typeof parsed?.[key] !== "string" || !parsed[key].trim()) throw new Error(`AI制作素材 ${key} が空です。`);
  }

  return {
    list_headline: parsed.list_headline.trim(),
    x_post: parsed.x_post.trim(),
    shorts_script: parsed.shorts_script.trim(),
    note_title: parsed.note_title.trim(),
    note_body: parsed.note_body.trim(),
    news_title: parsed.news_title.trim(),
    news_body: parsed.news_body.trim(),
    model,
    generated_at: new Date().toISOString(),
  };
}

export async function generateHatsuneDailyDigest(items, dateLabel) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("初音NEWSに使うニュースが選択されていません。");

  const facts = items.map((item, index) => ({
    no: index + 1,
    title: item.title || "",
    summary: item.summary || "",
    category: item.category || "",
    source_name: item.source_name || "",
    source_url: item.source_url || "",
    published_at: item.published_at || item.collected_at || "",
    importance: item.importance || 3,
  }));

  const instructions = `あなたはBoatStrikersの女子ボートNEWS担当「初音」です。複数の採用済みニュースを材料に、その日の「初音のヴィーナスNEWS」1本分の原稿を作ってください。\n\n最重要ルール:\n- 与えられた事実だけを使う。未確認の選手名、数値、着順、発言、展開、評価は創作しない。\n- 同じ話題を重複させない。重要度の高い話題を先に扱う。\n- 元記事を長く引用せず、自分の言葉で要約する。\n- 初音らしく親しみやすく、やさしい語り口。ただしニュースとして信頼感を保つ。\n- 過度な煽り、断定的な予想、ギャル口調は避ける。\n\n必ずJSONのみで返してください。キーは title, summary, article_body, shorts_script, x_post。\ntitle: 「${dateLabel} 初音のヴィーナスNEWS」のような日次まとめタイトル。\nsummary: 80〜140文字程度。\narticle_body: 900〜1500文字程度。冒頭→注目ニュースを2〜5本→最後に今日/次走で見たいポイント。見出しを使ってよい。\nshorts_script: 45〜60秒程度の「今日の女子ボートNEWS」読み上げ台本。\nx_post: 140文字以内を目安に、今日の主な話題を2〜3件だけ紹介。URLは不要。`;

  const { text, model } = await callEditorialAi({
    instructions,
    input: `対象日: ${dateLabel}\n採用済みニュース:\n${JSON.stringify(facts, null, 2)}`,
    maxOutputTokens: 3600,
  });

  let parsed;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new Error("初音デイリーNEWSのJSON解析に失敗しました。");
  }

  for (const key of ["title", "summary", "article_body", "shorts_script", "x_post"]) {
    if (typeof parsed?.[key] !== "string" || !parsed[key].trim()) throw new Error(`初音デイリーNEWS ${key} が空です。`);
  }

  return {
    title: parsed.title.trim(),
    summary: parsed.summary.trim(),
    article_body: parsed.article_body.trim(),
    shorts_script: parsed.shorts_script.trim(),
    x_post: parsed.x_post.trim(),
    model,
    generated_at: new Date().toISOString(),
    source_ids: items.map((item) => Number(item.id)).filter(Number.isFinite),
  };
}

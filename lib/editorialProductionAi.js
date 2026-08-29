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

export async function generateEditorialMaterials(item) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");

  const model = process.env.EDITORIAL_AI_MODEL || process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
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

  const instructions = `あなたはBoatStrikers AI編集部です。与えられた事実だけを使い、1件のニュースから複数媒体の下書きを作成してください。事実にない選手名、数値、着順、発言、展開、評価を創作しないでください。元記事の長い引用は禁止です。担当キャラのトーン: ${CHARACTER_GUIDE[character] || CHARACTER_GUIDE.boatstrikers}\n\n必ずJSONのみで返してください。キーは x_post, shorts_script, note_title, note_body, news_title, news_body。\nx_post: X投稿用。140文字以内を目安。URLは本文に含めなくてよい。\nshorts_script: 30〜45秒程度の読み上げ台本。冒頭フック→事実→注目ポイント→締め。\nnote_title: note向け見出し。\nnote_body: 500〜900文字程度。見出しを2〜4個使ってよい。事実とBoatStrikers視点を分けて書く。\nnews_title: サイトニュース向けタイトル。\nnews_body: 350〜650文字程度。ニュースとして読みやすく3〜5段落。`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions,
      input: `事実データ:\n${JSON.stringify(facts, null, 2)}`,
      max_output_tokens: 2600,
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);

  const text = extractOutputText(payload);
  if (!text) throw new Error("AI制作素材を取得できませんでした。");

  let parsed;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new Error("AI制作素材のJSON解析に失敗しました。");
  }

  const required = ["x_post", "shorts_script", "note_title", "note_body", "news_title", "news_body"];
  for (const key of required) {
    if (typeof parsed?.[key] !== "string" || !parsed[key].trim()) throw new Error(`AI制作素材 ${key} が空です。`);
  }

  return {
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

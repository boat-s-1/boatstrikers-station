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

export async function generateMediaEditorial(item) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");
  const model = process.env.EDITORIAL_AI_MODEL || process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";

  const instructions = `あなたはBoatStrikers AI編集部のMEDIA担当です。ボートレース場の公式YouTube動画を紹介する独自記事素材を作ります。\n\n最重要ルール:\n- 入力にある正式タイトル、開催場、女子関連フラグ、公開日時、URLだけを事実として使う。\n- 動画を実際に視聴したと断定しない。入力にない発言内容、出演者、結果、数値、展開を創作しない。\n- 公式タイトルや概要文の長いコピーは禁止。BoatStrikers独自の整理・紹介にする。\n- SEO目的の不自然なキーワード羅列や煽り見出しは禁止。\n\nJSONのみで返してください。キーは short_headline, intro, highlights, editor_note。\nshort_headline: 14〜28文字程度。一覧で一目で内容が分かる短見出し。\nintro: 140〜240文字程度。公式動画が何を扱う動画か、入力から安全に分かる範囲で独自に紹介。\nhighlights: 3要素の文字列配列。各25〜55文字程度。見る前に確認したい観点を3つ。\neditor_note: 100〜180文字程度。BoatStrikers編集部として、公式一次情報として見る価値や関連する観点を説明。女子関連なら初音ページとの関連にも触れてよい。`;

  const input = JSON.stringify({
    place: item.place,
    official_title: item.title,
    official_url: item.url,
    published_at: item.publishedAt,
    women_related: Boolean(item.womenRelated),
  }, null, 2);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, instructions, input: `公式動画データ:\n${input}`, max_output_tokens: 1100 }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);
  const text = extractOutputText(payload);
  if (!text) throw new Error("MEDIA AI素材を取得できませんでした。");

  let parsed;
  try { parsed = JSON.parse(stripFence(text)); } catch { throw new Error("MEDIA AI素材のJSON解析に失敗しました。"); }
  if (!parsed?.short_headline || !parsed?.intro || !parsed?.editor_note || !Array.isArray(parsed?.highlights) || parsed.highlights.length < 3) {
    throw new Error("MEDIA AI素材の必須項目が不足しています。");
  }

  return {
    short_headline: String(parsed.short_headline).trim(),
    intro: String(parsed.intro).trim(),
    highlights: parsed.highlights.slice(0, 3).map((x) => String(x).trim()).filter(Boolean),
    editor_note: String(parsed.editor_note).trim(),
    model,
    generated_at: new Date().toISOString(),
  };
}

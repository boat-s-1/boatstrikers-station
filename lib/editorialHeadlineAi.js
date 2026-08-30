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

function cleanHeadline(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^['\"「『]+|['\"」』]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
}

export async function generateEditorialListHeadline(item) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が未設定です。");

  const model = process.env.EDITORIAL_AI_MODEL || process.env.HATSUNE_NEWS_AI_MODEL || "gpt-5.6-luna";
  const instructions = `あなたはBoatStrikers NEWSの見出し編集者です。入力された事実だけを使い、スマホ一覧用の短い日本語見出しを1本だけ返してください。JSONや説明文は不要です。\n- 目標12〜22文字、最大28文字\n- 選手名、場名、結果、変化など重要な固有情報を優先\n- 媒体名、配信元名、【ボートレース】などの前置き、記事末尾の媒体表記は削除\n- R表記を重複させない\n- 日付は原則入れない\n- 煽り・推測・クリックベイト禁止\n例: 大山千広、三国で優勝 / 清水愛海、8連勝で優勝戦へ / 浜名湖12Rの結果 / 浜名湖女子戦、55号機に注目`;

  const input = JSON.stringify({
    title: item?.title || "",
    summary: item?.summary || "",
    category: item?.category || "",
    source_name: item?.source_name || "",
    published_at: item?.published_at || "",
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, instructions, input, max_output_tokens: 120 }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI API error: ${response.status}`);
  const headline = cleanHeadline(extractOutputText(payload));
  if (!headline) throw new Error("短見出しを生成できませんでした。");
  return { headline, model, generated_at: new Date().toISOString() };
}

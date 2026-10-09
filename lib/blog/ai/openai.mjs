// OpenAI Responses API with a strict JSON schema. fetch is injected so tests never reach the network.
export function outputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks = [];
  for (const item of payload?.output || []) for (const content of item?.content || []) {
    if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
  }
  return chunks.join("\n").trim();
}

export async function callOpenAIJson({ fetchImpl = fetch, apiKey, model, instructions, input, schema, schemaName,
  maxOutputTokens = 12000, timeoutMs = 180000 }) {
  if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY が未設定です。"), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response, payload;
  try {
    response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, instructions, input, max_output_tokens: maxOutputTokens, reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: schemaName, schema, strict: true } } }),
    });
    payload = await response.json();
  } catch (error) {
    throw Object.assign(new Error(error.name === "AbortError" ? "AIの応答が時間内に返りませんでした。" : "AIに接続できませんでした。"), { status: 502 });
  } finally { clearTimeout(timer); }
  if (!response.ok) throw Object.assign(new Error(`AIの呼び出しに失敗しました（${response.status}）。`), { status: 502 });
  if (payload?.status === "incomplete") throw Object.assign(new Error("AIの出力が途中で終了しました。"), { status: 502 });
  const text = outputText(payload);
  let data;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error("AIの出力をJSONとして読めませんでした。"), { status: 502 }); }
  return { data, model: typeof payload?.model === "string" ? payload.model : model };
}

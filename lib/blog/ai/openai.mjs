// OpenAI Responses API with a strict JSON schema. fetch is injected so tests never reach the network.
export function outputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks = [];
  for (const item of payload?.output || []) for (const content of item?.content || []) {
    if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
  }
  return chunks.join("\n").trim();
}

// PHASE 2: why a call failed, in words an operator can act on. The key is never part of any message.
export function failureKind(status) {
  if (status === 401) return "auth";            // key missing, wrong or revoked
  if (status === 402 || status === 429) return "quota"; // billing / quota / rate limit
  if (status === 403) return "forbidden";       // project or region not allowed
  if (status === 404 || status === 400) return "request"; // model or parameters not accepted
  if (status >= 500) return "upstream";
  return "unknown";
}
const KIND_MESSAGE = { auth: "認証に失敗しました（APIキーを確認してください）", quota: "利用上限・支払い・回数制限に達しています", forbidden: "このプロジェクトでは利用が許可されていません",
  request: "モデルまたはパラメーターが受け付けられませんでした", upstream: "OpenAI側でエラーが起きました", unknown: "AIの呼び出しに失敗しました" };

// usage: tokens reported by the API (null when absent); duration_ms: wall time of the call.
export function usageOf(payload) {
  const u = payload?.usage;
  if (!u) return null;
  const input = Number(u.input_tokens ?? u.prompt_tokens), output = Number(u.output_tokens ?? u.completion_tokens);
  return { input_tokens: Number.isFinite(input) ? input : null, output_tokens: Number.isFinite(output) ? output : null,
    reasoning_tokens: Number.isFinite(Number(u.output_tokens_details?.reasoning_tokens)) ? Number(u.output_tokens_details.reasoning_tokens) : null,
    total_tokens: Number.isFinite(Number(u.total_tokens)) ? Number(u.total_tokens) : (Number.isFinite(input) && Number.isFinite(output) ? input + output : null) };
}

// Estimated cost in USD from per-1M-token prices given by the operator (BLOG_AI_PRICE_INPUT_PER_1M / _OUTPUT_PER_1M).
// No built-in price list: without configured prices the cost is null (unknown), never a guess.
export function estimateCostUsd(usage, prices) {
  if (!usage || !prices || !Number.isFinite(prices.input) || !Number.isFinite(prices.output)) return null;
  if (!Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens)) return null;
  return Math.round(((usage.input_tokens * prices.input + usage.output_tokens * prices.output) / 1e6) * 1e6) / 1e6;
}

export async function callOpenAIJson({ fetchImpl = fetch, apiKey, model, instructions, input, schema, schemaName,
  maxOutputTokens = 12000, timeoutMs = 90000, now = () => Date.now(), onUsage = null }) {
  // onUsage({ model, usage, duration_ms, ok, kind }) is called once per call, success or failure, for cost/time records.
  const report = info => { try { onUsage?.(info); } catch { /* recording never breaks the call */ } };
  if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY が未設定です。"), { status: 503, kind: "auth" });
  const started = now();
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
    const kind = error.name === "AbortError" ? "timeout" : "network";
    report({ model, usage: null, duration_ms: now() - started, ok: false, kind });
    throw Object.assign(new Error(kind === "timeout" ? "AIの応答が時間内に返りませんでした。" : "AIに接続できませんでした（通信が許可されていない可能性があります）。"),
      { status: 502, kind, duration_ms: now() - started });
  } finally { clearTimeout(timer); }
  const duration_ms = now() - started, usage = usageOf(payload);
  if (!response.ok) {
    const kind = failureKind(response.status);
    report({ model, usage, duration_ms, ok: false, kind, upstream_status: response.status });
    throw Object.assign(new Error(`AIの呼び出しに失敗しました（${response.status}：${KIND_MESSAGE[kind]}）。`), { status: 502, kind, upstream_status: response.status, duration_ms });
  }
  const servedModel = typeof payload?.model === "string" ? payload.model : model;
  if (payload?.status === "incomplete") { report({ model: servedModel, usage, duration_ms, ok: false, kind: "incomplete" }); throw Object.assign(new Error("AIの出力が途中で終了しました。"), { status: 502, kind: "incomplete", usage, duration_ms }); }
  const text = outputText(payload);
  let data;
  try { data = JSON.parse(text); } catch {
    report({ model: servedModel, usage, duration_ms, ok: false, kind: "invalid_output" });
    throw Object.assign(new Error("AIの出力をJSONとして読めませんでした。"), { status: 502, kind: "invalid_output", usage, duration_ms });
  }
  report({ model: servedModel, usage, duration_ms, ok: true, kind: null });
  return { data, model: servedModel };
}

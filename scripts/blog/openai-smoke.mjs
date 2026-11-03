// PHASE 2: smallest possible OpenAI check before any article generation.
// ONE call, tiny strict-JSON answer, max_output_tokens 1000 (the floor of BLOG_AI_MAX_OUTPUT_TOKENS), 30 s timeout,
// NO retry. Prints status, model, tokens, time and estimated cost (when prices are configured). The key is never printed.
//   OPENAI_API_KEY=… [BLOG_AI_MODEL=…] [BLOG_AI_PRICE_INPUT_PER_1M=… BLOG_AI_PRICE_OUTPUT_PER_1M=…] node scripts/blog/openai-smoke.mjs
// Exit codes: 0 ok, 2 no key, 3 network not allowed / timeout, 4 auth, 5 billing/quota, 6 other.
import { aiConfig } from "../../lib/blog/ai/config.mjs";
import { callOpenAIJson, estimateCostUsd } from "../../lib/blog/ai/openai.mjs";

const SCHEMA = { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } };
const EXIT = { auth: 4, quota: 5, network: 3, timeout: 3 };

export async function smoke({ env = process.env, fetchImpl = fetch } = {}) {
  const config = aiConfig(env);
  if (!config.apiKey) return { ok: false, kind: "no_key", exit: 2, message: "OPENAI_API_KEY が設定されていません。" };
  let info = null;
  try {
    const { data, model } = await callOpenAIJson({ fetchImpl, apiKey: config.apiKey, model: config.model, instructions: "Answer with {\"ok\": true}.",
      input: "ping", schema: SCHEMA, schemaName: "smoke", maxOutputTokens: 1000, timeoutMs: 30000, onUsage: i => { info = i; } });
    return { ok: data?.ok === true, kind: null, exit: data?.ok === true ? 0 : 6, model, usage: info?.usage ?? null, duration_ms: info?.duration_ms ?? null,
      estimated_cost_usd: estimateCostUsd(info?.usage, config.prices) };
  } catch (error) {
    return { ok: false, kind: error.kind || "unknown", exit: EXIT[error.kind] ?? 6, message: String(error.message), upstream_status: error.upstream_status ?? null,
      model: config.model, duration_ms: error.duration_ms ?? null };
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const result = await smoke();
  console.log(JSON.stringify(result));
  process.exit(result.exit);
}

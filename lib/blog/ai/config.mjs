// AI drafting is off unless explicitly enabled. Nothing in lib/blog/ai ever publishes an article.
export const PROMPT_VERSION = "blog-ai-v14";
export const DEFAULT_MODEL = "gpt-5.6-luna"; // same default as the existing editorial generators

const intIn = (value, min, max, fallback) => { const n = Number.parseInt(value ?? "", 10); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback; };
const price = value => { const n = Number(value); return value !== undefined && value !== "" && Number.isFinite(n) && n >= 0 ? n : null; };

// PHASE 2 spending limits (small by default; unlimited retries are impossible):
//   BLOG_AI_MAX_CALLS_PER_DAY  AI calls per JST day for the daily cycle (default 5 = first draft + 2 regenerations + 2 restarts; max 20)
//   BLOG_AI_MAX_OUTPUT_TOKENS  per call (default 12000, the previous fixed value; 1000–12000)
//   BLOG_AI_PRICE_INPUT_PER_1M / BLOG_AI_PRICE_OUTPUT_PER_1M  USD per 1M tokens, for the cost estimate only. No built-in price
//   list: when unset the estimated cost is recorded as unknown.
export const MAX_CALLS_PER_DAY_DEFAULT = 5;

export function aiConfig(env = process.env) {
  const input = price(env.BLOG_AI_PRICE_INPUT_PER_1M), output = price(env.BLOG_AI_PRICE_OUTPUT_PER_1M);
  return {
    enabled: env.BLOG_AI_DRAFTS_ENABLED === "true",
    apiKey: env.OPENAI_API_KEY || "",
    model: env.BLOG_AI_MODEL || env.EDITORIAL_AI_MODEL || env.HATSUNE_NEWS_AI_MODEL || DEFAULT_MODEL,
    maxOutputTokens: intIn(env.BLOG_AI_MAX_OUTPUT_TOKENS, 1000, 12000, 12000),
    maxCallsPerDay: intIn(env.BLOG_AI_MAX_CALLS_PER_DAY, 1, 20, MAX_CALLS_PER_DAY_DEFAULT),
    prices: input !== null && output !== null ? { input, output } : null,
  };
}

export function requireAiEnabled(env = process.env) {
  const config = aiConfig(env);
  if (!config.enabled) throw Object.assign(new Error("AI下書き機能はまだ有効になっていません。"), { status: 503 });
  return config;
}

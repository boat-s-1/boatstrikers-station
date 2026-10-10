// AI drafting is off unless explicitly enabled. Nothing in lib/blog/ai ever publishes an article.
export const PROMPT_VERSION = "blog-ai-v4";
export const DEFAULT_MODEL = "gpt-5.6-luna"; // same default as the existing editorial generators

export function aiConfig(env = process.env) {
  return {
    enabled: env.BLOG_AI_DRAFTS_ENABLED === "true",
    apiKey: env.OPENAI_API_KEY || "",
    model: env.BLOG_AI_MODEL || env.EDITORIAL_AI_MODEL || env.HATSUNE_NEWS_AI_MODEL || DEFAULT_MODEL,
  };
}

export function requireAiEnabled(env = process.env) {
  const config = aiConfig(env);
  if (!config.enabled) throw Object.assign(new Error("AI下書き機能はまだ有効になっていません。"), { status: 503 });
  return config;
}

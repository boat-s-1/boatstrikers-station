import { STADIUMS } from "../../stadiums.js";
import { AI_CATEGORIES, candidateTopics } from "./topics.mjs";
import { runDraftPipeline } from "./pipeline.mjs";

// Scheduled draft generation. Off by default; it only ever creates drafts (never publishes).
// Enabling it needs BOTH BLOG_AI_DRAFTS_ENABLED=true and BLOG_AI_SCHEDULE_ENABLED=true, plus a cron entry
// that calls /api/cron/blog-ai-drafts (not added to vercel.json by this change).
export function scheduleConfig(env = process.env) {
  const max = Number.parseInt(env.BLOG_AI_SCHEDULE_MAX_PER_RUN || "1", 10);
  const categories = String(env.BLOG_AI_SCHEDULE_CATEGORIES || "stadium-basics,stadiums,stadium-charm").split(",").map(s => s.trim()).filter(s => AI_CATEGORIES[s]);
  return {
    enabled: env.BLOG_AI_DRAFTS_ENABLED === "true" && env.BLOG_AI_SCHEDULE_ENABLED === "true",
    // One draft per invocation: a generation can take ~100s and routes are limited to 120s. Run more often instead.
    maxPerRun: Number.isFinite(max) ? Math.min(Math.max(max, 1), 1) : 1,
    autoTopics: env.BLOG_AI_SCHEDULE_AUTO_TOPICS === "true",
    categories: categories.length ? categories : ["stadium-basics"],
  };
}

// Deterministic rotation: categories rotate by JST day; within a category, stadiums in course-code order.
export function nextAutoTopic({ existingKeys, categories, now = () => new Date() }) {
  const day = Math.floor((now().getTime() + 9 * 3600 * 1000) / 86400000);
  const order = categories.map((_, i) => categories[(day + i) % categories.length]);
  for (const categorySlug of order) {
    const candidates = candidateTopics({ categorySlug, existingKeys });
    const byStadium = new Map(STADIUMS.map((s, i) => [s.slug, i]));
    candidates.sort((a, b) => (byStadium.get(a.stadium_slug) ?? -1) - (byStadium.get(b.stadium_slug) ?? -1));
    if (candidates[0]) return candidates[0];
  }
  return null;
}

const RECENT_FAILURE_MS = 24 * 3600 * 1000, RUNNING_LOCK_MS = 15 * 60 * 1000;

export async function runScheduledDrafts({ store, repo, callAi, renderCover, fetchImpl, schedule, now = () => new Date(), extraTitles = [] }) {
  if (!schedule.enabled) return { status: "disabled", created: [] };
  const runs = await store.recentRuns(new Date(now().getTime() - RECENT_FAILURE_MS).toISOString());
  if (runs.some(r => r.status === "running" && now() - new Date(r.started_at) < RUNNING_LOCK_MS)) return { status: "skipped", reason: "前回の実行が終わっていません。", created: [] };
  const failedRecently = new Set(runs.filter(r => r.status === "failed" && r.topic_id).map(r => r.topic_id));
  const created = [], failed = [];
  for (let i = 0; i < schedule.maxPerRun; i++) {
    let topic = (await store.queuedTopics()).find(t => !failedRecently.has(t.id));
    if (!topic && schedule.autoTopics) {
      const candidate = nextAutoTopic({ existingKeys: (await store.topics()).map(t => t.topic_key), categories: schedule.categories, now });
      if (candidate) topic = await store.registerTopic(candidate);
    }
    if (!topic) break;
    const run = await store.insertRun({ trigger: "schedule", topic_id: topic.id });
    try {
      const result = await runDraftPipeline({ topicId: topic.id, store, repo, callAi, renderCover, fetchImpl, now, extraTitles });
      await store.finishRun(run.id, { status: "succeeded", post_id: result.post_id, message: `要修正${result.blocking}件・確認${result.warnings}件` });
      created.push(result);
    } catch (error) {
      await store.finishRun(run.id, { status: "failed", message: String(error.message || error).slice(0, 500) });
      failed.push({ topic_id: topic.id, error: String(error.message || error) });
      failedRecently.add(topic.id);
    }
  }
  return { status: created.length || failed.length ? "ran" : "idle", created, failed };
}

// Manual generation is logged the same way so every attempt is traceable.
export async function runLoggedDraft({ store, topicId, run }) {
  const row = await store.insertRun({ trigger: "manual", topic_id: topicId });
  try {
    const result = await run();
    await store.finishRun(row.id, { status: "succeeded", post_id: result.post_id, message: `要修正${result.blocking}件・確認${result.warnings}件` });
    return result;
  } catch (error) {
    await store.finishRun(row.id, { status: "failed", message: String(error.message || error).slice(0, 500) });
    throw error;
  }
}

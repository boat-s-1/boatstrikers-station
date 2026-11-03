import { RESEARCH_ROTATION, candidateTopics } from "./topics.mjs";
import { STADIUMS } from "../../stadiums.js";
import { runDraftPipeline } from "./pipeline.mjs";
import { validateAiDocument } from "./validate.mjs";
import { runQualityGates } from "./gates.mjs";
import { duplicateFindings, articleText } from "./duplicates.mjs";
import { computeDataset, jstDay } from "./data/datasets.mjs";
import { refreshNote } from "./sourceRefresh.mjs";
import { autoPublishAllowed, jstTime, PUBLISH_TIME_JST } from "./autoPublish.mjs";

// One daily article (PHASE 2). Each call claims the JST day's job (blog_ai_jobs, with a lease so two runs never work
// on the same day) and moves it along the states the database allows:
//   PLANNED → GENERATING → GENERATED → VALIDATING → APPROVED (gates PASS) → PUBLISHING → PUBLISHED
//                                         ├→ RETRY → GENERATING (at most 2 regenerations) ├→ HOLD   └→ FAILED
// One AI generation per call (a call is limited to ~120 s); the scheduler calls again to continue.
// With automatic publication off (the default and the 7-day test), the job stops at APPROVED: a gated draft is saved,
// nothing is published.

const DAY_MS = 86400000;
export function characterForDate(dateJst) {
  const day = Math.floor(Date.parse(`${dateJst}T00:00:00Z`) / DAY_MS);
  return RESEARCH_ROTATION[((day % RESEARCH_ROTATION.length) + RESEARCH_ROTATION.length) % RESEARCH_ROTATION.length];
}

// The next unused research theme of the character's categories (stadiums in course-code order).
export async function nextResearchTopic({ store, rotation }) {
  const existingKeys = (await store.topics()).map(t => t.topic_key);
  const order = new Map(STADIUMS.map((s, i) => [s.slug, i]));
  for (const categorySlug of rotation.categories) {
    const candidates = candidateTopics({ categorySlug, existingKeys }).sort((a, b) => (order.get(a.stadium_slug) ?? -1) - (order.get(b.stadium_slug) ?? -1));
    if (candidates[0]) return store.registerTopic(candidates[0]);
  }
  return null;
}

// The gates for the draft's current version, with the dataset recomputed now and the other articles for duplicates.
export async function evaluateDraft({ store, repo, postId, attempt, readRaceRows, now = () => new Date() }) {
  const [post, draft] = await Promise.all([repo.editor(postId), store.aiDraft(postId)]);
  const pack = draft.source_pack;
  const ownPosts = new Set(draft.topic_id ? await store.topicPostIds(draft.topic_id) : [postId]);
  ownPosts.add(postId);
  const validation = validateAiDocument({ document: post.document, pack });
  const datasets = [];
  for (const stored of pack.datasets || []) {
    const recomputed = readRaceRows ? computeDataset({ definition: stored.definition, rows: await readRaceRows({ period: stored.period, courseCode: stored.params?.course_code }),
      period: stored.period, params: stored.params, now: now(), thresholds: stored.thresholds }) : null;
    datasets.push({ stored, recomputed });
  }
  const existing = (await store.articleTexts()).filter(a => !ownPosts.has(a.post_id)).map(a => ({ post_id: a.post_id, title: a.title, text: articleText(a.document) }));
  const history = (await store.datasetHistory()).filter(h => !ownPosts.has(h.post_id));
  const duplicates = duplicateFindings({ document: post.document, dataset: pack.datasets?.[0] ?? null, existing, history, now: now() });
  const result = runQualityGates({ document: post.document, pack, validation, datasets, duplicates, attempt });
  const recorded = await store.recordGateResult(postId, post.version, result);
  return { result, gate_result_id: recorded.gate_result_id, version: post.version };
}

const summary = result => Object.entries(result.gates).filter(([, g]) => g.verdict !== "PASS").map(([, g]) => `${g.label}：${g.issues.filter(i => i.verdict !== "NOTE").map(i => i.code).join("・")}`).join(" / ").slice(0, 500);
const MAX_FAILED_RESTARTS = 2;

export async function runDailyCycle({ store, repo, callAi, renderCover, readRaceRows, fetchImpl = fetch, owner, now = () => new Date(), maxSteps = 8 }) {
  const settings = await store.aiSettings();
  if (!settings?.generation_enabled) return { status: "disabled", reason: "generation_disabled" };
  const date = jstDay(now());
  const rotation = characterForDate(date);
  const claim = await store.claimJob(date, rotation.character, owner);
  if (!claim.claimed) return { status: "skipped", reason: claim.reason, date, state: claim.job?.state };
  try {
    return await advance({ store, repo, callAi, renderCover, readRaceRows, fetchImpl, owner, now, maxSteps, settings, date, rotation, job: claim.job });
  } finally {
    // Waiting states keep no lease, so the next scheduled call continues; terminal states already released it.
    await store.releaseJob(date, owner).catch(() => {});
  }
}

async function advance({ store, repo, callAi, renderCover, readRaceRows, fetchImpl, owner, now, maxSteps, settings, date, rotation, job }) {
  let generated = false;
  const move = async (to, patch = {}) => { job = await store.moveJob(date, owner, to, patch); return job; };

  for (let step = 0; step < maxSteps; step++) {
    switch (job.state) {
      case "PLANNED": {
        const topic = await nextResearchTopic({ store, rotation });
        if (!topic) { await move("HOLD", { last_error: "このキャラクターの研究テーマが残っていません。" }); break; }
        await move("GENERATING", { topic_id: topic.id });
        break;
      }
      case "GENERATING": {
        if (generated) return { status: "paused", date, state: job.state };
        generated = true;
        const run = await store.insertRun({ trigger: "schedule", topic_id: job.topic_id });
        try {
          const result = await runDraftPipeline({ topicId: job.topic_id, store, repo, callAi, renderCover, fetchImpl, now, readRaceRows, attempt: job.attempt });
          await store.finishRun(run.id, { status: "succeeded", post_id: result.post_id, message: `要修正${result.blocking}件・確認${result.warnings}件${refreshNote(result.refresh_status)}` });
          await move("GENERATED", { post_id: result.post_id });
        } catch (error) {
          const message = String(error?.message || error).slice(0, 500);
          await store.finishRun(run.id, { status: "failed", message });
          // Data that fails its gate or research already done: never published, nothing to retry today.
          if ([409, 422].includes(error?.status)) await move("HOLD", { last_error: message });
          else { await move("FAILED", { last_error: message }); return { status: "failed", date, state: job.state, error: message }; } // restarted by a later call
        }
        break;
      }
      case "GENERATED": await move("VALIDATING"); break;
      case "VALIDATING": {
        const { result, gate_result_id } = await evaluateDraft({ store, repo, postId: job.post_id, attempt: job.attempt, readRaceRows, now });
        if (result.verdict === "PASS") await move("APPROVED", { gate_result_id });
        else await move(result.verdict === "RETRY" ? "RETRY" : "HOLD", { gate_result_id, last_error: summary(result) || result.reason || result.verdict });
        break;
      }
      case "RETRY": await move("GENERATING"); break;
      case "APPROVED": {
        // Automatic publication only when it is switched on and it is time; otherwise the gated draft waits as it is.
        if (!autoPublishAllowed(settings).ok) return { status: "approved_draft", date, post_id: job.post_id, state: job.state };
        if (jstTime(now()) < String(settings.publish_time || PUBLISH_TIME_JST).slice(0, 5)) return { status: "waiting", date, post_id: job.post_id, state: job.state };
        const post = await repo.editor(job.post_id);
        await move("PUBLISHING");
        try {
          await store.autoPublish(job.post_id, post.version, job.gate_result_id);
          await move("PUBLISHED");
        } catch (error) {
          await move("FAILED", { last_error: String(error?.message || error).slice(0, 500) });
          return { status: "failed", date, state: job.state, error: job.last_error };
        }
        break;
      }
      case "PUBLISHING": {
        // A run that stopped mid-publication: the database transaction either published or did nothing.
        const post = await store.postState(job.post_id);
        if (post.state === "published") { await move("PUBLISHED"); break; }
        await move("FAILED", { last_error: "公開処理が途中で止まりました。" });
        return { status: "failed", date, state: job.state, error: job.last_error };
      }
      case "FAILED": {
        const failures = (job.history || []).filter(h => h.to === "FAILED").length;
        if (failures > MAX_FAILED_RESTARTS) return { status: "failed", date, state: job.state, error: job.last_error };
        await move("PLANNED");
        // The topic chosen before the failure is reused when it is still a candidate (nothing was drafted).
        if (job.topic_id) { const topic = await store.topic(job.topic_id); if (topic.status === "candidate") await move("GENERATING", { topic_id: topic.id }); }
        break;
      }
      default: return { status: "finished", date, state: job.state, post_id: job.post_id };
    }
    if (["PUBLISHED", "HOLD"].includes(job.state)) return { status: job.state === "PUBLISHED" ? "published" : "hold", date, state: job.state, post_id: job.post_id, error: job.last_error };
  }
  return { status: "paused", date, state: job.state };
}


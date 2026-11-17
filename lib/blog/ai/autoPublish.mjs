import { jstDay } from "./data/datasets.mjs";

// Automatic publication (PHASE 1 design; not registered with any scheduler). Off by default.
//
// Order of checks, each one sufficient to stop:
//   1. settings: approval_mode='auto' and auto_publish_enabled (blog_ai_settings; both off by default).
//   2. time: not before the publication time (06:00 JST).
//   3. the candidate's latest gate result is PASS for its current version.
//   4. blog_ai_auto_publish (database, one transaction): settings and time again, one publication per JST day (primary
//      key), blog_ai_system_approve (PASS in all seven gates, same revision/version/content md5), blog_release
//      (unchanged) and the publication guard trigger. Any refusal leaves nothing approved or published.
// The release is immediate (no reservation), so switching auto_publish_enabled off stops anything not yet released.

export const PUBLISH_TIME_JST = "06:00";

export function autoPublishAllowed(settings) {
  if (!settings) return { ok: false, reason: "settings_missing" };
  if (settings.approval_mode !== "auto") return { ok: false, reason: "manual_mode" };
  if (!settings.auto_publish_enabled) return { ok: false, reason: "auto_publish_disabled" };
  return { ok: true };
}

export function jstTime(now) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(11, 16);
}

// candidate: { post_id, edit_version, state, gate: { id, verdict, edit_version } } (latest gate result of the post).
export function candidateProblem(candidate) {
  if (!candidate?.gate) return "no_gate_result";
  if (candidate.state !== "draft") return "already_released";
  if (candidate.gate.verdict !== "PASS") return "gate_not_passed";
  if (Number(candidate.gate.edit_version) !== Number(candidate.edit_version)) return "gate_stale";
  return null;
}

// store: { aiSettings, autoPublishCandidates, autoPublish(postId, version, gateResultId) }.
export async function runAutoPublish({ store, now = () => new Date(), publishTime = PUBLISH_TIME_JST }) {
  const allowed = autoPublishAllowed(await store.aiSettings());
  if (!allowed.ok) return { status: "disabled", reason: allowed.reason };
  const at = now();
  if (jstTime(at) < publishTime) return { status: "waiting", reason: "before_publish_time" };
  const day = jstDay(at);
  const skipped = [];
  for (const candidate of await store.autoPublishCandidates()) {
    const problem = candidateProblem(candidate);
    if (problem) { skipped.push({ post_id: candidate.post_id, reason: problem }); continue; }
    try {
      const published = await store.autoPublish(candidate.post_id, candidate.edit_version, candidate.gate.id);
      return { status: "published", day, post_id: candidate.post_id, approval_id: published.approval_id, skipped };
    } catch (error) {
      const message = String(error?.message || error);
      // The day already has its article (another run won the race): stop, do not try the next candidate.
      if (message.includes("BLOG_AI_ALREADY_PUBLISHED_TODAY")) return { status: "done", reason: "already_published_today", day, skipped };
      // Any other refusal (settings switched off, content changed, gate superseded, HOLD) leaves the article unpublished.
      skipped.push({ post_id: candidate.post_id, reason: "refused", error: message.slice(0, 200) });
    }
  }
  return { status: "nothing_to_publish", day, skipped };
}

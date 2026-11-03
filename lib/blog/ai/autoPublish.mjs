import { jstDay } from "./data/datasets.mjs";

// Automatic publication (PHASE 1 design; not registered with any scheduler). Off by default.
//
// Order of checks, each one sufficient to stop:
//   1. settings: approval_mode='auto' and auto_publish_enabled (blog_ai_settings; both off by default).
//   2. time: not before the publication time (06:00 JST).
//   3. one article per JST day: an AI article already published automatically today stops the run.
//   4. the candidate's latest gate result is PASS for its current version (the database checks this again).
//   5. blog_ai_system_approve (database): settings, PASS in all seven gates, same revision/version/content md5.
//   6. blog_release (database, unchanged): an approval valid for the current version and content.
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

// store: { aiSettings, autoPublishCandidates, systemPublishedOn(dayJst), systemApprove }; repo: { release }.
export async function runAutoPublish({ store, repo, now = () => new Date(), publishTime = PUBLISH_TIME_JST }) {
  const allowed = autoPublishAllowed(await store.aiSettings());
  if (!allowed.ok) return { status: "disabled", reason: allowed.reason };
  const at = now();
  if (jstTime(at) < publishTime) return { status: "waiting", reason: "before_publish_time" };
  const day = jstDay(at);
  if ((await store.systemPublishedOn(day)) > 0) return { status: "done", reason: "already_published_today", day };
  const skipped = [];
  for (const candidate of await store.autoPublishCandidates()) {
    const problem = candidateProblem(candidate);
    if (problem) { skipped.push({ post_id: candidate.post_id, reason: problem }); continue; }
    try {
      const approval = await store.systemApprove(candidate.post_id, candidate.edit_version, candidate.gate.id);
      const released = await repo.release(candidate.post_id, candidate.edit_version, null);
      return { status: "published", day, post_id: candidate.post_id, approval_id: approval.approval_id, version: released.version, skipped };
    } catch (error) {
      // A database refusal (settings switched off, content changed, gate superseded) leaves the article unpublished.
      skipped.push({ post_id: candidate.post_id, reason: "refused", error: String(error?.message || error).slice(0, 200) });
    }
  }
  return { status: "nothing_to_publish", day, skipped };
}

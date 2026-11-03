import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutoPublish, autoPublishAllowed, candidateProblem, jstTime } from "../../lib/blog/ai/autoPublish.mjs";

const AT_0601 = () => new Date("2026-11-03T21:01:00Z"); // 2026-11-04 06:01 JST
const AT_0559 = () => new Date("2026-11-03T20:59:00Z");
const candidate = (over = {}) => ({ post_id: "p1", state: "draft", edit_version: 4, gate: { id: "g1", verdict: "PASS", edit_version: 4 }, ...over });

function fakes({ settings = { approval_mode: "auto", auto_publish_enabled: true }, candidates = [candidate()], publishedToday = 0, approveError = null } = {}) {
  const calls = [];
  const store = {
    aiSettings: async () => settings,
    systemPublishedOn: async day => { calls.push(["count", day]); return publishedToday; },
    autoPublishCandidates: async () => candidates,
    systemApprove: async (...args) => { calls.push(["approve", ...args]); if (approveError) throw new Error(approveError); return { approval_id: "a1" }; },
  };
  const repo = { release: async (...args) => { calls.push(["release", ...args]); return { version: args[1] + 1 }; } };
  return { store, repo, calls };
}

test("default settings (manual mode, auto-publish off) never approve or publish", async () => {
  for (const settings of [{ approval_mode: "manual", auto_publish_enabled: false }, { approval_mode: "auto", auto_publish_enabled: false }, null]) {
    const { store, repo, calls } = fakes({ settings });
    const r = await runAutoPublish({ store, repo, now: AT_0601 });
    assert.equal(r.status, "disabled");
    assert.deepEqual(calls, []);
  }
  assert.deepEqual(autoPublishAllowed({ approval_mode: "manual", auto_publish_enabled: true }), { ok: false, reason: "manual_mode" });
});

test("in the automatic mode: waits until 06:00 JST, then approves and releases immediately one PASS article", async () => {
  assert.equal(jstTime(AT_0559()), "05:59");
  const early = fakes();
  assert.equal((await runAutoPublish({ ...early, now: AT_0559 })).status, "waiting");
  assert.deepEqual(early.calls, []);
  const { store, repo, calls } = fakes({ candidates: [candidate(), candidate({ post_id: "p2", gate: { id: "g2", verdict: "PASS", edit_version: 4 } })] });
  const r = await runAutoPublish({ store, repo, now: AT_0601 });
  assert.equal(r.status, "published");
  assert.equal(r.day, "2026-11-04");
  assert.deepEqual(calls, [["count", "2026-11-04"], ["approve", "p1", 4, "g1"], ["release", "p1", 4, null]]);
});

test("one article per JST day; RETRY/HOLD/stale/released candidates are skipped; refusals publish nothing", async () => {
  const done = fakes({ publishedToday: 1 });
  assert.equal((await runAutoPublish({ ...done, now: AT_0601 })).reason, "already_published_today");
  assert.ok(!done.calls.some(c => c[0] === "approve"));

  assert.equal(candidateProblem(candidate({ gate: { id: "g", verdict: "RETRY", edit_version: 4 } })), "gate_not_passed");
  assert.equal(candidateProblem(candidate({ gate: { id: "g", verdict: "HOLD", edit_version: 4 } })), "gate_not_passed");
  assert.equal(candidateProblem(candidate({ gate: { id: "g", verdict: "PASS", edit_version: 3 } })), "gate_stale");
  assert.equal(candidateProblem(candidate({ state: "published" })), "already_released");
  assert.equal(candidateProblem(candidate({ gate: null })), "no_gate_result");

  const held = fakes({ candidates: [candidate({ gate: { id: "g", verdict: "HOLD", edit_version: 4 } })] });
  const r = await runAutoPublish({ ...held, now: AT_0601 });
  assert.equal(r.status, "nothing_to_publish");
  assert.deepEqual(r.skipped, [{ post_id: "p1", reason: "gate_not_passed" }]);

  const refused = fakes({ approveError: "BLOG_AI_AUTO_PUBLISH_DISABLED" });
  const r2 = await runAutoPublish({ ...refused, now: AT_0601 });
  assert.equal(r2.status, "nothing_to_publish");
  assert.equal(r2.skipped[0].reason, "refused");
  assert.ok(!refused.calls.some(c => c[0] === "release"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutoPublish, autoPublishAllowed, candidateProblem, jstTime } from "../../lib/blog/ai/autoPublish.mjs";

const AT_0601 = () => new Date("2026-11-03T21:01:00Z"); // 2026-11-04 06:01 JST
const AT_0559 = () => new Date("2026-11-03T20:59:00Z");
const candidate = (over = {}) => ({ post_id: "p1", state: "draft", edit_version: 4, gate: { id: "g1", verdict: "PASS", edit_version: 4 }, ...over });

function fakes({ settings = { approval_mode: "auto", auto_publish_enabled: true }, candidates = [candidate()], errors = {} } = {}) {
  const calls = [];
  const store = {
    aiSettings: async () => settings,
    autoPublishCandidates: async () => candidates,
    autoPublish: async (...args) => { calls.push(["autoPublish", ...args]); if (errors[args[0]]) throw new Error(errors[args[0]]); return { approval_id: "a1" }; },
  };
  return { store, calls };
}

test("default settings (manual mode, auto-publish off) never publish", async () => {
  for (const settings of [{ approval_mode: "manual", auto_publish_enabled: false }, { approval_mode: "auto", auto_publish_enabled: false }, null]) {
    const { store, calls } = fakes({ settings });
    assert.equal((await runAutoPublish({ store, now: AT_0601 })).status, "disabled");
    assert.deepEqual(calls, []);
  }
  assert.deepEqual(autoPublishAllowed({ approval_mode: "manual", auto_publish_enabled: true }), { ok: false, reason: "manual_mode" });
});

test("in the automatic mode: waits until 06:00 JST, then publishes one PASS article through the database function", async () => {
  assert.equal(jstTime(AT_0559()), "05:59");
  const early = fakes();
  assert.equal((await runAutoPublish({ store: early.store, now: AT_0559 })).status, "waiting");
  assert.deepEqual(early.calls, []);
  const { store, calls } = fakes({ candidates: [candidate(), candidate({ post_id: "p2", gate: { id: "g2", verdict: "PASS", edit_version: 4 } })] });
  const r = await runAutoPublish({ store, now: AT_0601 });
  assert.equal(r.status, "published");
  assert.equal(r.day, "2026-11-04");
  assert.deepEqual(calls, [["autoPublish", "p1", 4, "g1"]]);
});

test("RETRY/HOLD/stale/released candidates are skipped; a lost race for the day stops; other refusals try the next", async () => {
  assert.equal(candidateProblem(candidate({ gate: { id: "g", verdict: "RETRY", edit_version: 4 } })), "gate_not_passed");
  assert.equal(candidateProblem(candidate({ gate: { id: "g", verdict: "HOLD", edit_version: 4 } })), "gate_not_passed");
  assert.equal(candidateProblem(candidate({ gate: { id: "g", verdict: "PASS", edit_version: 3 } })), "gate_stale");
  assert.equal(candidateProblem(candidate({ state: "published" })), "already_released");
  assert.equal(candidateProblem(candidate({ gate: null })), "no_gate_result");

  const held = fakes({ candidates: [candidate({ gate: { id: "g", verdict: "HOLD", edit_version: 4 } })] });
  const r = await runAutoPublish({ store: held.store, now: AT_0601 });
  assert.equal(r.status, "nothing_to_publish");
  assert.deepEqual(held.calls, []);

  const raced = fakes({ candidates: [candidate(), candidate({ post_id: "p2" })], errors: { p1: "BLOG_AI_ALREADY_PUBLISHED_TODAY" } });
  const r2 = await runAutoPublish({ store: raced.store, now: AT_0601 });
  assert.equal(r2.status, "done");
  assert.equal(raced.calls.length, 1, "never a second article on the same day");

  const changed = fakes({ candidates: [candidate(), candidate({ post_id: "p2" })], errors: { p1: "BLOG_AI_CONTENT_CHANGED" } });
  const r3 = await runAutoPublish({ store: changed.store, now: AT_0601 });
  assert.equal(r3.status, "published");
  assert.equal(r3.post_id, "p2");
  assert.equal(r3.skipped[0].reason, "refused");
});

import test from "node:test";
import assert from "node:assert/strict";
import { runBrdbPrivateTrial } from "./brdb-private-trial.mjs";

const encode = text => new TextEncoder().encode(text);
const master = encode("SOPDT,OPDT,RCOURSECD,RNO,CLOSETM,PRGF\r\n20261125,20261126,05,02,1101,1\r\n");
const detail = encode("SOPDT,OPDT,RCOURSECD,RNO,TEINO,ENTNO\r\n" +
  Array.from({ length: 6 }, (_, i) => `20261125,20261126,05,02,${i+1},0${4101+i}\r\n`).join(""));
const target = { date: "20261126", course: 5, race: 2 };
test("private trial completes once with six candidates and no implicit retries", async () => {
  const seen = [];
  const request = async (op, params) => {
    seen.push(op);
    if (op === "select") {
      assert.match(params.cmd1, /RCOURSECD = 5 AND RNO = 2/);
      assert.match(params.cmd2, /SOPDT >= '20261116'/);
      return { ret: 0, ret1: "q1", ret2: "q2" };
    }
    if (op === "state") return { ret: 0, ret1: 2, ret2: 2 };
    return params.qid === "q1" ? master : detail;
  };
  const result = await runBrdbPrivateTrial({ ...target, request });
  assert.equal(result.status, "CANDIDATE_PRIVATE_ONLY");
  assert.equal(result.calls, 4);
  assert.equal(result.boatCount, 6);
  assert.deepEqual(seen, ["select", "state", "getcsv", "getcsv"]);
});
test("pending job stops at three state checks without downloading", async () => {
  const seen = [];
  const result = await runBrdbPrivateTrial({ ...target, request: async op => {
    seen.push(op);
    return op === "select" ? { ret: 0, ret1: "q1", ret2: "q2" } : { ret: 0, ret1: 1, ret2: 0 };
  } });
  assert.equal(result.status, "HOLD_TIMEOUT");
  assert.equal(result.calls, 4);
  assert.deepEqual(seen, ["select", "state", "state", "state"]);
});
test("provider failure, partial roster and invalid target fail closed", async () => {
  const fail = await runBrdbPrivateTrial({ ...target, request: async () => ({ ret: -1 }) });
  assert.deepEqual(fail, { status: "HOLD_SELECT", calls: 1 });
  const partial = await runBrdbPrivateTrial({ ...target, request: async (op, params) =>
    op === "select" ? { ret: 0, ret1: "q1", ret2: "q2" } :
    op === "state" ? { ret: 0, ret1: 2, ret2: 2 } :
    params.qid === "q1" ? master : encode("SOPDT,OPDT,RCOURSECD,RNO,TEINO,ENTNO\r\n20261125,20261126,05,02,1,04101\r\n") });
  assert.equal(partial.status, "HOLD_ROSTER");
  assert.equal(partial.calls, 4);
  await assert.rejects(runBrdbPrivateTrial({ ...target, date: "2026-11-26", request: async () => {} }));
});

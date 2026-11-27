import test from "node:test";
import assert from "node:assert/strict";
import { loadPrivateProgram } from "./site-private-program-gate.mjs";

test("disabled private preview never authenticates or reads data", async () => {
  let calls = 0;
  const result = await loadPrivateProgram({
    enabled: false,
    authenticate: async () => { calls++; return true; },
    load: async () => { calls++; return [{ boat: 1 }]; },
  });
  assert.deepEqual(result, { allowed: false, data: null });
  assert.equal(calls, 0);
});

test("unauthenticated private preview never reads data", async () => {
  let reads = 0;
  const result = await loadPrivateProgram({
    enabled: true,
    authenticate: async () => false,
    load: async () => { reads++; return []; },
  });
  assert.deepEqual(result, { allowed: false, data: null });
  assert.equal(reads, 0);
});

test("authorized private preview reads once and returns the data", async () => {
  let reads = 0;
  const result = await loadPrivateProgram({
    enabled: true,
    authenticate: async () => true,
    load: async () => { reads++; return [1, 2, 3, 4, 5, 6]; },
  });
  assert.deepEqual(result, { allowed: true, data: [1, 2, 3, 4, 5, 6] });
  assert.equal(reads, 1);
});

test("authentication errors fail closed without reading", async () => {
  let reads = 0;
  await assert.rejects(loadPrivateProgram({
    enabled: true,
    authenticate: async () => { throw new Error("session unavailable"); },
    load: async () => { reads++; return []; },
  }));
  assert.equal(reads, 0);
});

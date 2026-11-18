import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBrdbJob } from './brdb-protocol-gate.mjs';

test('only a completed successful job is ready to request its URL', () => {
  for (const code of [0, 1]) assert.equal(classifyBrdbJob({ ret: 0, ret1: code }), 'WAIT_BOUNDED');
  assert.equal(classifyBrdbJob({ ret: 0, ret1: 2 }), 'READY_FOR_GETURL');
  for (const code of [4, 6, 8, 9]) assert.equal(classifyBrdbJob({ ret: 0, ret1: code }), 'STOP_JOB_FAILED');
});

test('unknown, malformed and provider errors stop the pipeline', () => {
  assert.equal(classifyBrdbJob({ ret: -1, ret1: 2 }), 'STOP_PROVIDER_ERROR');
  assert.equal(classifyBrdbJob({ ret: 0, ret1: 3 }), 'STOP_UNKNOWN_STATUS');
  assert.equal(classifyBrdbJob({ ret: 0, ret1: 'invalid' }), 'STOP_INVALID_RESPONSE');
});

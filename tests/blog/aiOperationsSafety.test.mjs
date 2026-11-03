import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
test('emergency-stop endpoint authenticates writes and has no enable action', () => {
  const route = read('app/api/admin/blog/ai/control/route.js');
  assert.match(route, /requireBlogAdmin\(request, \{ write: true \}\)/);
  assert.match(route, /confirmation !== "STOP"/);
  assert.doesNotMatch(route, /action === ["']enable["']/);
});
test('emergency stop only sets safe settings', () => {
  const store = read('lib/blog/ai/store.mjs');
  const stop = store.split('async emergencyStop()')[1].split('// PHASE 1: the gate result')[0];
  assert.match(stop, /generation_enabled: false/);
  assert.match(stop, /auto_publish_enabled: false/);
  assert.match(stop, /approval_mode: "manual"/);
  assert.doesNotMatch(stop, /generation_enabled: true|auto_publish_enabled: true/);
});
test('HOLD monitoring reads jobs without sending external notifications', () => {
  const route = read('app/api/admin/blog/ai/control/route.js');
  assert.match(route, /jobs\.filter\(j => j\.state === "HOLD"\)/);
  assert.doesNotMatch(route, /webhook|sendEmail|fetch\(/);
  const panel = read('app/admin/blog/ai/AiOperationsPanel.js');
  assert.match(panel, /key=\{j\.publish_date\}/);
  assert.match(panel, /外部通知は送信しません/);
});

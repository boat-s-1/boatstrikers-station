import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("scripts/discord-race-readonly-diagnostic.mjs","utf8");
test("diagnostic performs only GET requests and never reads messages",()=>{
  assert.match(source,/method:"GET"/);
  assert.doesNotMatch(source,/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
  assert.doesNotMatch(source,/\/messages(?:\/|\b)/);
  assert.doesNotMatch(source,/\/webhooks(?:\/|\b)/);
  assert.doesNotMatch(source,/console\.log\([^\n]*(?:token|Authorization)/);
});
test("diagnostic validates channel parent and archived status",()=>{
  assert.match(source,/thread\?\.thread_metadata\?\.archived===false/);
  assert.match(source,/thread\?\.parent_id/);
  assert.match(source,/thread\?\.type===11/);
});

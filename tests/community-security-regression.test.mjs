import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canReadAudience, canReply } from '../lib/community/accessPolicy.mjs';
import { isPublicThread } from '../lib/community/catalogue.mjs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('anonymous loader restricts DB query to published public posts', () => {
  const code = read('lib/community/publicServer.js');
  assert.match(code, /\.eq\('status', 'published'\)\.eq\('audience', 'public'\)/);
  assert.match(code, /\.lte\('published_at', new Date\(\)\.toISOString\(\)\)/);
  assert.doesNotMatch(code, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('public thread detail restricts DB query to public posts', () => {
  const code = read('app/community/t/[slug]/page.js');
  assert.match(code, /\.eq\('status', 'published'\)\.eq\('audience', 'public'\)/);
  assert.doesNotMatch(code, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('admin route is inaccessible before operator authorization', () => {
  const code = read('app/community/admin/page.js');
  assert.match(code, /notFound\(\)/);
  assert.doesNotMatch(code, /<PostComposer/);
});
test('invalid audience and expired drafts never qualify as public', () => {
  const base = {status:'published',published_at:'2020-01-01T00:00:00Z'};
  for (const audience of ['members','paid','__proto__',null,undefined]) {
    assert.equal(isPublicThread({...base,audience}),false);
  }
  assert.equal(isPublicThread({...base,audience:'public',published_at:'invalid'}),false);
  assert.equal(isPublicThread({...base,audience:'public',status:'draft'}),false);
});
test('unknown access level cannot reply', () => {
  for (const level of ['guest','free','admin','toString',null]) {
    assert.equal(canReply({audience:'public',replyPolicy:'paid',locked:false},level),false);
  }
  assert.equal(canReadAudience('paid','paid'),true);
});

test('RLS design defaults to disabled replies and limits anonymous reads', () => {
  const code = read('docs/community/community-rls-review-2026-11-17.md');
  assert.match(code, /reply_policy text not null default 'disabled'/);
  assert.match(code, /using \(status = 'published' and audience = 'public' and published_at <= now\(\)\)/);
  assert.match(code, /revoke all on public\.community_threads from anon, authenticated/);
});

test('public thread detail handles failed database requests without rendering content', () => {
  const code = read('app/community/t/[slug]/page.js');
  assert.match(code, /try\s*\{/);
  assert.match(code, /catch\s*\{/);
  assert.match(code, /if \(error \|\| !isPublicThread\(data\)\) return null/);
  assert.match(code, /if \(!thread\) notFound\(\)/);
});

test('official post composer defaults to replies disabled', () => {
  const code = read('app/community/admin/PostComposer.jsx');
  assert.match(code, /\[reply_policy, setReplyPolicy\] = useState\('disabled'\)/);
  assert.doesNotMatch(code, /\[reply_policy, setReplyPolicy\] = useState\('paid'\)/);
});

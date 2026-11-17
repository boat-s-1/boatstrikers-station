import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPublicThreads } from '../lib/community/catalogue.mjs';

const base = {status:'published', visibility:'public_all', published_at:'2026-11-17T00:00:00Z'};
test('public list excludes member-only, drafts and future posts', () => {
  const rows = [
    {...base,id:1,character_key:'ichika'},
    {...base,id:2,visibility:'members_only',character_key:'ichika'},
    {...base,id:3,status:'draft',character_key:'ichika'},
    {...base,id:4,published_at:'2999-01-01T00:00:00Z',character_key:'ichika'},
    {...base,id:5,character_key:'hatsune'}
  ];
  assert.deepEqual(filterPublicThreads(rows,'ichika').map(r=>r.id),[1]);
});
test('limit and official activity order', () => {
  const rows = [{...base,id:1,last_official_activity_at:'2026-11-17T01:00:00Z'},{...base,id:2,last_official_activity_at:'2026-11-17T02:00:00Z'}];
  assert.deepEqual(filterPublicThreads(rows,null,1).map(r=>r.id),[2]);
});

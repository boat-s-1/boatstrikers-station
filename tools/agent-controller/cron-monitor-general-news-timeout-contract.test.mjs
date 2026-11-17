import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../lib/boatstrikersGeneralNewsSync.js',import.meta.url),'utf8');
const route=readFileSync(new URL('../../app/api/cron/hatsune-news-pipeline/route.js',import.meta.url),'utf8');
test('boatrace is a general news source with 3500ms per-fetch timeout',()=>{
 assert.match(source,/key: "boatrace"/);
 assert.match(source,/const FETCH_TIMEOUT_MS = 3500/);
 assert.match(source,/signal: AbortSignal\.timeout\(FETCH_TIMEOUT_MS\)/);
});
test('per-source errors are collected and processing continues',()=>{
 assert.match(source,/Promise\.allSettled\(SOURCES\.map/);
 assert.match(source,/errors\.push\(\x60\$\{source\.key\}: \$\{message\}\x60\)/);
 assert.match(route,/generalErrors = Array\.isArray\(general\?\.errors\)/);
 assert.match(route,/const ok = errorCount === 0/);
});
test('general sync may mutate existing articles and is not safe to invoke as a health probe',()=>{
 assert.match(source,/repairExistingGeneralRows\(supabase\)/);
 assert.match(source,/\.update\(patch\)\.eq\("id", row\.id\)/);
 assert.match(source,/\.insert\(enrichedRows\)/);
});

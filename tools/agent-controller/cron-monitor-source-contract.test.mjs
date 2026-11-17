import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('Cron pipeline source does not prove unfinished means failure',()=>{
 const route=read('app/api/cron/hatsune-news-pipeline/route.js');
 const log=read('lib/hatsuneCronLog.js');
 assert.match(route,/export const maxDuration = 60/);
 assert.match(route,/startHatsuneCronRun\("pipeline"\)/);
 assert.match(route,/status: ok \? "success" : "partial"/);
 assert.match(route,/status: "error"/);
 assert.match(log,/status: "running"/);
 assert.match(log,/\.update\(payload\)\.eq\("id", run\.id\)/);
 assert.doesNotMatch(log,/if\s*\(error\)\s*throw error;[\s\S]*?return.*finishedAt/);
});
test('pipeline has no direct Vercel cron schedule and backup is manual',()=>{
 const config=JSON.parse(read('vercel.json'));
 assert.equal(config.crons.some(x=>x.path==='/api/cron/hatsune-news-pipeline'),false);
 const workflow=read('.github/workflows/hatsune-news-daily.yml');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s+schedule:/m);
});

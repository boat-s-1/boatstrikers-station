import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/hatsuneCronLog.js',import.meta.url),'utf8');
test('finish checks PostgREST update result, not just rejected promise',()=>{
 assert.match(source,/const \{ data, error \} = await supabase[\s\S]*?\.update\(payload\)[\s\S]*?\.eq\("id", run\.id\)[\s\S]*?\.select\("id"\)[\s\S]*?\.single\(\)/);
 assert.match(source,/if \(error \|\| !data\?\.id\)/);
});
test('completion failure logs bounded metadata without error message or credential',()=>{
 assert.match(source,/console\.error\("Hatsune cron log finish not confirmed"/);
 assert.match(source,/code: typeof error\?\.code === "string" && \/\^\[A-Z0-9_\]\{1,40\}\$\/.test\(error\.code\)/);
 assert.match(source,/\? error\.code : "NO_MATCHING_ROW"/);
 assert.doesNotMatch(source,/console\.error\("Hatsune cron log finish not confirmed", error\)/);
});
test('completion logging remains nonthrowing to preserve existing pipeline response',()=>{
 const part=source.split('if (error || !data?.id) {')[1];
 assert.ok(part);assert.doesNotMatch(part,/throw /);
});

test('start returns job name for safe completion diagnostics',()=>{
 assert.match(source,/\.insert\(\{ job_name: jobName, status: "running", started_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]*?\.select\("id,started_at,job_name"\)\s*\.single\(\)/);
 assert.match(source,/jobName: run\.job_name \|\| "unknown"/);
});

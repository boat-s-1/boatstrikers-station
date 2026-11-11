import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeDataset } from '../../lib/blog/ai/data/datasets.mjs';
import { buildResearchPack } from '../../lib/blog/ai/data/researchPack.mjs';
import { buildInstructions, buildInput, ARTICLE_SCHEMA } from '../../lib/blog/ai/prompt.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument } from '../../lib/blog/ai/validate.mjs';
import { runQualityGates } from '../../lib/blog/ai/gates.mjs';
import { duplicateFindings } from '../../lib/blog/ai/duplicates.mjs';
import { callOpenAIJson } from '../../lib/blog/ai/openai.mjs';
import { decodeExport } from './verify-real-data.mjs';
import { hold, executionMode } from './verification-budget.mjs';
import { loadSnapshot, sha256 } from './verification-snapshot.mjs';

export const ICHIKA_CASE='ichika-kiryu-inside';
export function ichikaInput(repo){
  const base=join(repo,'tests/blog/fixtures/real-data'),caseBytes=readFileSync(join(base,'cases.json'));
  const cases=JSON.parse(caseBytes.toString('utf8')).filter(c=>c.name===ICHIKA_CASE);
  if(cases.length!==1)hold('ICHIKA_CASE');const c=cases[0];
  if(c.character!=='ichika'||c.export!=='kiryu-20261004-20261102.json'||c.definition!=='inside_escape'||c.period.from!=='2026-10-04'||c.period.to!=='2026-10-26'||c.params.course_code!==1||c.topic.character_key!=='ichika')hold('ICHIKA_FIXED_INPUT');
  const bytes=readFileSync(join(base,c.export)),rows=decodeExport(JSON.parse(bytes.toString('utf8')));
  const evidence=computeDataset({definition:c.definition,rows,period:c.period,params:c.params,now:new Date(c.period.to+'T20:00:00Z')});
  if(evidence.status!=='ok'||evidence.population!==168||evidence.usable!==166||evidence.excluded.course_missing!==2||evidence.metrics.escapes!==73||evidence.metrics.escape_rate!==44)hold('ICHIKA_DATA_HOLD');
  return {c,rows,evidence,inputDataHash:sha256(Buffer.concat([caseBytes,Buffer.from('\0'),bytes]))};
}
export function prepareIchika(plan,repo,now=Date.now()){
  if(executionMode(plan)!=='ichika-only')return null;
  const input=ichikaInput(repo);
  if(plan.caseKey!==ICHIKA_CASE||plan.inputDataHash!==input.inputDataHash)hold('ICHIKA_INPUT_HASH');
  const snapshot=loadSnapshot(plan,now);
  const binding={caseKey:ICHIKA_CASE,inputDataHash:input.inputDataHash,datasetHash:input.evidence.hash,period:input.c.period,snapshot:snapshot.metadata};
  return {...input,snapshot,binding,pack:buildResearchPack({topic:input.c.topic,evidence:input.evidence,now:new Date(now)})};
}
const catalogue={categoryId:'11111111-1111-4111-8111-111111111111',categoryName:'研究',authorIds:{ichika:'22222222-2222-4222-8222-222222222221',hatsune:'22222222-2222-4222-8222-222222222222',kiina:'22222222-2222-4222-8222-222222222223'}};
function evaluate(prepared,ai){
  const {c,pack,rows,evidence,snapshot}=prepared;
  const composed=composeDocument({ai,pack,topic:c.topic,catalogue,coverMediaId:'33333333-3333-4333-8333-333333333333',coverAlt:'ローカル検証用表紙'});
  const validation=[...composed.issues,...validateAiDocument({document:composed.document,pack})];
  const recomputed=computeDataset({definition:c.definition,rows,period:c.period,params:c.params,now:new Date()});
  const duplicates=duplicateFindings({document:composed.document,dataset:evidence,existing:snapshot.articles.map(a=>({post_id:a.id,title:a.title,text:a.text}))});
  return {document:composed.document,result:runQualityGates({document:composed.document,pack,validation,datasets:[{stored:evidence,recomputed}],duplicates})};
}
// Exactly one article call; no smoke, retries, database operations, image generation or publication.
export async function generateIchika({prepared,plan,apiKey,fetchImpl}){
  const {data:ai}=await callOpenAIJson({apiKey,model:plan.model,maxOutputTokens:12000,fetchImpl,instructions:buildInstructions(prepared.pack),input:buildInput(prepared.pack),schema:ARTICLE_SCHEMA,schemaName:'boatstrikers_blog_article'});
  // Re-read the bound file after response too, so concurrent deletion/tampering never passes silently.
  loadSnapshot(plan);
  const main=evaluate(prepared,ai);
  const rate=prepared.pack.facts.find(f=>/率$/.test(f.label));
  let changed=JSON.stringify(ai.sections).replace(`${rate.value}%`,`${(Number(rate.value)+1).toFixed(1)}%`);
  if(changed===JSON.stringify(ai.sections))changed=JSON.stringify(ai.sections).replace(`${prepared.evidence.usable}レース`,`${prepared.evidence.usable+1}レース`);
  const tampered=evaluate(prepared,{...ai,sections:JSON.parse(changed)});
  const periodRemoved=evaluate(prepared,JSON.parse(JSON.stringify(ai).replaceAll(prepared.pack.sources[0].period,'この期間')));
  const safetyChecks=changed!==JSON.stringify(ai.sections)&&tampered.result.verdict==='HOLD'&&periodRemoved.result.verdict!=='PASS';
  return {character:'ichika',caseKey:ICHIKA_CASE,verdict:main.result.verdict,gates:main.result.gates,scorecard:main.result.scorecard,document:main.document,dataset:{period:prepared.c.period,population:168,usable:166,excluded:{course_missing:2},escapes:73,escapeRate:44,datasetHash:prepared.evidence.hash},snapshot:prepared.snapshot.metadata,tampered:{verdict:tampered.result.verdict},period_removed:{verdict:periodRemoved.result.verdict},safetyChecks,publishAllowed:false};
}

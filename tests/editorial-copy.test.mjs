import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reviewGeneratedCopy, checkedShortCopy, reviewFreeTextFields } from '../lib/editorial/reviewGeneratedCopy.mjs';
import { SHORT_COPY, editorialHashtags, COPY_POLICY_VERSION } from '../lib/editorial/copyPolicy.mjs';
import { getAuthorRole } from '../lib/blog/authorPresentation.mjs';
import { showResponsibleFooter } from '../lib/editorial/noticeRoutes.mjs';
import { generateVerifiedXDraft } from '../lib/newsXDraftAi.js';
import { buildCharacterDetailsFrom } from '../lib/dataLabSocialGenerator.js';

for (const text of ['この予想なら絶対に勝てる！','高配当をぶち抜くよ！','イン逃げ鉄板予想','一撃回収！']) {
 test(`known own short copy uses approved fallback: ${text}`,()=>{
  const result=checkedShortCopy(text,{field:'character_comment',fallback:SHORT_COPY.news});
  assert.equal(result.text,SHORT_COPY.news);assert.equal(result.review.fallbackUsed,true);
  assert.equal(result.review.ruleVersion,COPY_POLICY_VERSION);
 });
}
test('invalid fallback fails without saving any draft',()=>assert.throws(()=>checkedShortCopy('一撃回収！',{field:'callout',fallback:'絶対に勝てる！'}),/review_required/));
for(const origin of ['source_title','quote','statistic'])test(`protected ${origin} remains verbatim`,()=>{
 const text='高配当：5号艇、151,470円。「絶対に勝てる！」という発言';
 assert.equal(reviewGeneratedCopy({text,field:'character_comment',origin}).status,'ok');
 assert.equal(text,'高配当：5号艇、151,470円。「絶対に勝てる！」という発言');
});
test('education, negations and unknown long text are never automatically rewritten',()=>{
 for(const text of ['絶対に来る艇として扱う材料はありません。','高配当＝高回収率ではない。','「絶対に勝てる！」という断定は避けます。']){
  assert.equal(checkedShortCopy(text,{field:'character_comment',fallback:SHORT_COPY.news}).text,text);
  assert.notEqual(reviewGeneratedCopy({text,field:'articleBody',origin:'unknown'}).status,'blocked');
 }
 assert.equal(reviewFreeTextFields({articleBody:'絶対に勝てる！'})[0].status,'warning');
});
test('only generated tag fields remove legacy defaults; custom tags and limits remain',()=>{
 assert.deepEqual(editorialHashtags(['#競艇','#競艇予想','#ボートレース','#女子戦','#女子戦']),['#ボートレース','#女子戦']);
 assert.deepEqual(editorialHashtags(undefined),['#ボートレース','#BoatStrikers']);
 assert.deepEqual(editorialHashtags(undefined,{defaults:[],max:2}),[]);
});
test('author presentation is exact and nonmutating',()=>{
 const a=Object.freeze({slug:'kiina',role:'穴・5アタマ・展開・高配当研究'});
 assert.equal(getAuthorRole(a),'穴・5アタマ・展開・配当分布の研究');assert.equal(a.role,'穴・5アタマ・展開・高配当研究');
 for(const b of [{slug:'kiina',role:'独自の研究'},{slug:'ichika',role:a.role}])assert.equal(getAuthorRole(b),b.role);
});
test('responsible footer respects exact route boundaries and existing detailed notices',()=>{
 for(const path of ['/ichika','/hatsune','/kiina','/today','/news','/news/24','/races/toda/1','/ai-results','/newspapers','/library/stadiums','/library/stadium/toda'])assert.equal(showResponsibleFooter(path),true,path);
 for(const path of ['/','/about','/guide','/terms','/newspapers/sample','/data-lab/example','/blog','/blog/authors/kiina','/blog-preview/test','/admin/news-shorts','/api/test','/members','/bsc2/login','/newspapers-extra','/races-extra'])assert.equal(showResponsibleFooter(path),false,path);
});
test('NEWS X keeps verified original and planned-event guard, warns on free prose',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='mock-only';let calls=0,body;
 const item={verified:true,verification_status:'verified',title:'相棒37号機は「絶対にいい」 | 競艇',summary:'高配当＝高回収率ではない。',result_status:'scheduled',race_no:5,venue:'津'};
 const original=structuredClone(item);
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(options.body);return {ok:true,json:async()=>({output_text:JSON.stringify({post:'「絶対にいい」という発言を確認しました。',hashtags:['#競艇','#女子戦']})})}};
 try{
  await assert.rejects(generateVerifiedXDraft({...item,verified:false}),/未検証/);assert.equal(calls,0);
  const result=await generateVerifiedXDraft(item);assert.equal(calls,1);assert.deepEqual(item,original);assert.deepEqual(result.hashtags,['#女子戦']);
  assert.match(body.instructions,/未開催\/予定/);assert.match(body.instructions,/editorial-copy-v1/);assert.match(body.input,/相棒37号機は/);
  assert.equal(result.post,'「絶対にいい」という発言を確認しました。');assert.equal(result.copy_review[0].status,'warning');
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
test('DATA LAB changes only commentary; counts and confirmed payouts remain',()=>{
 const input={events:[{course_code:1,course_name:'桐生',race_no:1,trifecta:'5-1-2',trifecta_payout:151470,result_available:true}],entries:[],techniqueMap:new Map(),digest:{manshu:[{venue:'桐生',race_no:1,payout:151470}]}};
 const original=structuredClone(input);const result=buildCharacterDetailsFrom(input);
 assert.deepEqual(input,original);assert.equal(result.kiina.comment,'各レースの配当と展開を振り返ります。');
 assert.equal(result.kiina.payout_top5[0].payout,151470);
});
test('NEWS short applies narrow fallback before mock save, facts and schema stay intact',async()=>{
 let saved,request;const candidates=[1,2,3].map(id=>({id,verified:true,verification_status:'verified',title:`公式レース情報${id}（競艇）`,summary:`高配当結果${id}`,source_name:'公式',source_url:`https://example.invalid/${id}`,importance:id,collected_at:'2026-10-15T01:00:00Z',result_status:'confirmed'}));
 const client={from(table){const chain={select(){return chain},eq(){return chain},gte(){return chain},lt(){return chain},order(){return chain},limit(){return Promise.resolve({data:candidates})},maybeSingle(){return Promise.resolve({data:null})},upsert(row){assert.equal(table,'bs_news_short_drafts');saved=row;return chain},single(){return Promise.resolve({data:{id:1,...saved}})},insert(){return Promise.resolve({error:null})}};return chain}};
 let source=fs.readFileSync(new URL('../lib/newsShortAi.js',import.meta.url),'utf8');
 source=source.replace('import { createClient } from "@supabase/supabase-js";','const createClient = () => globalThis.__editorialMockClient;').replaceAll('"./editorial/',`"${new URL('../lib/editorial/',import.meta.url).href}`);
 globalThis.__editorialMockClient=client;const oldFetch=globalThis.fetch,env={...process.env};
 process.env.OPENAI_API_KEY='mock-only';process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='mock-only';
 globalThis.fetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({output_text:JSON.stringify({segments:candidates.map(x=>({headline:x.title,caption:x.summary,narration:x.summary})),character_comment:'この予想なら絶対に勝てる！',hashtags:['#競艇予想','#ボートレース'],x_post:'高配当の結果を確認。'})})}};
 try{
  const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const result=await mod.generateDailyNewsShort({date:'2026-10-15'});
  assert.equal(saved.character_comment,SHORT_COPY.news);assert.deepEqual(saved.hashtags,['#ボートレース']);assert.equal(saved.status,'draft');
  assert.equal(saved.selected_news.length,3);assert.deepEqual(saved.selected_news.map(x=>x.title),[...candidates].reverse().map(x=>x.title));
  assert.equal('copy_review' in saved,false);assert.equal(result.copy_review[0].fallbackUsed,true);assert.match(request.instructions,/editorial-copy-v1/);
 }finally{globalThis.fetch=oldFetch;delete globalThis.__editorialMockClient;for(const key of ['OPENAI_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});

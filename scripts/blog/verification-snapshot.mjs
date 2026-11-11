import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleText } from '../../lib/blog/ai/duplicates.mjs';
import { assertSafe, externalPath, hold } from './verification-budget.mjs';

export const SNAPSHOT_MAX_AGE_MS = 24 * 3600000;
export const BLOG_PROJECT = 'rzosrbkyniyedolhkgxo';
export const BLOG_ORIGIN = `https://${BLOG_PROJECT}.supabase.co`;
const MAX_BYTES = 32 * 1024 * 1024;
export const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')}}` : JSON.stringify(value);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
function exact(obj, names) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).sort().join(',') !== [...names].sort().join(',')) hold('SNAPSHOT_SCHEMA');
}
function timestamp(s) { if (typeof s !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(Date.parse(s))) hold('SNAPSHOT_DATE'); return Date.parse(s); }
export function validateSnapshot(s, now = Date.now()) {
  assertSafe(s);
  exact(s,['version','source','retrievedAt','complete','count','articles','contentHash',...(s.version===2?['completion']:[])]);
  exact(s.source,['kind','url','scope','queryVersion']);
  let url;try{url=new URL(s.source.url);}catch{hold('SNAPSHOT_SOURCE');}
  if (url.protocol!=='https:' || url.origin!==BLOG_ORIGIN || url.username || url.password || url.search || url.hash || url.pathname!=='/' || s.source.kind!=='blog-anon-readonly-select' || s.source.scope!=='all-publicly-readable-published-sealed' || s.source.queryVersion!==1) hold('SNAPSHOT_SOURCE');
  const age=now-timestamp(s.retrievedAt);
  if(age<0 || age>SNAPSHOT_MAX_AGE_MS)hold('SNAPSHOT_STALE');
  if(![1,2].includes(s.version) || s.complete!==true || !Array.isArray(s.articles) || !Number.isSafeInteger(s.count) || s.count<0 || s.count>10000 || s.count!==s.articles.length)hold('SNAPSHOT_INCOMPLETE');
  if(s.count===0 && s.version!==2)hold('SNAPSHOT_EMPTY_UNVERIFIED');
  if(s.version===2){
    const c=s.completion;
    exact(c,['projectId','role','query','before','after']);
    if(c.projectId!==BLOG_PROJECT||c.role!=='anon'||canonical(c.query)!==canonical(publicQuery(s.retrievedAt)))hold('SNAPSHOT_COMPLETION');
    for(const pages of [c.before,c.after]){
      if(!Array.isArray(pages)||pages.length<1||pages.length>51)hold('SNAPSHOT_COMPLETION');
      let rows=0;
      for(let i=0;i<pages.length;i++){
        const p=pages[i];exact(p,['status','start','end','total','rows']);
        if(![200,206].includes(p.status)||p.start!==i*200||p.end!==i*200+199||p.total!==s.count||!Number.isSafeInteger(p.rows)||p.rows<0||p.rows>200||(i<pages.length-1&&p.rows!==200))hold('SNAPSHOT_COMPLETION');
        rows+=p.rows;
      }
      if(rows!==s.count||pages.length!==Math.max(1,Math.ceil(s.count/200))||(s.count===0&&pages[0].status!==200))hold('SNAPSHOT_COMPLETION');
    }
    if(canonical(c.before)!==canonical(c.after))hold('SNAPSHOT_COMPLETION');
  }
  const ids=new Set(),slugs=new Set();
  for(const a of s.articles){
    exact(a,['id','revisionId','slug','state','publishedAt','title','text']);
    if(typeof a.id!=='string'||!a.id||typeof a.revisionId!=='string'||!a.revisionId||typeof a.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)||a.state!=='published'||typeof a.title!=='string'||!a.title.trim()||a.title.length>1000||typeof a.text!=='string'||!a.text.trim()||timestamp(a.publishedAt)>Date.parse(s.retrievedAt)||ids.has(a.id)||slugs.has(a.slug))hold('SNAPSHOT_ARTICLE');
    ids.add(a.id);slugs.add(a.slug);
  }
  const {contentHash,...payload}=s;
  if(!/^[a-f0-9]{64}$/.test(contentHash)||sha256(canonical(payload))!==contentHash)hold('SNAPSHOT_CONTENT_HASH');
  return s;
}
export function loadSnapshot(plan, now=Date.now()) {
  const path=externalPath(plan.snapshotPath);
  let bytes;try{const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_BYTES)hold('SNAPSHOT_FILE');bytes=readFileSync(path);}catch{hold('SNAPSHOT_MISSING_OR_FILE');}
  if(sha256(bytes)!==plan.snapshotHash)hold('SNAPSHOT_FILE_HASH');
  let s;try{s=JSON.parse(bytes.toString('utf8'));}catch{hold('SNAPSHOT_JSON');}
  validateSnapshot(s,now);
  return { articles:s.articles, metadata:{path,hash:plan.snapshotHash,source:s.source,retrievedAt:s.retrievedAt,count:s.count,contentHash:s.contentHash} };
}
function publicQuery(at){return {table:'blog_posts',columns:'id,slug,state,published_revision_id,first_published_at,last_published_at',state:'published',publishedRevision:'not-null',revisionState:'sealed',revisionBinding:'published_revision_id',firstPublishedAtLte:at,count:'exact',pageSize:200,order:'id'};}
export function sealSnapshot({source,retrievedAt,articles,completion}) {
  const payload={version:completion?2:1,source,retrievedAt,complete:true,count:articles.length,articles,...(completion?{completion}:{})};
  const s={...payload,contentHash:sha256(canonical(payload))};validateSnapshot(s,Date.parse(retrievedAt));return s;
}

// SELECT-only, exact counts, explicit pagination, and two matching publication inventories.
// The caller must supply the fixed BLOG project anon/RLS client, never a substitute project or service-role client.
export async function capturePublishedSnapshot({client,databaseOrigin,now=new Date(),timeoutMs=15000}) {
  // Reject the wrong project before any query; callers supply an anon/RLS-only client.
  if(databaseOrigin!==BLOG_ORIGIN)hold('SNAPSHOT_SOURCE');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)hold('SNAPSHOT_TIMEOUT_LIMIT');
  const at=now.toISOString();
  async function pages(table,columns,filter,proof){
    const all=[];let count;
    for(let start=0;;start+=200){
      const q=filter(client.from(table).select(columns,{count:'exact'})).order(table==='blog_blocks'?'position':'id').range(start,start+199);
      let timer,result;
      try{result=await Promise.race([q,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('HOLD:SNAPSHOT_TIMEOUT')),timeoutMs);})]);}
      catch{hold('SNAPSHOT_READ_FAILED');}finally{clearTimeout(timer);}
      if(![200,206].includes(result.status)||result.error||!Array.isArray(result.data)||!Number.isSafeInteger(result.count)||result.count<0||result.count>10000||(count!==undefined&&count!==result.count)||result.data.length>200)hold('SNAPSHOT_READ_FAILED');
      if(result.count===0&&result.status!==200)hold('SNAPSHOT_READ_FAILED');
      if(proof)proof.push({status:result.status,start,end:start+199,total:result.count,rows:result.data.length});
      count=result.count;all.push(...result.data);
      if(all.length>count)hold('SNAPSHOT_TRUNCATED');
      if(all.length===count)return all;
      if(result.data.length!==200)hold('SNAPSHOT_TRUNCATED');
    }
  }
  const posts=proof=>pages('blog_posts','id,slug,state,published_revision_id,first_published_at,last_published_at',q=>q.eq('state','published').not('published_revision_id','is',null).lte('first_published_at',at),proof);
  const beforeProof=[],afterProof=[];
  const before=await posts(beforeProof), articles=[];
  for(const post of before){
    if(post.state!=='published'||!post.published_revision_id)hold('SNAPSHOT_ARTICLE');
    const revisions=await pages('blog_post_revisions','id,post_id,state,title,excerpt',q=>q.eq('id',post.published_revision_id).eq('post_id',post.id).eq('state','sealed'));
    if(revisions.length!==1||revisions[0].id!==post.published_revision_id||revisions[0].post_id!==post.id||revisions[0].state!=='sealed')hold('SNAPSHOT_REVISION');
    const revision=revisions[0];
    const blocks=await pages('blog_blocks','id,revision_id,position,type,data',q=>q.eq('revision_id',revision.id));
    if(blocks.some(b=>b.revision_id!==revision.id)||new Set(blocks.map(b=>b.position)).size!==blocks.length)hold('SNAPSHOT_BLOCKS');
    const text=articleText({title:'',excerpt:'',blocks});
    articles.push({id:post.id,revisionId:revision.id,slug:post.slug,state:'published',publishedAt:post.first_published_at,title:revision.title,text});
  }
  const after=await posts(afterProof);if(canonical(before)!==canonical(after))hold('SNAPSHOT_CHANGED_DURING_CAPTURE');
  return sealSnapshot({source:{kind:'blog-anon-readonly-select',url:new URL(databaseOrigin).origin,scope:'all-publicly-readable-published-sealed',queryVersion:1},retrievedAt:at,articles,completion:{projectId:BLOG_PROJECT,role:'anon',query:publicQuery(at),before:beforeProof,after:afterProof}});
}
// This is a local credential-type guard, not signature authentication. The remote
// service authenticates the key; a supplied test client is part of the trusted caller.
export function assertAnonCredential(key){
  if(typeof key!=='string')hold('BLOG_ANON_REQUIRED');
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return;
  try{
    const parts=key.split('.');
    if(parts.length!==3)hold('BLOG_ANON_REQUIRED');
    const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
    if(claims.role!=='anon'||(claims.ref!==undefined&&claims.ref!==BLOG_PROJECT))hold('BLOG_ANON_REQUIRED');
  }catch{hold('BLOG_ANON_REQUIRED');}
}
export function writeSnapshot(s,path){
  validateSnapshot(s);externalPath(path);if(existsSync(path))hold('SNAPSHOT_EXISTS');
  const text=assertSafe(JSON.stringify(s,null,2));if(Buffer.byteLength(text)>MAX_BYTES)hold('SNAPSHOT_TOO_LARGE');
  mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,text+'\n',{flag:'wx',mode:0o600});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4||process.argv[2]!=='capture')hold('SNAPSHOT_CAPTURE_ARGUMENTS');
    if(Number(process.versions.node.split('.')[0])!==24||!process.execArgv.includes('--use-env-proxy'))hold('NODE24_PROXY_REQUIRED');
    const url=process.env.BLOG_SUPABASE_URL,key=process.env.BLOG_SUPABASE_ANON_KEY;
    if(!url||!key)hold('BLOG_READONLY_ACCESS_REQUIRED');
    if(url!==BLOG_ORIGIN||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')hold('TLS_REQUIRED');
    assertAnonCredential(key);
    const {createClient}=await import('@supabase/supabase-js');
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
    const s=await capturePublishedSnapshot({client,databaseOrigin:url});assertSafe(s,[key]);writeSnapshot(s,resolve(process.argv[3]));
    console.log(`PASS: readonly snapshot captured; count=${s.count}`);
  }catch{console.error('HOLD: published BLOG snapshot not captured; no partial snapshot accepted');process.exitCode=1;}
}

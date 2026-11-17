import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';

// Offline integration of the actual pinned supabase-js package, not a fake client.
// Install package into an isolated temp directory in CI; never use a real project key.
const clientDir=process.env.PR301_CLIENT_DIR;
assert.ok(clientDir && clientDir.startsWith('/tmp/pr301-'), 'Isolated dependency directory required');
const require=createRequire(join(clientDir,'package.json'));
const {createClient}=require('@supabase/supabase-js');
const calls=[];
let mode='matched';
const fakeFetch=async (url,options)=>{
  const method=options.method;
  const u=new URL(String(url));
  assert.equal(u.hostname,'example.supabase.co');
  assert.equal(u.pathname,'/rest/v1/hatsune_news_cron_runs');
  assert.equal(method,'PATCH');
  assert.equal(u.searchParams.get('id'),'eq.42');
  assert.equal(u.searchParams.get('select'),'id');
  assert.equal(options.headers.get('prefer'),'return=representation');
  calls.push({method,mode});
  const status=mode==='denied'?403:200;
  const payload=mode==='matched'?[{id:42}]:mode==='missing'?[]:{code:'42501',message:'permission denied'};
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});
};
const client=createClient('https://example.supabase.co','offline-test-key',{
 global:{fetch:fakeFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
for(const [scenario,expectedData,expectedError] of [
 ['matched',{id:42},false],
 ['missing',null,false],
 ['denied',null,true]
]){
 test('supabase-js maybeSingle '+scenario,async()=>{
  mode=scenario;
  const {data,error}=await client.from('hatsune_news_cron_runs')
   .update({status:'success',inserted_count:2}).eq('id',42).select('id').maybeSingle();
  assert.deepEqual(data,expectedData);
  assert.equal(Boolean(error),expectedError);
  if(error)assert.equal(error.code,'42501');
  assert.equal(calls.at(-1).mode,scenario);
 });
}

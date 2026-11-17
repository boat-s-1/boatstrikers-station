import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Real runner, mocked fetch. No outbound network, no credentials, no DB writes.
const runner=new URL('./hatsune-cron-postgrest-http.mjs',import.meta.url).pathname;
const cases=[
 ['success','success',0,['POST','PATCH','PATCH','PATCH','PATCH','PATCH','DELETE']],
 ['matched update rejected','bad-patch',1,['POST','PATCH','DELETE']],
 ['zero-match returns unexpected row','bad-zero',1,['POST','PATCH','PATCH','DELETE']],
 ['singular matched response is not an object','bad-singular',1,['POST','PATCH','PATCH','PATCH','DELETE']],
 ['singular missing response is not 406','bad-singular-zero',1,['POST','PATCH','PATCH','PATCH','PATCH','DELETE']],
 ['anonymous update unexpectedly permitted','bad-anon',1,['POST','PATCH','PATCH','PATCH','PATCH','PATCH','DELETE']],
 ['cleanup HTTP failure is fatal','bad-delete',1,['POST','PATCH','PATCH','PATCH','PATCH','PATCH','DELETE']],
];
for(const [name,mode,expectedExit,methods] of cases){
 test(name,()=>{
  const dir=mkdtempSync(join(tmpdir(),'pr301-http-'));
  const preloader=join(dir,'mock-fetch.mjs'),log=join(dir,'calls.jsonl');
  writeFileSync(preloader,`import{appendFileSync}from'node:fs';
let patch=0;
globalThis.fetch=async(url,opts)=>{
 const method=opts.method;
 appendFileSync(process.env.MOCK_LOG,JSON.stringify({method,url})+'\\n');
 let status=200,data=[];
 if(method==='POST'){status=201;data=[{id:42}];}
 if(method==='PATCH'){
  patch++;
  if(patch===1){status=process.env.MOCK_MODE==='bad-patch'?403:200;data=[{id:42,status:'success',inserted_count:2}];}
  else if(patch===2){data=process.env.MOCK_MODE==='bad-zero'?[{id:42}]:[];}
  else if(patch===3){status=200;data=process.env.MOCK_MODE==='bad-singular'?[{id:42}]:{id:42};}
  else if(patch===4){status=process.env.MOCK_MODE==='bad-singular-zero'?200:406;data={code:'PGRST116'};}
  else{status=process.env.MOCK_MODE==='bad-anon'?200:403;}
 }
 if(method==='DELETE'){status=process.env.MOCK_MODE==='bad-delete'?403:200;data=process.env.MOCK_MODE==='bad-delete'?{code:'42501'}:[{id:42}];}
 return {status,text:async()=>data===null?'':JSON.stringify(data)};
};`);
  try{
   const result=spawnSync(process.execPath,['--import',preloader,runner],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,PR301_BRANCH_REF:'abcdefghijklmnopqrst',PR301_BRANCH_SERVICE_KEY:'mock-service-only',PR301_BRANCH_ANON_KEY:'mock-anon-only',MOCK_MODE:mode,MOCK_LOG:log}
   });
   assert.equal(result.status,expectedExit,result.stderr);
   const calls=readFileSync(log,'utf8').trim().split('\n').map(x=>JSON.parse(x));
   assert.deepEqual(calls.map(x=>x.method),methods);
   assert.ok(calls.every(x=>x.url.startsWith('https://abcdefghijklmnopqrst.supabase.co/rest/v1/')));
   assert.ok(!result.stdout.includes('mock-service-only'));
   assert.ok(!result.stderr.includes('mock-service-only'));
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
}

test('production ref is rejected before any HTTP request',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pr301-prod-'));
 const preloader=join(dir,'forbid-fetch.mjs');
 writeFileSync(preloader,"globalThis.fetch=()=>{throw Error('HTTP MUST NOT RUN')};");
 try{
  const result=spawnSync(process.execPath,['--import',preloader,runner],{
   encoding:'utf8',timeout:10000,
   env:{...process.env,PR301_BRANCH_REF:'rzosrbkyniyedolhkgxo',PR301_BRANCH_SERVICE_KEY:'mock-service-only'}
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/nonproduction branch ref is required/);
  assert.ok(!result.stderr.includes('HTTP MUST NOT RUN'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

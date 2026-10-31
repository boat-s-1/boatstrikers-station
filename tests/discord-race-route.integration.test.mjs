import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the actual route module with injected Discord/Supabase boundaries.
// No network calls, credentials, production DB, or Discord server required.
const path="app/api/cron/discord-race-threads/route.js";
const source=readFileSync(path,"utf8")
  .replace(/^import .*;\s*$/gm,"")
  .replace(/^export const /gm,"const ")
  .replace("export async function GET(request)","async function GET(request)");
const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const alert={id:1,race_date:date,course_code:"01",course_name:"桐生",race_no:1,closing_time:"12:00",detected_at:"now"};
function fixture({timeoutKey=null}={}){
  const state=new Map(),calls=[],threads=[];
  let sequence=0;
  const keyOf=(a)=>[a.race_date,a.course_code,a.race_no,a.message_key].join(":");
  const admin={
    rpc:async (_name,args)=>{
      const k=keyOf({race_date:args.p_race_date,course_code:args.p_course_code,race_no:args.p_race_no,message_key:args.p_message_key});
      if(state.has(k))return {data:false,error:null};
      state.set(k,{state:"sending"});return {data:true,error:null};
    },
    from(table){
      if(table!=="bs_discord_race_thread_deliveries"){
        return {select(){return this},eq(){return this},order(){return this},limit:async()=>({data:table==="bs_exhibition_alerts"?[alert]:[],error:null})};
      }
      return {update(value){this.value=value;return this},match(identity){this.identity=identity;return this},eq(){return this},\n        maybeSingle:async function(){return {data:state.get(keyOf(this.identity))||null,error:null}},
        async select(){const k=keyOf(this.identity),previous=state.get(k);
          if(previous?.state!=="sending")return {data:[],error:null};
          state.set(k,{...previous,...this.value});return {data:[{id:1}],error:null};},
        then(resolve){const k=keyOf(this.identity),previous=state.get(k);if(previous?.state==="sending")state.set(k,{...previous,...this.value});return Promise.resolve({error:null}).then(resolve);}
      };
    }
  };
  const mockDiscordApi=async (endpoint,opts)=>{
    if(endpoint.includes("/channels")&&endpoint.endsWith("/threads")&&opts?.method==="POST"){
      calls.push("thread");const t={id:"t"+(++sequence),name:opts.body.name,parent_id:"channel",type:11};threads.push(t);return t;
    }
    if(endpoint.endsWith("/threads/active"))return {threads:[...threads]};\n    if(endpoint.startsWith("/channels/t"))return threads.find(t=>"/channels/"+t.id===endpoint)||null;
    if(endpoint.endsWith("/channels"))return [{id:"channel",name:"レース実況",type:0}];
    if(endpoint.endsWith("/webhooks"))return ["一果","初音","キイナ"].map((name,i)=>({id:"webhook-"+i,token:"mock",avatar:"avatar",name:"BSC 実況 "+name}));
    return [];
  };
  const sandbox={
    NextResponse:{json:(body,options={})=>({body,status:options.status||200})},
    isDiscordAlertsCronAuthorized:()=>true,
    readFile:async()=>"",
    path:{join:()=>""},
    process:{cwd:()=>""},
    discordApi:mockDiscordApi,
    discordConfig:()=>({guildId:"guild"}),
    getAdminClient:()=>admin,
    sendDiscordMessage:async()=>{calls.push("starter");if(timeoutKey==="starter")throw Error("timeout");return {id:"starter-id"}},
    fetch:async(url,opts)=>{
      if(opts?.method==="PATCH")return {ok:false};
      const hookId=String(url).split("/webhooks/")[1]?.split("/")[0];
      const role=({ "webhook-0":"ichika", "webhook-1":"hatsune", "webhook-2":"kiina" })[hookId];
      calls.push("character:"+role);
      if(timeoutKey===role)throw Error("timeout");
      return {ok:true,json:async()=>({id:"msg-"+role})};
    },
    AbortSignal,Date,Intl,Map,Set,JSON,String,Number,Error,console,
  };
  vm.runInNewContext(source+"\nthis.routeGET=GET;",sandbox,{filename:path});
  return {GET:sandbox.routeGET,calls,state,threads};
}
test("full route: concurrent runs do not duplicate thread/starter/characters",async()=>{
  const f=fixture();
  await Promise.all([f.GET({}),f.GET({})]);
  assert.equal(f.calls.filter(x=>x==="thread").length,1);
  assert.equal(f.calls.filter(x=>x==="starter").length,1);
  for(const role of ["ichika","hatsune","kiina"])
    assert.equal(f.calls.filter(x=>x==="character:"+role).length,1);
});
test("full route: rerun does not duplicate posts",async()=>{
  const f=fixture();await f.GET({});await f.GET({});
  assert.equal(f.calls.length,5);
  for(const stage of ["thread","starter","ichika","hatsune","kiina"]){
    const entry=f.state.get([date,"01",1,stage].join(":"));
    assert.equal(entry?.state,"sent",stage);
    assert.ok(entry?.discord_thread_id,stage);
    if(stage!=="thread")assert.ok(entry?.discord_message_id,stage);
  }
});
test("full route: starter timeout is not automatically retried",async()=>{
  const f=fixture({timeoutKey:"starter"});await f.GET({});await f.GET({});
  assert.equal(f.calls.filter(x=>x==="starter").length,1);
});
test("full route: partial character timeout does not duplicate successful posts",async()=>{
  const f=fixture({timeoutKey:"hatsune"});await f.GET({});await f.GET({});
  assert.equal(f.calls.filter(x=>x==="character:ichika").length,1);
  assert.equal(f.calls.filter(x=>x==="character:hatsune").length,1);
});

test("history says sent but active Discord thread is missing: safe defer, no duplicate",async()=>{
  const f=fixture();
  const key=[date,"01",1,"thread"].join(":");
  f.state.set(key,{state:"sent",discord_thread_id:"archived-or-deleted"});
  const result=await f.GET({});
  assert.equal(result.body.deferred,1);
  assert.equal(result.body.created,0);
  assert.equal(result.body.failed,0);
  assert.equal(f.calls.length,0);
  assert.equal(f.state.get(key).discord_thread_id,"archived-or-deleted");
});
test("history says unknown but active Discord thread is missing: safe defer",async()=>{
  const f=fixture();
  const key=[date,"01",1,"thread"].join(":");
  f.state.set(key,{state:"unknown"});
  const result=await f.GET({});
  assert.equal(result.body.deferred,1);
  assert.equal(f.calls.length,0);
});

test("archived persisted thread: no automatic post",async()=>{
  const f=fixture();
  await f.GET({});
  f.threads[0].thread_metadata={archived:true};
  const before=f.calls.length;
  const result=await f.GET({});
  assert.equal(result.body.deferred,1);
  assert.equal(f.calls.length,before);
});
test("wrong parent for persisted thread: no automatic post",async()=>{
  const f=fixture();
  await f.GET({});
  f.threads[0].parent_id="other-channel";
  const before=f.calls.length;
  const result=await f.GET({});
  assert.equal(result.body.deferred,1);
  assert.equal(f.calls.length,before);
});
test("unavailable persisted thread: no automatic post",async()=>{
  const f=fixture();
  await f.GET({});
  f.threads.length=0;
  const before=f.calls.length;
  const result=await f.GET({});
  assert.equal(result.body.deferred,1);
  assert.equal(f.calls.length,before);
});

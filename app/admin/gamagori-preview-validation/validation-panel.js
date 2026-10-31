'use client';
import {useRef,useState} from 'react';
const actions={
 monitor:{path:'/api/admin/gamagori-chart-monitor'},
 readiness:{path:'/api/admin/gamagori-chart-readiness'},
 observe:{path:'/api/admin/gamagori-chart-observe',method:'POST',body:'{"race":1}'},
 concurrent:{path:'/api/cron/gamagori-chart-orchestrate',concurrent:true},
 network:{path:'/api/admin/gamagori-network-diagnostic'},
 networkJapan:{path:'/api/admin/gamagori-network-diagnostic-japan'}
};
export default function ValidationPanel(){
 const secret=useRef(null);const [busy,setBusy]=useState(false),[result,setResult]=useState(null);
 async function run(name){if(busy)return;const credential=secret.current?.value??'';if(!credential)return;
 setBusy(true);setResult(null);
 try{const action=actions[name];const once=async()=>{const started=Date.now();const response=await fetch(action.path,{method:action.method??'GET',headers:{Authorization:`Bearer ${credential}`,...(action.body?{'Content-Type':'application/json'}:{})},body:action.body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(65000)});const text=await response.text();let body;try{body=JSON.parse(text);}catch{body={error:'non_json_response'};}return {status:response.status,ms:Date.now()-started,body};};
 const value=action.concurrent?await Promise.all([once(),once()]):await once();setResult(JSON.stringify({action:name,result:value},null,2).split(credential).join('[REDACTED]'));
 }catch{setResult(JSON.stringify({action:name,error:'request_failed'}));}finally{setBusy(false);}
 }
 return <main style={{padding:24,maxWidth:960,margin:'auto'}}><h1>蒲郡 Preview統合検証</h1><p>対象ブランチ専用。既存APIの認証は変更しません。キーは保存・表示しません。</p><label>Collector secret <input aria-label="Collector secret" ref={secret} type="password" autoComplete="off"/></label><p>{Object.keys(actions).map(name=><button disabled={busy} key={name} onClick={()=>run(name)} style={{margin:6}}>{name}</button>)}<button disabled={busy} onClick={()=>{secret.current.value='';setResult(null);}}>Clear</button></p><pre aria-label="Validation result" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{busy?'実行中':result}</pre></main>;
}

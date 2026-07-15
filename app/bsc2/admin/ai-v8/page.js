"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "./ai-v8.css";

const STADIUMS={1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"};
const ACTIONS=[["run_product_daily","今日の総合予測を更新"],["generate_ensemble","総合判定だけ再生成"],["train_all_characters","3AIを一括再学習"]];

export default function AiV8Page(){
  const [key,setKey]=useState("");
  const [ok,setOk]=useState(false);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [running,setRunning]=useState("");

  useEffect(()=>{const saved=sessionStorage.getItem("bsc-ai-admin-key");if(saved){setKey(saved);setOk(true);}},[]);

  const api=useCallback(async(url,options={})=>{
    const res=await fetch(url,{...options,headers:{...(options.headers||{}),"x-bsc-ai-key":key},cache:"no-store"});
    const json=await res.json();
    if(!res.ok) throw new Error(json?.error||"通信エラー");
    return json;
  },[key]);

  const load=useCallback(async()=>{
    if(!ok||!key)return;
    try{setData(await api(`/api/bsc2/ai-v8/dashboard?date=${date}`));setError("");}
    catch(e){setError(e.message);}
  },[api,date,key,ok]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(!ok)return;const t=setInterval(load,8000);return()=>clearInterval(t);},[ok,load]);

  const login=()=>{if(!key.trim())return setError("AI管理キーを入力してください");sessionStorage.setItem("bsc-ai-admin-key",key.trim());setOk(true);};
  const run=async(job)=>{setRunning(job);try{await api("/api/bsc2/ai-v8/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job_type:job})});await load();}catch(e){setError(e.message);}finally{setRunning("");}};

  if(!ok)return <main className="v8Page"><section className="v8Login"><div>🤖</div><p>BOAT STRIKERS AI ULTIMATE v8</p><h1>製品版</h1><input type="password" value={key} placeholder="AI管理キー" onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>{error&&<strong>{error}</strong>}<button onClick={login}>管理画面を開く</button><Link href="/bsc2/admin">← 戻る</Link></section></main>;

  const predictions=data?.predictions||[];
  const summary=data?.summary||{};

  return <main className="v8Page">
    <header className="v8Header"><Link href="/bsc2/admin">←</Link><div><p>BOAT STRIKERS AI ULTIMATE v8</p><h1>PRODUCT CONTROL CENTER</h1></div><button onClick={()=>{sessionStorage.removeItem("bsc-ai-admin-key");location.reload();}}>ログアウト</button></header>
    {error&&<div className="v8Error">{error}</div>}
    <section className="v8Hero"><div><span className={data?.system_status?.worker_online?"online":"offline"}>● WORKER {data?.system_status?.worker_online?"ONLINE":"OFFLINE"}</span><h2>3AI総合判定</h2><p>一果・初音・キイナの予測を統合して、今日の注目レースを表示します。</p></div><button onClick={load}>最新状態へ更新</button></section>

    <section className="v8Stats">
      <article><span>予測</span><strong>{summary.prediction_count||0}</strong></article>
      <article><span>実戦候補</span><strong>{summary.actionable_count||0}</strong></article>
      <article><span>S以上</span><strong>{summary.high_confidence_count||0}</strong></article>
      <article><span>結果確定</span><strong>{summary.settled_count||0}</strong></article>
    </section>

    <section className="v8Actions">
      {ACTIONS.map(([job,label])=><button key={job} disabled={running===job} onClick={()=>run(job)}>{running===job?"登録中...":label}</button>)}
    </section>

    <section className="v8Section">
      <div className="v8SectionHead"><h2>今日の総合ランキング</h2><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div className="v8List">
        {predictions.length===0?<div className="empty">この日の総合予測はありません。</div>:predictions.map((p,i)=><article key={p.id}>
          <div className="place">{i+1}</div>
          <div><span>{p.race_date}</span><h3>{STADIUMS[p.stadium_code]||`場${p.stadium_code}`}{p.race_no}R</h3></div>
          <div className="label">{p.recommendation_label}</div>
          <div className="score">{Number(p.confidence_score).toFixed(1)}</div>
          <div className="rank">{p.confidence_rank}</div>
          <div className="ais">
            <span>一果 {p.ichika_probability==null?"—":`${(Number(p.ichika_probability)*100).toFixed(1)}%`}</span>
            <span>初音 {p.hatsune_probability==null?"—":`${(Number(p.hatsune_probability)*100).toFixed(1)}%`}</span>
            <span>キイナ {p.kiina_probability==null?"—":`${(Number(p.kiina_probability)*100).toFixed(1)}%`}</span>
          </div>
        </article>)}
      </div>
    </section>

    <section className="v8Section"><h2>処理履歴</h2><div className="v8Jobs">{(data?.jobs||[]).map(j=><article key={j.id}><div><strong>{j.job_type}</strong><span>{j.error_message||j.message||"処理待ち"}</span></div><b className={j.status}>{j.status}</b><div className="progress"><span style={{width:`${j.progress||0}%`}}/></div></article>)}</div></section>
  </main>;
}

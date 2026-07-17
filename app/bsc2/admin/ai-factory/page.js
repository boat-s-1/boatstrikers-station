"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./factory.module.css";

const KEY = "bsc_ai_admin_key";
const CHARS = { ichika:"一果", hatsune:"初音", kiina:"キイナ" };
const TIMINGS = { previous_day:"前日版", after_exhibition:"展示後版" };

function f(v,d=3){ return v===null||v===undefined ? "—" : Number(v).toFixed(d); }
function dt(v){ if(!v)return "—"; const d=new Date(v); return Number.isNaN(d.getTime())?String(v):d.toLocaleString("ja-JP"); }
async function json(res){ const t=await res.text(); let b; try{b=JSON.parse(t);}catch{throw new Error(`API応答エラー HTTP ${res.status}`)} if(!res.ok)throw new Error(b.error||"処理失敗"); return b; }

export default function AiFactoryPage(){
  const [adminKey,setAdminKey]=useState("");
  const [keyInput,setKeyInput]=useState("");
  const [models,setModels]=useState([]);
  const [jobs,setJobs]=useState([]);
  const [summary,setSummary]=useState(null);
  const [workers,setWorkers]=useState([]);
  const [events,setEvents]=useState([]);
  const [character,setCharacter]=useState("ichika");
  const [timing,setTiming]=useState("previous_day");
  const [filterCharacter,setFilterCharacter]=useState("all");
  const [filterTiming,setFilterTiming]=useState("all");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    const k=sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||"";
    setAdminKey(k); setKeyInput(k);
  },[]);

  const load=useCallback(async()=>{
    if(!adminKey)return;
    setLoading(true); setMessage("");
    try{
      const qs=new URLSearchParams({character:filterCharacter,timing:filterTiming});
      const [m,j,s]=await Promise.all([
        fetch(`/api/bsc2/ai-factory/models?${qs}`,{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"}),
        fetch("/api/bsc2/ai-factory/jobs",{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"}),
        fetch("/api/bsc2/ai-factory/status",{headers:{"x-bsc-ai-key":adminKey},cache:"no-store"}),
      ]);
      const [mb,jb,sb]=await Promise.all([json(m),json(j),json(s)]);
      setModels(mb.models||[]); setJobs(jb.jobs||[]); setSummary(jb.summary||null);
      setWorkers(sb.workers||[]); setEvents(sb.events||[]);
    }catch(e){setMessage(e.message);}finally{setLoading(false);}
  },[adminKey,filterCharacter,filterTiming]);

  useEffect(()=>{ if(!adminKey)return; load(); const id=setInterval(load,5000); return()=>clearInterval(id); },[adminKey,load]);

  async function createTraining(){
    setMessage("学習ジョブを登録中…");
    try{
      const res=await fetch("/api/bsc2/ai-factory/jobs",{method:"POST",headers:{"Content-Type":"application/json","x-bsc-ai-key":adminKey},body:JSON.stringify({characterCode:character,dataTiming:timing,compareActive:true})});
      const body=await json(res); setMessage(`登録完了: ${body.job.id.slice(0,8)}`); load();
    }catch(e){setMessage(e.message);}
  }

  async function action(actionName,payload){
    setMessage("操作を登録中…");
    try{
      await json(await fetch("/api/bsc2/ai-factory/actions",{method:"POST",headers:{"Content-Type":"application/json","x-bsc-ai-key":adminKey},body:JSON.stringify({action:actionName,...payload})}));
      setMessage("操作を登録しました"); load();
    }catch(e){setMessage(e.message);}
  }

  const activeMap=useMemo(()=>{
    const m={}; for(const x of models){ if(x.is_active)m[`${x.character_code}-${x.data_timing}`]=x; } return m;
  },[models]);

  if(!adminKey){
    return <main className={styles.login}><form onSubmit={e=>{e.preventDefault();const v=keyInput.trim();if(v){sessionStorage.setItem(KEY,v);setAdminKey(v)}}}>
      <span>BOAT STRIKERS AI</span><h1>AI Factory</h1><p>モデルの学習・比較・採用・ロールバックを管理します。</p>
      <input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="AI管理キー"/>
      <button>AI Factoryを開く</button><Link href="/bsc2/admin">管理画面へ戻る</Link>
    </form></main>;
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>BOAT STRIKERS AI FACTORY v1</span><h1>AI Factory</h1><p>新モデルを学習し、現行モデルと比較して安全に採用します。</p></div>
      <nav><Link href="/bsc2/admin/ai-control">Control Center</Link><Link href="/bsc2/admin/ai-dashboard">Dashboard</Link><button onClick={load}>{loading?"更新中…":"更新"}</button></nav>
    </header>

    {message&&<div className={styles.message}>{message}</div>}

    <section className={styles.summary}>
      <article><span>総モデル</span><strong>{summary?.total_models||0}</strong></article>
      <article><span>本番採用</span><strong>{summary?.active_models||0}</strong></article>
      <article><span>候補</span><strong>{summary?.candidate_models||0}</strong></article>
      <article><span>Factory Worker</span><strong>{workers[0]?.health_status==="online"?"ONLINE":"OFFLINE"}</strong></article>
    </section>

    <section className={styles.panel}>
      <div className={styles.heading}><div><span>TRAINING</span><h2>新モデルを学習</h2></div></div>
      <div className={styles.trainBox}>
        <label>キャラクター<select value={character} onChange={e=>setCharacter(e.target.value)}>{Object.entries(CHARS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>タイミング<select value={timing} onChange={e=>setTiming(e.target.value)}>{Object.entries(TIMINGS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <button onClick={createTraining}>学習ジョブを登録</button>
      </div>
      <div className={styles.activeGrid}>
        {Object.keys(CHARS).flatMap(c=>Object.keys(TIMINGS).map(t=>{
          const m=activeMap[`${c}-${t}`];
          return <article key={`${c}-${t}`}><small>{CHARS[c]}・{TIMINGS[t]}</small><strong>{m?.model_version||"未採用"}</strong><span>Brier {f(m?.brier)} / AUC {f(m?.auc)}</span></article>
        }))}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.heading}><div><span>MODEL REGISTRY</span><h2>モデル比較</h2></div>
        <div className={styles.filters}>
          <select value={filterCharacter} onChange={e=>setFilterCharacter(e.target.value)}><option value="all">全AI</option>{Object.entries(CHARS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          <select value={filterTiming} onChange={e=>setFilterTiming(e.target.value)}><option value="all">全タイミング</option>{Object.entries(TIMINGS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        </div>
      </div>
      <div className={styles.modelList}>
        {models.map(m=><article className={`${styles.modelCard} ${m.is_active?styles.active:""}`} key={m.id}>
          <div><span className={styles.badge}>{m.is_active?"本番":"候補"}</span><h3>{CHARS[m.character_code]}・{TIMINGS[m.data_timing]}</h3><p>{m.model_version}</p><small>{dt(m.created_at)}</small></div>
          <div className={styles.metrics}><span>AUC<strong>{f(m.auc)}</strong></span><span>Brier<strong>{f(m.brier)}</strong></span><span>LogLoss<strong>{f(m.logloss)}</strong></span><span>Accuracy<strong>{f(m.accuracy)}</strong></span></div>
          <div className={styles.actions}>{!m.is_active&&<button onClick={()=>action("activate",{modelId:m.id})}>採用</button>}<button className={styles.secondary} onClick={()=>action("archive",{modelId:m.id})}>保管</button></div>
        </article>)}
        {!models.length&&<div className={styles.empty}>登録モデルはありません。</div>}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.heading}><div><span>FACTORY QUEUE</span><h2>学習・採用ジョブ</h2></div></div>
      <div className={styles.jobList}>{jobs.map(j=><article key={j.id}><div><b>{j.job_type}</b><span>{CHARS[j.character_code]||"—"}・{TIMINGS[j.data_timing]||"—"}</span></div><div className={styles.progress}><i style={{width:`${j.progress_percent||0}%`}}/></div><strong>{j.status} {j.progress_percent||0}%</strong>{j.status==="failed"&&<button onClick={()=>action("retry",{jobId:j.id})}>再実行</button>}<small>{j.progress_message||j.error_message}</small></article>)}</div>
    </section>

    <section className={styles.panel}>
      <div className={styles.heading}><div><span>EVENT LOG</span><h2>Factoryログ</h2></div></div>
      <div className={styles.events}>{events.map(e=><p key={e.id}><time>{dt(e.created_at)}</time><b>{e.level}</b><span>{e.message}</span></p>)}</div>
    </section>
  </main>;
}

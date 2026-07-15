"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ai-v6.css";

const META = {
  ichika: { icon:"🍀", name:"一果AI", specialty:"イン逃げ専門", job:"train_ichika_v3" },
  hatsune:{ icon:"🎀", name:"初音AI", specialty:"女子戦専門", job:"train_hatsune_v1" },
  kiina:  { icon:"⭐", name:"キイナAI", specialty:"5アタマ専門", job:"train_kiina_v1" },
};

function metric(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(4):"—";}

export default function AiV6Page(){
  const [key,setKey]=useState("");
  const [ok,setOk]=useState(false);
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [running,setRunning]=useState("");

  useEffect(()=>{
    const saved=sessionStorage.getItem("bsc-ai-admin-key");
    if(saved){setKey(saved);setOk(true);}
  },[]);

  const api=useCallback(async(url,options={})=>{
    const res=await fetch(url,{
      ...options,
      headers:{...(options.headers||{}),"x-bsc-ai-key":key},
      cache:"no-store",
    });
    const json=await res.json();
    if(!res.ok) throw new Error(json?.error||"通信エラー");
    return json;
  },[key]);

  const load=useCallback(async()=>{
    if(!ok||!key)return;
    try{
      setData(await api("/api/bsc2/ai-v6/dashboard"));
      setError("");
    }catch(e){setError(e.message);}
  },[api,key,ok]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    if(!ok)return;
    const timer=setInterval(load,8000);
    return()=>clearInterval(timer);
  },[ok,load]);

  const login=()=>{
    if(!key.trim())return setError("AI管理キーを入力してください");
    sessionStorage.setItem("bsc-ai-admin-key",key.trim());
    setOk(true);
  };

  const run=async(job)=>{
    setRunning(job);
    try{
      await api("/api/bsc2/ai-v6/jobs",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({job_type:job}),
      });
      await load();
    }catch(e){setError(e.message);}
    finally{setRunning("");}
  };

  const models=useMemo(()=>{
    const map={};
    (data?.models||[]).forEach(m=>{
      map[`${m.character}-${m.data_timing}`]=m;
    });
    return map;
  },[data]);

  const summary=useMemo(()=>{
    const map={};
    (data?.summary||[]).forEach(s=>{map[s.character_code]=s;});
    return map;
  },[data]);

  if(!ok){
    return <main className="v6Page"><section className="v6Login">
      <div>🤖</div><p>BOAT STRIKERS AI v6</p><h1>3AI統合管理</h1>
      <input type="password" value={key} placeholder="AI管理キー"
        onChange={e=>setKey(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&login()} />
      {error&&<strong>{error}</strong>}
      <button onClick={login}>管理画面を開く</button>
      <Link href="/bsc2/admin">← 通常の管理画面へ戻る</Link>
    </section></main>;
  }

  return <main className="v6Page">
    <header className="v6Header">
      <Link href="/bsc2/admin">←</Link>
      <div><p>BOAT STRIKERS AI v6</p><h1>THREE BRAINS CONTROL</h1></div>
      <button onClick={()=>{sessionStorage.removeItem("bsc-ai-admin-key");location.reload();}}>ログアウト</button>
    </header>

    {error&&<div className="v6Error">{error}</div>}

    <section className="v6Hero">
      <div>
        <span className={data?.system_status?.worker_online?"online":"offline"}>
          ● WORKER {data?.system_status?.worker_online?"ONLINE":"OFFLINE"}
        </span>
        <h2>3人のAIを一括管理</h2>
        <p>一果・初音・キイナが、それぞれ異なる専門分野で予測します。</p>
      </div>
      <button onClick={load}>最新状態へ更新</button>
    </section>

    <section className="v6Brains">
      {Object.entries(META).map(([code,meta])=>{
        const pre=models[`${code}-previous_day`];
        const aft=models[`${code}-after_exhibition`];
        const sum=summary[code];
        return <article className={`v6Brain ${code}`} key={code}>
          <div className="v6BrainHead">
            <div className="v6Icon">{meta.icon}</div>
            <div><h2>{meta.name}</h2><p>{meta.specialty}</p></div>
          </div>
          <div className="v6ModelRow">
            <Model label="前日版" model={pre}/>
            <Model label="直前版" model={aft}/>
          </div>
          <div className="v6Summary">
            <span>予測 {Number(sum?.prediction_count||0).toLocaleString()}件</span>
            <span>確定 {Number(sum?.settled_count||0).toLocaleString()}件</span>
            <span>正解率 {sum?.accuracy_percent??"—"}%</span>
          </div>
          <button disabled={running===meta.job} onClick={()=>run(meta.job)}>
            {running===meta.job?"依頼登録中...":`${meta.name}を再学習`}
          </button>
          {code==="hatsune"&&<small>
            初音AIはrace_entries.racer_genderの女子データが必要です。
          </small>}
        </article>;
      })}
    </section>

    <section className="v6All">
      <div><h2>3AIをまとめて再学習</h2>
      <p>一果 → キイナ → 初音の順で学習します。</p></div>
      <button disabled={running==="train_all_characters"}
        onClick={()=>run("train_all_characters")}>
        {running==="train_all_characters"?"依頼登録中...":"3AI一括学習"}
      </button>
    </section>

    <section className="v6Jobs">
      <h2>処理履歴</h2>
      {(data?.jobs||[]).map(job=><article key={job.id}>
        <div><strong>{job.job_type}</strong><span>{job.message||"処理待ち"}</span></div>
        <b className={job.status}>{job.status}</b>
        <div className="progress"><span style={{width:`${job.progress||0}%`}}/></div>
      </article>)}
    </section>
  </main>;
}

function Model({label,model}){
  return <div className="v6Model">
    <strong>{label}</strong>
    <span>{model?.model_type||"未学習"}</span>
    <dl><div><dt>AUC</dt><dd>{metric(model?.auc)}</dd></div>
    <div><dt>Brier</dt><dd>{metric(model?.brier_score)}</dd></div></dl>
    <small>{model?.model_version||"モデルなし"}</small>
  </div>;
}

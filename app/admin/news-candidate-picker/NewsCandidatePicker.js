"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NewsCandidatePicker.module.css";

const CHARACTER_LABELS = { ichika:"一果", kiina:"キイナ", hatsune:"初音" };

export default function NewsCandidatePicker({ character, date, edition, onSelect }) {
  const [candidates,setCandidates]=useState([]);
  const [selected,setSelected]=useState("");
  const [status,setStatus]=useState("loading");
  const timing=edition==="just_before"?"after_exhibition":"previous_day";
  const label=CHARACTER_LABELS[character]||character;

  useEffect(()=>{
    let alive=true;
    async function load(){
      setStatus("loading");
      setSelected("");
      try{
        const qs=new URLSearchParams({date,timing});
        const res=await fetch("/api/admin/"+character+"-news/candidates?"+qs.toString(),{cache:"no-store"});
        const json=await res.json();
        if(!res.ok||!json.ok) throw new Error(json.error||"load_failed");
        if(!alive) return;
        setCandidates(json.candidates||[]);
        setStatus((json.candidates||[]).length?"ready":"empty");
      }catch{
        if(!alive) return;
        setCandidates([]);
        setStatus("error");
      }
    }
    if(date) load();
    return()=>{alive=false;};
  },[character,date,timing]);

  const options=useMemo(()=>candidates.map((c)=>({
    ...c,
    key:[c.rankingType,c.rankNo,c.courseCode,c.raceNo].join(":")
  })),[candidates]);

  function apply(){
    const found=options.find((c)=>c.key===selected);
    if(found) onSelect?.(found);
  }

  return (
    <section className={styles.box}>
      <div className={styles.head}>
        <div><span>AI CANDIDATE PICKER</span><strong>{label}のAI候補レースから選ぶ</strong><p>{edition==="just_before"?"展示後版":"前日版"}のランキング候補を表示します。選択すると場・Rを反映してAI予想も読み込みます。</p></div>
        <em>{options.length}件</em>
      </div>
      <div className={styles.controls}>
        <select value={selected} onChange={(e)=>setSelected(e.target.value)} disabled={status!=="ready"}>
          <option value="">{status==="loading"?"候補を読み込み中…":status==="empty"?"この版の候補はまだありません":status==="error"?"候補取得に失敗しました":"レースを選択してください"}</option>
          {options.map((c)=><option key={c.key} value={c.key}>{c.category} #{c.rankNo}｜{c.courseName}{c.raceNo}R｜{c.probability}%{c.selectedForSocial?"｜SNS使用":""}</option>)}
        </select>
        <button type="button" onClick={apply} disabled={!selected}>このレースを反映</button>
      </div>
      {status==="empty"&&<small>展示後版は、展示後AIが生成されると候補が表示されます。</small>}
    </section>
  );
}

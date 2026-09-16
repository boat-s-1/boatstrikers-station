"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const GRADES=["ALL","SG","PG1","G1","G2","G3"];
const yen=(v)=>Number(v||0).toLocaleString("ja-JP");
const pct=(v)=>v===null||v===undefined?"集計待ち":`${Number(v).toFixed(1)}%`;

function buildPrompt(event,date){
  if(!event)return "";
  const rows=[
    event.result_count>0&&`結果確定：${event.result_count}R`,
    event.boat1_win_rate!==null&&event.boat1_win_rate!==undefined&&`1号艇1着率：${pct(event.boat1_win_rate)}`,
    event.manshu_count!==null&&event.manshu_count!==undefined&&`万舟：${event.manshu_count}本`,
    event.avg_payout!==null&&event.avg_payout!==undefined&&`平均3連単配当：${yen(Math.round(event.avg_payout))}円`,
  ].filter(Boolean);
  return `BoatStrikers DATA LABのX投稿専用【グレードレース・横長コンパクト画像】を作成してください。\n\n【共通ルール】\n・横長16:9、1200×675px\n・濃紺・ダークブルー・白・ゴールドのDATA LAB世界観\n・この開催だけの確定データを使用し、他場・一般戦の数字を絶対に混ぜない\n・未確定、空欄、該当なしの項目はカードごと削除する\n・数値、出目、配当を推測しない\n・主要数字は3〜5項目に絞りスマホで一瞬で読める大きさにする\n・下部に BoatStrikers / boat-strike.online\n\n【対象開催｜${date}】\n${event.grade} ${event.course_name}\n${event.title}\n${event.day_no?`${event.day_no}日目`:""}\n${rows.join("\n")||"結果集計待ち"}\n\n上部に「${event.grade} ${event.title} DATA LAB」。開催名とグレードを最も分かりやすく表示し、その下にこの開催だけの主要数字を配置してください。`;
}

export default function GradeRaceImageBuilder({date}){
  const [events,setEvents]=useState([]),[grade,setGrade]=useState("ALL"),[selected,setSelected]=useState(""),[copied,setCopied]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;setLoading(true);fetch(`/api/admin/grade-races?date=${encodeURIComponent(date)}&mode=data`).then(r=>r.json()).then(j=>{if(!live)return;setEvents(Array.isArray(j.events)?j.events:[]);setLoading(false);}).catch(()=>{if(live){setEvents([]);setLoading(false);}});return()=>{live=false};},[date]);
  const filtered=useMemo(()=>grade==="ALL"?events:events.filter(e=>e.grade===grade),[events,grade]);
  useEffect(()=>{if(!filtered.some(e=>String(e.course_code)===selected))setSelected(filtered[0]?String(filtered[0].course_code):"");},[filtered,selected]);
  const event=filtered.find(e=>String(e.course_code)===selected)||null;
  const prompt=useMemo(()=>buildPrompt(event,date),[event,date]);
  async function copy(){if(!prompt)return;try{await navigator.clipboard.writeText(prompt);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}}
  return <section className={styles.promptBuilder}>
    <div className={styles.promptHeader}><div><span className={styles.promptEyebrow}>GRADE RACE IMAGE BUILDER</span><h3>グレード戦画像を作る</h3></div></div>
    <p className={styles.promptDescription}>SG・PG1・G1・G2・G3から開催を選び、その開催だけの確定データで16:9画像を作ります。</p>
    <div className={styles.presetGrid}>{GRADES.map(g=><button key={g} type="button" className={`${styles.presetButton} ${grade===g?styles.active:""}`} onClick={()=>setGrade(g)}>{g==="ALL"?"すべて":g}</button>)}</div>
    {loading?<p>グレード戦を読み込み中...</p>:filtered.length===0?<p>この日付・グレードの開催はありません。</p>:<>
      <div className={styles.section}><label>対象開催</label><select value={selected} onChange={e=>setSelected(e.target.value)} style={{width:"100%",padding:"12px",borderRadius:"10px"}}>{filtered.map(e=><option key={`${e.course_code}-${e.title}`} value={e.course_code}>{e.grade} {e.course_name}｜{e.title}{e.day_no?`｜${e.day_no}日目`:""}</option>)}</select></div>
      {event&&<div className={styles.statsGrid}><div className={styles.stat}><span>結果確定</span><strong>{event.result_count}R</strong></div><div className={styles.stat}><span>1号艇1着率</span><strong>{pct(event.boat1_win_rate)}</strong></div><div className={styles.stat}><span>万舟</span><strong>{event.manshu_count}本</strong></div><div className={styles.stat}><span>平均配当</span><strong>{event.avg_payout?`${yen(Math.round(event.avg_payout))}円`:"集計待ち"}</strong></div></div>}
      <textarea className={styles.promptTextarea} readOnly value={prompt}/><button className={styles.promptCopyButton} type="button" onClick={copy}>{copied?"コピーしました ✓":"この開催だけの画像プロンプトをコピー"}</button>
    </>}
  </section>;
}

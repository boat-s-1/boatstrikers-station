"use client";
import {useCallback,useEffect,useState} from "react";
const card={border:"1px solid #f1cfe0",borderRadius:18,background:"#fff",padding:18};
const btn={padding:"10px 12px",borderRadius:10,border:"1px solid #e8bfd3",background:"#fff"};
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function time(v){return v?String(v).slice(0,5):"—";}
function mark(v){return {fontSize:24,fontWeight:950,color:v==="◎"?"#d01472":v==="○"?"#8a4ab5":"#718096"};}
export default function Page(){
 const [date,setDate]=useState(today()),[data,setData]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const r=await fetch(`/api/admin/hatsune-womens-inner-break?date=${date}&mode=day`,{cache:"no-store"});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"取得失敗");setData(j);setError("");}catch(e){setError(e.message||"取得失敗");}},[date]);
 useEffect(()=>{load();const id=setInterval(load,10000);return()=>clearInterval(id);},[load]);
 async function run(){setBusy(true);try{const r=await fetch("/api/admin/hatsune-womens-inner-break",{method:"POST"});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"判定失敗");await load();}catch(e){setError(e.message||"判定失敗");}finally{setBusy(false);}}
 const alerts=data?.alerts||[];const s=data?.stats||{};
 return <main style={{minHeight:"100vh",background:"#fff7fb",padding:"28px 16px 56px",color:"#102033"}}><div style={{maxWidth:1100,margin:"0 auto"}}>
  <header style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",marginBottom:18}}><div><div style={{fontSize:12,fontWeight:900,color:"#b43d78"}}>BOATSTRIKERS / HATSUNE ALERT</div><h1 style={{margin:"6px 0"}}>🎀 初音の箱推し理論</h1><p style={{margin:0,color:"#617184"}}>女子戦のイン圏外候補を検知し、234・235・345 BOXを◎○△で自動評価します。</p></div><button onClick={run} disabled={busy} style={{...btn,background:"#c9407c",color:"#fff",fontWeight:900}}>{busy?"判定中…":"今すぐ判定"}</button></header>
  <section style={{...card,marginBottom:16}}><strong>基本条件</strong><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{["女子戦限定","①全国勝率4.5未満","①展示4位以下","②〜⑥に全国勝率6.0以上"].map(x=><span key={x} style={{padding:"7px 10px",borderRadius:999,background:"#fde6f1",fontSize:13,fontWeight:800}}>{x}</span>)}</div><p style={{margin:"10px 0 0",fontSize:13,color:"#718096"}}>通知設定は「箱推し理論」1つだけ。BOX別ON/OFFはありません。</p></section>
  <section style={{...card,marginBottom:16,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={btn}/><span>成立 <b>{s.matched??0}R</b></span><span>①3着外 <b>{s.out3??0}R</b></span><span>①3着外率 <b>{s.out3Rate==null?"—":`${(s.out3Rate*100).toFixed(1)}%`}</b></span></section>
  {error?<div style={{...card,color:"#a12",marginBottom:16}}>{error}</div>:null}
  <section style={card}><h2 style={{marginTop:0}}>成立レース</h2>{alerts.length?alerts.map(a=><article key={a.id} style={{padding:"14px 0",borderBottom:"1px solid #f1dce6"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong style={{fontSize:19}}>{a.course_name||`${a.course_code}場`} {a.race_no}R</strong><div style={{fontSize:13,color:"#718096",marginTop:3}}>締切 {time(a.closing_time)} / ①勝率 {a.boat1_win_rate??"—"} / ①展示 {a.boat1_exhibition_rank??"—"}位</div></div><div style={{display:"flex",gap:16}}>{[["234",a.box_234_rating],["235",a.box_235_rating],["345",a.box_345_rating]].map(([b,r])=><span key={b}><b>{b}</b> <i style={mark(r)}>{r||"△"}</i></span>)}</div></div><div style={{fontSize:13,color:"#617184",marginTop:8}}>結果: {a.result_combo||"結果待ち"}</div></article>):<div style={{padding:"28px 0",color:"#718096"}}>この日の成立レースはありません。</div>}</section>
 </div></main>;
}

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function jstDateOffset(offset=0){
  const now=new Date();
  const jst=new Date(now.getTime()+9*60*60*1000);
  jst.setUTCDate(jst.getUTCDate()+offset);
  return jst.toISOString().slice(0,10);
}
function formatDate(v){return v?String(v).replaceAll("-","/"):"—";}
function formatTime(v){return v?String(v).slice(0,5):"—";}
function raceKey(r){return `${r.race_date}-${Number(r.course_code)}-${Number(r.race_no)}`;}

async function getRows(supabase,date=null){
  if(!supabase)return [];
  let q=supabase.from("bs_hatsune_womens_inner_break_alerts")
    .select("id,race_date,course_code,course_name,race_no,closing_time,boat1_exhibition,boat2_exhibition,exhibition_advantage,boat1_lap,boat2_lap,lap_advantage,danger_level")
    .order("race_date",{ascending:false}).order("closing_time",{ascending:true}).limit(5000);
  if(date)q=q.eq("race_date",date);
  const {data,error}=await q;
  return error?[]:(data||[]);
}
async function getPerformance(supabase,rows){
  if(!supabase||!rows.length)return {matched:rows.length,finished:0,hits:0,hitRate:null};
  const dates=rows.map(x=>x.race_date).filter(Boolean).sort();
  const {data}=await supabase.from("bs_race_entries")
    .select("race_date,course_code,race_no,boat_no,arrival_order")
    .eq("boat_no",1).gte("race_date",dates[0]).lte("race_date",dates[dates.length-1]);
  const map=new Map((data||[]).map(x=>[raceKey(x),Number(x.arrival_order)]));
  const results=rows.map(x=>map.get(raceKey(x))).filter(x=>Number.isFinite(x)&&x>0);
  const hits=results.filter(x=>x===1).length;
  return {matched:rows.length,finished:results.length,hits,hitRate:results.length?hits/results.length*100:null};
}
function CountCard({label,count,blue=false}){
  return <div style={{padding:"13px 8px 12px",borderRadius:16,background:blue?"linear-gradient(180deg,#f3f0ff,#fff)":"linear-gradient(180deg,#fff4fb,#fff)",border:`1px solid ${blue?"#ddd3ff":"#f7cfe5"}`,textAlign:"center"}}>
    <span style={{display:"block",fontSize:12,fontWeight:900,color:blue?"#6750a4":"#c43d7b"}}>{label}</span>
    <strong style={{display:"block",marginTop:5,fontSize:28,lineHeight:1,color:"#17345c"}}>{count}<small style={{fontSize:14,marginLeft:2}}>件</small></strong>
  </div>;
}
function PerfCard({label,perf}){
  const pending=Math.max(0,perf.matched-perf.finished);
  return <div style={{padding:"13px 10px",borderRadius:17,background:"#f8f7ff",border:"1px solid #e2dcf8",textAlign:"center"}}>
    <span style={{fontSize:12,fontWeight:900,color:"#6d4aa8"}}>{label} 1着率</span>
    <strong style={{display:"block",marginTop:3,fontSize:28,color:"#6d4aa8"}}>{perf.hitRate==null?"—%":`${perf.hitRate.toFixed(1)}%`}</strong>
    <small style={{display:"block",color:"#718096",fontWeight:800}}>{perf.finished?`${perf.hits}/${perf.finished}R`:"結果待ち"}{pending>0?`（${pending}R結果待ち）`:""}</small>
    <small style={{display:"block",marginTop:4,color:"#95a0af",fontWeight:700,fontSize:10}}>結果確定 {perf.finished}/{perf.matched}R</small>
  </div>;
}

export default async function HatsuneAlertPanel(){
  const supabase=getSupabase();
  const today=jstDateOffset(0),yesterday=jstDateOffset(-1);
  const [todayRows,yRows,allRows]=await Promise.all([getRows(supabase,today),getRows(supabase,yesterday),getRows(supabase)]);
  const [yPerf,allPerf]=await Promise.all([getPerformance(supabase,yRows),getPerformance(supabase,allRows)]);
  return <section style={{margin:"18px 14px",borderRadius:24,overflow:"hidden",background:"#fff",boxShadow:"0 8px 24px rgba(101,56,122,.10)",border:"2px solid #bb79d8"}}>
    <div style={{position:"relative",overflow:"hidden",background:"#fff4fa",borderBottom:"1px solid #ead7f5"}}>
      <img src="/top/IMG_7873.jpeg?v=20260901-0506" alt="女子イン崩れ理論" style={{display:"block",width:"100%",height:"auto",margin:0,borderRadius:0}} />
      <span style={{position:"absolute",top:10,right:10,padding:"7px 10px",borderRadius:999,background:"rgba(255,255,255,.92)",color:"#526079",fontSize:12,fontWeight:900}}>{formatDate(today)}</span>
    </div>
    <div style={{padding:"15px 14px 8px"}}>
      <div style={{marginBottom:8,fontSize:13,fontWeight:900,color:"#17345c"}}>アラート本数</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
        <CountCard label="本日" count={todayRows.length}/><CountCard label="昨日" count={yRows.length}/><CountCard label="全期間" count={allRows.length} blue/>
      </div>
      <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><PerfCard label="昨日" perf={yPerf}/><PerfCard label="全期間" perf={allPerf}/></div>
    </div>
    <div style={{padding:"8px 14px 2px",fontSize:13,fontWeight:900,color:"#17345c"}}>今日のアラート一覧</div>
    {todayRows.length?<div style={{padding:"14px 14px 8px",display:"flex",gap:12,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch"}}>
      {todayRows.map(a=><article key={a.id} style={{flex:"0 0 88%",scrollSnapAlign:"start",border:"1px solid #ead3f1",borderRadius:17,padding:14,background:"#fffaff",boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><strong style={{fontSize:20,color:"#17345c"}}>{a.course_name||`${a.course_code}場`} {a.race_no}R</strong><span style={{padding:"6px 9px",borderRadius:999,background:"#f4e5fb",color:"#9b45b4",fontSize:12,fontWeight:900}}>{a.danger_level==="super_danger"?"超警戒":"条件成立"}</span></div>
        <div style={{marginTop:9,display:"flex",flexWrap:"wrap",gap:7,fontSize:12,fontWeight:800,color:"#526079"}}><span style={{padding:"6px 9px",borderRadius:10,background:"#f3f6fa"}}>展示差 ②が{Number(a.exhibition_advantage||0).toFixed(2)}秒速い</span><span style={{padding:"6px 9px",borderRadius:10,background:"#f3f6fa"}}>1周差 ②が{Number(a.lap_advantage||0).toFixed(2)}秒速い</span></div>
        <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><strong style={{fontSize:14,color:"#17345c"}}>締切 {formatTime(a.closing_time)}</strong><Link href="/races" style={{fontSize:13,fontWeight:900,color:"#7b4aa8",textDecoration:"none"}}>出走表を見る</Link></div>
      </article>)}
    </div>:<div style={{padding:"20px 18px 22px",textAlign:"center"}}><div style={{fontSize:30}}>🌸</div><strong style={{display:"block",marginTop:6,color:"#17345c"}}>現在、条件成立レースはありません</strong><p style={{margin:"7px 0 0",fontSize:13,color:"#718096",lineHeight:1.6}}>展示情報が出た後、女子イン崩れ条件が成立すると表示されます。</p></div>}
    <div style={{padding:"0 14px 16px"}}><Link href="/members" style={{display:"block",textAlign:"center",textDecoration:"none",padding:"12px 14px",borderRadius:14,background:"#06c755",color:"#fff",fontWeight:900,fontSize:14}}>LINE通知を設定する</Link></div>
  </section>;
}

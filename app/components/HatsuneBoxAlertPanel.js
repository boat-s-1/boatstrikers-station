import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function jstDateOffset(offset=0){const now=new Date();const jst=new Date(now.getTime()+9*60*60*1000);jst.setUTCDate(jst.getUTCDate()+offset);return jst.toISOString().slice(0,10);}
function formatDate(v){return v?String(v).replaceAll("-","/"):"—";}
function formatTime(v){return v?String(v).slice(0,5):"—";}
function ratingStyle(r){return {fontSize:24,fontWeight:950,color:r==="◎"?"#e62f86":r==="○"?"#e58a16":"#2484d8"};}

async function getRows(supabase,date=null){
  if(!supabase)return [];
  let q=supabase.from("bs_hatsune_box_alerts")
    .select("id,race_date,course_code,course_name,race_no,closing_time,box_234_rating,box_235_rating,box_345_rating,boat1_win_rate,boat1_exhibition_rank")
    .order("race_date",{ascending:false}).order("closing_time",{ascending:true}).limit(5000);
  if(date)q=q.eq("race_date",date);
  const {data,error}=await q;
  return error?[]:(data||[]);
}
function CountCard({label,count,blue=false}){
  return <div style={{padding:"13px 8px 12px",borderRadius:16,background:blue?"linear-gradient(180deg,#eff8ff,#fff)":"linear-gradient(180deg,#fff4fb,#fff)",border:`1px solid ${blue?"#cce7fb":"#f7cfe5"}`,textAlign:"center"}}><span style={{display:"block",fontSize:12,fontWeight:900,color:blue?"#1475b8":"#e13d80"}}>{label}</span><strong style={{display:"block",marginTop:5,fontSize:28,lineHeight:1,color:"#17345c"}}>{count}<small style={{fontSize:14,marginLeft:2}}>件</small></strong></div>;
}

export default async function HatsuneBoxAlertPanel(){
  const supabase=getSupabase();
  const today=jstDateOffset(0),yesterday=jstDateOffset(-1);
  const [todayRows,yRows,allRows]=await Promise.all([getRows(supabase,today),getRows(supabase,yesterday),getRows(supabase)]);
  return <section style={{margin:"18px 14px",borderRadius:24,overflow:"hidden",background:"#fff",boxShadow:"0 8px 24px rgba(101,56,122,.10)",border:"2px solid #ef79ac"}}>
    <div style={{position:"relative",padding:"16px 14px 14px",background:"linear-gradient(135deg,#fff0f8,#fde8f5 50%,#fff8fc)",borderBottom:"1px solid #f3cadd",textAlign:"center"}}>
      <div style={{fontSize:11,fontWeight:900,color:"#c93d78",letterSpacing:".08em"}}>🎀 女子戦の箱推しBOX 🎀</div>
      <h2 style={{margin:"4px 0 0",fontSize:27,color:"#b72f70",textShadow:"0 1px #fff"}}>箱推し理論</h2>
      <span style={{position:"absolute",top:10,right:10,padding:"7px 10px",borderRadius:999,background:"rgba(255,255,255,.92)",color:"#526079",fontSize:12,fontWeight:900}}>{formatDate(today)}</span>
    </div>
    <div style={{padding:"15px 14px 8px"}}><div style={{marginBottom:8,fontSize:13,fontWeight:900,color:"#17345c"}}>アラート本数</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}><CountCard label="本日" count={todayRows.length}/><CountCard label="昨日" count={yRows.length}/><CountCard label="全期間" count={allRows.length} blue/></div></div>
    <div style={{padding:"8px 14px 2px",fontSize:13,fontWeight:900,color:"#17345c"}}>今日の箱推しアラート</div>
    {todayRows.length?<div style={{padding:"14px 14px 8px",display:"flex",gap:12,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch"}}>{todayRows.map(a=><article key={a.id} style={{flex:"0 0 88%",scrollSnapAlign:"start",border:"1px solid #f2c9dc",borderRadius:17,padding:14,background:"#fffafd",boxSizing:"border-box"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><strong style={{fontSize:20,color:"#17345c"}}>{a.course_name||`${a.course_code}場`} {a.race_no}R</strong><span style={{padding:"6px 9px",borderRadius:999,background:"#ffe5f1",color:"#d92f78",fontSize:12,fontWeight:900}}>箱推し成立</span></div><div style={{marginTop:11,fontSize:12,fontWeight:900,color:"#d13a78"}}>推奨BOX評価</div><div style={{marginTop:5,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{[["234 BOX",a.box_234_rating],["235 BOX",a.box_235_rating],["345 BOX",a.box_345_rating]].map(([label,r])=><div key={label} style={{padding:"9px 5px",border:"1px solid #f3d1e1",borderRadius:12,textAlign:"center",background:"#fff"}}><div style={{fontSize:12,fontWeight:900,color:"#17345c"}}>{label}</div><div style={ratingStyle(r)}>{r||"△"}</div></div>)}</div><div style={{marginTop:9,fontSize:12,color:"#718096"}}>①勝率 {a.boat1_win_rate??"—"} / ①展示 {a.boat1_exhibition_rank??"—"}位</div><div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><strong style={{fontSize:14,color:"#17345c"}}>締切 {formatTime(a.closing_time)}</strong><Link href="/races" style={{fontSize:13,fontWeight:900,color:"#d62f7c",textDecoration:"none"}}>出走表を見る</Link></div></article>)}</div>:<div style={{padding:"20px 18px 22px",textAlign:"center"}}><div style={{fontSize:30}}>🎀</div><strong style={{display:"block",marginTop:6,color:"#17345c"}}>現在、条件成立レースはありません</strong><p style={{margin:"7px 0 0",fontSize:13,color:"#718096",lineHeight:1.6}}>展示情報が出た後、箱推し条件が成立すると表示されます。</p></div>}
    <div style={{padding:"0 14px 16px"}}><Link href="/members" style={{display:"block",textAlign:"center",textDecoration:"none",padding:"12px 14px",borderRadius:14,background:"#06c755",color:"#fff",fontWeight:900,fontSize:14}}>LINE通知を設定する</Link></div>
  </section>;
}

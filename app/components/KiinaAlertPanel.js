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

async function getRows(supabase,date=null){
  if(!supabase)return [];
  let q=supabase.from("bs_exhibition_alerts")
    .select("id,race_date,course_code,course_name,race_no,boat_no,closing_time,exhibition_time,exhibition_rank,straight_time,straight_rank,result_rank,result_synced_at,trifecta_payout")
    .order("race_date",{ascending:false}).order("closing_time",{ascending:true}).limit(5000);
  if(date)q=q.eq("race_date",date);
  const {data,error}=await q;
  return error?[]:(data||[]);
}

function getPerformance(rows){
  const list=rows||[];
  const finished=list.filter(r=>r.result_synced_at&&Number(r.result_rank)>0);
  const hits=finished.filter(r=>Number(r.result_rank)===1).length;
  return {matched:list.length,finished:finished.length,hits,hitRate:finished.length?hits/finished.length*100:null};
}
function getAttackGrade(row){
  const ex=Number(row?.exhibition_rank);
  const st=Number(row?.straight_rank);
  if(ex===1&&st===1)return {label:"強カド攻め",mark:"◎"};
  if((ex===1&&st===2)||(ex===2&&st===1))return {label:"カド攻め",mark:"○"};
  return {label:"対象外",mark:"△"};
}
function CountCard({label,count,blue=false}){
  return <div style={{padding:"13px 8px 12px",borderRadius:16,background:blue?"linear-gradient(180deg,#fff7e8,#fff)":"linear-gradient(180deg,#fffbed,#fff)",border:`1px solid ${blue?"#f3d99a":"#f5e3a8"}`,textAlign:"center"}}>
    <span style={{display:"block",fontSize:12,fontWeight:900,color:blue?"#b27600":"#c18a00"}}>{label}</span>
    <strong style={{display:"block",marginTop:5,fontSize:28,lineHeight:1,color:"#17345c"}}>{count}<small style={{fontSize:14,marginLeft:2}}>件</small></strong>
  </div>;
}
function PerfCard({label,perf}){
  const pending=Math.max(0,perf.matched-perf.finished);
  return <div style={{padding:"13px 10px",borderRadius:17,background:"#fffaf0",border:"1px solid #f1dfb4",textAlign:"center"}}>
    <span style={{fontSize:12,fontWeight:900,color:"#a96b00"}}>{label} 4号艇1着率</span>
    <strong style={{display:"block",marginTop:3,fontSize:28,color:"#a96b00"}}>{perf.hitRate==null?"—%":`${perf.hitRate.toFixed(1)}%`}</strong>
    <small style={{display:"block",color:"#718096",fontWeight:800}}>{perf.finished?`${perf.hits}/${perf.finished}R`:"結果待ち"}{pending>0?`（${pending}R結果待ち）`:""}</small>
    <small style={{display:"block",marginTop:4,color:"#95a0af",fontWeight:700,fontSize:10}}>結果確定 {perf.finished}/{perf.matched}R</small>
  </div>;
}

export default async function KiinaAlertPanel(){
  const supabase=getSupabase();
  const today=jstDateOffset(0),yesterday=jstDateOffset(-1);
  const [todayRows,yRows,allRows]=await Promise.all([getRows(supabase,today),getRows(supabase,yesterday),getRows(supabase)]);
  const yPerf4=getPerformance(yRows),allPerf4=getPerformance(allRows);

  return <section style={{margin:"18px 14px",borderRadius:24,overflow:"hidden",background:"#fff",boxShadow:"0 8px 24px rgba(141,105,20,.10)",border:"2px solid #e8bc48"}}>
    <div style={{position:"relative",lineHeight:0,background:"#fff",overflow:"hidden"}}>
      <img src="/top/IMG_8030.jpeg?v=20260906-0706" alt="今日のキイナアラート カド攻め理論" style={{display:"block",width:"100%",height:"auto",margin:0,objectFit:"cover"}} />
      <span style={{position:"absolute",top:10,right:10,padding:"6px 9px",borderRadius:999,background:"rgba(255,255,255,.92)",color:"#526079",fontSize:12,fontWeight:900,lineHeight:1.2}}>{formatDate(today)}</span>
    </div>

    <div style={{padding:"15px 14px 8px"}}>
      <div style={{marginBottom:8,fontSize:13,fontWeight:900,color:"#17345c"}}>アラート本数</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
        <CountCard label="本日" count={todayRows.length}/><CountCard label="昨日" count={yRows.length}/><CountCard label="全期間" count={allRows.length} blue/>
      </div>
      <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <PerfCard label="昨日" perf={yPerf4}/><PerfCard label="全期間" perf={allPerf4}/>
      </div>
    </div>

    <div style={{margin:"8px 14px 12px",padding:"12px",borderRadius:16,background:"#fffaf0",border:"1px solid #f1dfb4"}}>
      <strong style={{display:"block",fontSize:13,color:"#4c3a12",marginBottom:8}}>カド攻め評価基準（4号艇）</strong>
      <div style={{display:"grid",gap:7,fontSize:12,fontWeight:800,color:"#526079"}}>
        <div>◎ 展示1位 × 直線1位 <span style={{float:"right",color:"#a96b00"}}>強カド攻め</span></div>
        <div>○ 展示2位 × 直線1位 / 展示1位 × 直線2位 <span style={{float:"right",color:"#a96b00"}}>カド攻め</span></div>
        <div>△ 展示2位 × 直線2位 <span style={{float:"right",color:"#8a96a8"}}>通知対象外</span></div>
      </div>
    </div>

    <div style={{padding:"8px 14px 2px",fontSize:13,fontWeight:900,color:"#17345c"}}>今日のアラート一覧</div>
    {todayRows.length?<div style={{padding:"14px 14px 8px",display:"flex",gap:12,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch"}}>
      {todayRows.map(a=>{const grade=getAttackGrade(a);return <article key={a.id} style={{flex:"0 0 88%",scrollSnapAlign:"start",border:"1px solid #f0dfac",borderRadius:17,padding:14,background:"#fffdf7",boxSizing:"border-box"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><strong style={{fontSize:20,color:"#17345c"}}>{a.course_name||`${a.course_code}場`} {a.race_no}R</strong><span style={{padding:"6px 9px",borderRadius:999,background:"#fff0c7",color:"#a96b00",fontSize:12,fontWeight:900}}>{grade.mark} {grade.label}</span></div>
        <div style={{marginTop:9,display:"flex",flexWrap:"wrap",gap:7,fontSize:12,fontWeight:800,color:"#526079"}}>
          <span style={{padding:"6px 9px",borderRadius:10,background:"#f7f8fa"}}>④ 展示 {a.exhibition_time??"—"} / {a.exhibition_rank??"—"}位</span>
          <span style={{padding:"6px 9px",borderRadius:10,background:"#f7f8fa"}}>④ 直線 {a.straight_time??"—"} / {a.straight_rank??"—"}位</span>
        </div>
        <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><strong style={{fontSize:14,color:"#17345c"}}>締切 {formatTime(a.closing_time)}</strong><Link href="/races" style={{fontSize:13,fontWeight:900,color:"#a96b00",textDecoration:"none"}}>出走表を見る</Link></div>
      </article>})}
    </div>:<div style={{padding:"20px 18px 22px",textAlign:"center"}}><div style={{fontSize:30}}>🚨</div><strong style={{display:"block",marginTop:6,color:"#17345c"}}>現在、条件成立レースはありません</strong><p style={{margin:"7px 0 0",fontSize:13,color:"#718096",lineHeight:1.6}}>展示情報が出た後、カド攻め理論の条件が成立すると表示されます。</p></div>}

    <div style={{padding:"0 14px 16px"}}><Link href="/members" style={{display:"block",textAlign:"center",textDecoration:"none",padding:"12px 14px",borderRadius:14,background:"#06c755",color:"#fff",fontWeight:900,fontSize:14}}>LINE通知を設定する</Link></div>
  </section>;
}

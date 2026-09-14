"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const PERIODS=[
  {key:"today",label:"今日"},
  {key:"days7",label:"7日"},
  {key:"days30",label:"30日"},
];
const FEATURE_ORDER=["elimination_ai","exhibition_compare_ai","ai_detail"];

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function AdminUsagePage(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [payload,setPayload]=useState(null);
  const [period,setPeriod]=useState("today");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      try{
        if(!supabase)throw new Error("会員機能の設定を確認してください。");
        const {data}=await supabase.auth.getSession();
        const token=data.session?.access_token;
        if(!token)throw new Error("管理者アカウントでログインしてください。");
        const response=await fetch("/api/admin/feature-usage",{
          headers:{Authorization:`Bearer ${token}`},cache:"no-store",
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error||"利用状況を取得できませんでした。");
        if(!cancelled)setPayload(body);
      }catch(err){if(!cancelled)setError(String(err?.message||err));}
      finally{if(!cancelled)setLoading(false);}
    }
    load();
    return()=>{cancelled=true;};
  },[supabase]);

  if(loading)return <main style={pageStyle}><div style={panelStyle}>利用状況を読み込み中...</div></main>;
  if(error)return <main style={pageStyle}><div style={panelStyle}><h1>管理画面</h1><p style={{color:"#b33"}}>{error}</p><Link href="/members">会員ページへ戻る</Link></div></main>;

  const summary=payload?.periods?.[period]||{};
  const byFeature=summary.byFeature||{};

  return <main style={pageStyle}>
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div><span style={kickerStyle}>BOATSTRIKERS ADMIN</span><h1 style={{margin:"6px 0 4px"}}>AI利用状況</h1><p style={mutedStyle}>FREE機能の利用状況を管理者専用で確認できます。</p></div>
        <Link href="/members" style={backStyle}>会員ページへ</Link>
      </div>

      <div style={tabsStyle}>{PERIODS.map(item=><button key={item.key} onClick={()=>setPeriod(item.key)} style={{...tabStyle,...(period===item.key?activeTabStyle:{})}}>{item.label}</button>)}</div>

      <div style={summaryGridStyle}>
        <Metric label="利用者数" value={`${summary.users||0}人`} />
        <Metric label="利用回数" value={`${summary.uses||0}回`} />
        <Metric label="上限到達" value={`${summary.exhaustedUsers||0}人`} />
      </div>

      <div style={featureGridStyle}>
        {FEATURE_ORDER.map(key=>{
          const item=byFeature[key]||{};
          return <article key={key} style={featureCardStyle}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><strong>{item.label||key}</strong><span style={limitStyle}>FREE {item.limit||"-"}回/日</span></div>
            <div style={featureStatsStyle}><span><b>{item.users||0}</b><small>利用者</small></span><span><b>{item.uses||0}</b><small>利用回数</small></span><span><b>{item.exhaustedUsers||0}</b><small>上限到達</small></span><span><b>{item.avgPerUser||0}</b><small>平均回数</small></span></div>
          </article>;
        })}
      </div>

      <section style={{marginTop:22}}><h2 style={{fontSize:17}}>直近30日の推移</h2><div style={trendStyle}>{(payload.daily||[]).slice(-14).map(day=><div key={day.date} style={trendRowStyle}><span>{day.date.slice(5)}</span><div style={barTrackStyle}><div style={{...barStyle,width:`${Math.min(100,(Number(day.uses||0)/Math.max(1,...(payload.daily||[]).map(d=>Number(d.uses||0))))*100)}%`}} /></div><strong>{day.uses||0}回</strong></div>)}</div></section>

      <p style={{...mutedStyle,marginTop:18}}>集計対象：消去法AI・展示比較AI・AI詳細診断。日付は日本時間基準です。</p>
    </section>
  </main>;
}

function Metric({label,value}){return <div style={metricStyle}><span>{label}</span><strong>{value}</strong></div>}

const pageStyle={minHeight:"100vh",background:"#f3f6fa",padding:"24px 12px 80px"};
const panelStyle={width:"min(1080px,96vw)",margin:"0 auto",background:"#fff",border:"1px solid #dfe6ef",borderRadius:24,padding:20,boxShadow:"0 14px 35px rgba(24,47,74,.08)"};
const headerStyle={display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",flexWrap:"wrap"};
const kickerStyle={fontSize:11,fontWeight:1000,letterSpacing:".14em",color:"#315f92"};
const mutedStyle={margin:0,color:"#718094",fontSize:13,fontWeight:700};
const backStyle={textDecoration:"none",background:"#183d70",color:"#fff",padding:"10px 13px",borderRadius:12,fontWeight:900,fontSize:12};
const tabsStyle={display:"flex",gap:8,marginTop:20};
const tabStyle={border:"1px solid #d6dfeb",background:"#f7f9fc",padding:"9px 16px",borderRadius:999,fontWeight:900,cursor:"pointer"};
const activeTabStyle={background:"#173f75",color:"#fff",borderColor:"#173f75"};
const summaryGridStyle={display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginTop:16};
const metricStyle={padding:16,border:"1px solid #e1e7ef",borderRadius:16,background:"#f9fbfd",display:"flex",flexDirection:"column",gap:4};
const featureGridStyle={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:12,marginTop:18};
const featureCardStyle={padding:16,border:"1px solid #dfe6ee",borderRadius:18};
const limitStyle={fontSize:11,fontWeight:900,color:"#45688e",background:"#edf4fb",padding:"5px 8px",borderRadius:999};
const featureStatsStyle={display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:15};
const trendStyle={display:"grid",gap:8};
const trendRowStyle={display:"grid",gridTemplateColumns:"44px 1fr 58px",gap:10,alignItems:"center",fontSize:12,color:"#66788a"};
const barTrackStyle={height:8,borderRadius:999,background:"#e9eef4",overflow:"hidden"};
const barStyle={height:"100%",background:"linear-gradient(90deg,#2b72b7,#6b57c9)",borderRadius:999};

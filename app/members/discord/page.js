"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function DiscordMemberPage(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [session,setSession]=useState(null);
  const [status,setStatus]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(nextSession){
    if(!nextSession){setStatus(null);setLoading(false);return;}
    try{
      const response=await fetch("/api/members/discord/status",{headers:{Authorization:`Bearer ${nextSession.access_token}`},cache:"no-store"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||"Discord連携状況を取得できませんでした。");
      setStatus(body);
    }catch(err){setError(String(err?.message||err));}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    if(!supabase){setLoading(false);setError("会員機能の設定を確認できませんでした。");return;}
    let alive=true;
    supabase.auth.getSession().then(({data})=>{
      if(!alive)return;
      const next=data.session||null;setSession(next);load(next);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      if(!alive)return;setSession(next||null);load(next||null);
    });
    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);

  async function connect(){
    if(!session||busy)return;setBusy(true);setError("");
    try{
      const response=await fetch("/api/members/discord/start",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||"Discord連携を開始できませんでした。");
      window.location.assign(body.url);
    }catch(err){setError(String(err?.message||err));setBusy(false);}
  }

  async function unlink(){
    if(!session||busy)return;
    if(!window.confirm("DiscordのPREMIUMアクセスを解除しますか？"))return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/members/discord/unlink",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||"Discord連携を解除できませんでした。");
      await load(session);
    }catch(err){setError(String(err?.message||err));}
    finally{setBusy(false);}
  }

  return <main style={{minHeight:"100vh",background:"#07111f",color:"white",padding:"40px 18px 80px"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <Link href="/members" style={{color:"#9cc6ff",textDecoration:"none"}}>← メンバーズへ戻る</Link>
      <section style={{marginTop:22,padding:"28px 22px",borderRadius:24,background:"linear-gradient(135deg,#19245a,#5865F2)",boxShadow:"0 20px 50px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:".14em",opacity:.8}}>BOATSTRIKERS PREMIUM</div>
        <h1 style={{fontSize:"clamp(28px,7vw,44px)",margin:"8px 0"}}>Discord 全通知</h1>
        <p style={{lineHeight:1.8,margin:0}}>LINEは厳選通知、Discordでは一果・初音・キイナの成立アラートをすべて受け取れます。</p>
      </section>

      <section style={{marginTop:18,padding:22,border:"1px solid #233654",borderRadius:20,background:"#0d1a2b"}}>
        <h2 style={{marginTop:0}}>受け取れる通知</h2>
        <div style={{display:"grid",gap:10,lineHeight:1.6}}>
          <div>🏁 一果｜隠れイン・イン逃げ急上昇</div>
          <div>🌸 初音｜女子イン崩れ・箱推し</div>
          <div>🚨 キイナ｜カド攻め理論</div>
          <div>⚡ 全アラート専用チャンネル</div>
        </div>
      </section>

      <section style={{marginTop:18,padding:22,border:"1px solid #233654",borderRadius:20,background:"#0d1a2b"}}>
        {loading?<p>連携状況を確認中...</p>:!session?<>
          <h2>ログインが必要です</h2><p>BoatStrikers会員としてログインしてからDiscordを連携してください。</p><Link href="/members" style={{display:"inline-block",padding:"13px 18px",borderRadius:12,background:"white",color:"#07111f",fontWeight:800,textDecoration:"none"}}>ログインする</Link>
        </>:status?.linked?<>
          <div style={{fontSize:13,color:"#62e6a7",fontWeight:900}}>● CONNECTED</div>
          <h2>{status.link?.discord_global_name||status.link?.discord_username||"Discord"} と連携済み</h2>
          <p>PREMIUMロールは会員ステータスと自動同期されます。対象プランを外れた場合は限定チャンネルの閲覧権限が自動解除されます。</p>
          <button onClick={unlink} disabled={busy} style={{padding:"12px 16px",borderRadius:12,border:"1px solid #40516c",background:"transparent",color:"white",fontWeight:700}}>Discord連携を解除</button>
        </>:<>
          <h2>{status?.eligible?"Discordを連携する":"対象会員限定です"}</h2>
          <p>{status?.eligible?"Discordで認証するとBoatStrikersサーバーへ参加し、PREMIUMロールが自動付与されます。":"Discord全通知はPREMIUM対象プランで利用できます。"}</p>
          {status?.eligible&&<button onClick={connect} disabled={busy} style={{width:"100%",padding:"15px 18px",border:0,borderRadius:14,background:"#5865F2",color:"white",fontSize:17,fontWeight:900,cursor:"pointer"}}>{busy?"Discordへ移動中...":"Discordを連携して全通知を受け取る"}</button>}
        </>}
        {error&&<div style={{marginTop:14,padding:12,borderRadius:10,background:"#411c28",color:"#ffd6df"}}>{error}</div>}
      </section>

      <p style={{marginTop:20,color:"#93a6bd",fontSize:13,lineHeight:1.7}}>Discordのログイン情報やパスワードをBoatStrikersが保存することはありません。連携にはDiscord OAuthを使用します。</p>
    </div>
  </main>;
}

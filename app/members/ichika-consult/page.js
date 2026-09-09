"use client";

import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

const COURSES=[
  ["01","桐生"],["02","戸田"],["03","江戸川"],["04","平和島"],["05","多摩川"],["06","浜名湖"],["07","蒲郡"],["08","常滑"],["09","津"],["10","三国"],["11","びわこ"],["12","住之江"],["13","尼崎"],["14","鳴門"],["15","丸亀"],["16","児島"],["17","宮島"],["18","徳山"],["19","下関"],["20","若松"],["21","芦屋"],["22","福岡"],["23","唐津"],["24","大村"],
];

export default function IchikaConsultPage(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [history,setHistory]=useState([]);
  const [topic,setTopic]=useState("escape");
  const [course,setCourse]=useState("");
  const [raceNo,setRaceNo]=useState("");
  const [question,setQuestion]=useState("");

  async function load(nextSession){
    if(!nextSession){setLoading(false);return;}
    try{
      const r=await fetch("/api/members/ichika-consult",{headers:{Authorization:`Bearer ${nextSession.access_token}`},cache:"no-store"});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"相談履歴を取得できませんでした。");
      setHistory(b.consultations||[]);
    }catch(e){setError(String(e?.message||e));}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    if(!supabase){setError("会員機能の設定を確認できませんでした。");setLoading(false);return;}
    let alive=true;
    supabase.auth.getSession().then(({data})=>{if(!alive)return;const s=data.session||null;setSession(s);load(s);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{if(!alive)return;setSession(s||null);load(s||null);});
    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);

  async function submit(){
    if(!session||busy)return;
    setBusy(true);setError("");
    try{
      const selected=COURSES.find(([code])=>code===course);
      const r=await fetch("/api/members/ichika-consult",{
        method:"POST",
        headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
        body:JSON.stringify({topic,courseCode:course,courseName:selected?.[1]||"",raceNo:raceNo?Number(raceNo):null,question}),
      });
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"一果に相談できませんでした。");
      setHistory([b.consultation,...history]);
      setQuestion("");
    }catch(e){setError(String(e?.message||e));}
    finally{setBusy(false);}
  }

  async function escalate(id){
    if(!session||busy)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/members/ichika-consult",{
        method:"PATCH",
        headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
        body:JSON.stringify({id}),
      });
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"追加相談を送れませんでした。");
      setHistory(history.map(x=>x.id===id?{...x,escalated:true,admin_status:"pending"}:x));
    }catch(e){setError(String(e?.message||e));}
    finally{setBusy(false);}
  }

  const card={background:"#fff",borderRadius:22,padding:20,boxShadow:"0 10px 30px rgba(86,25,25,.08)",border:"1px solid #f4dede"};
  const field={width:"100%",boxSizing:"border-box",padding:"13px 14px",borderRadius:12,border:"1px solid #e5c7c7",background:"#fff",fontSize:16};

  return <main style={{minHeight:"100vh",background:"linear-gradient(180deg,#fff7f6,#fff)",color:"#3b2020",padding:"24px 16px 80px"}}>
    <div style={{maxWidth:820,margin:"0 auto"}}>
      <Link href="/members" style={{color:"#b23a3a",textDecoration:"none",fontWeight:800}}>← メンバーズへ戻る</Link>

      <section style={{marginTop:18,borderRadius:28,padding:"28px 22px",background:"linear-gradient(135deg,#9f1d1d,#e14b4b)",color:"#fff",boxShadow:"0 18px 40px rgba(136,30,30,.22)"}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:".18em",opacity:.8}}>BOATSTRIKERS PREMIUM</div>
        <h1 style={{fontSize:"clamp(30px,8vw,48px)",margin:"8px 0 10px"}}>一果に相談！</h1>
        <p style={{margin:0,lineHeight:1.8}}>イン逃げ目線で即チェック。まず一果AIが回答して、必要ならそのまま管理人へ追加相談できます。</p>
      </section>

      {loading?<div style={{...card,marginTop:18}}>会員情報を確認中...</div>:!session?<div style={{...card,marginTop:18}}><h2>ログインが必要です</h2><p>BoatStrikers会員としてログインしてください。</p></div>:<>
        <section style={{...card,marginTop:18}}>
          <h2 style={{marginTop:0}}>相談する</h2>
          <div style={{display:"grid",gap:12}}>
            <label><div style={{fontWeight:800,marginBottom:6}}>相談テーマ</div><select value={topic} onChange={e=>setTopic(e.target.value)} style={field}>
              <option value="escape">イン逃げ期待度</option>
              <option value="buy_or_skip">買うか見送るか</option>
              <option value="risk">1号艇の不安材料</option>
              <option value="exhibition">展示後チェック</option>
              <option value="ticket">買い目の考え方</option>
            </select></label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:10}}>
              <label><div style={{fontWeight:800,marginBottom:6}}>場</div><select value={course} onChange={e=>setCourse(e.target.value)} style={field}><option value="">指定なし</option>{COURSES.map(([c,n])=><option key={c} value={c}>{n}</option>)}</select></label>
              <label><div style={{fontWeight:800,marginBottom:6}}>R</div><select value={raceNo} onChange={e=>setRaceNo(e.target.value)} style={field}><option value="">-</option>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}R</option>)}</select></label>
            </div>
            <label><div style={{fontWeight:800,marginBottom:6}}>一果に聞きたいこと</div><textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={500} rows={5} placeholder="例：この1号艇、展示後でも信頼していい？" style={{...field,resize:"vertical"}}/></label>
            <button onClick={submit} disabled={busy||question.trim().length<2} style={{padding:"15px 18px",border:0,borderRadius:14,background:"#b72828",color:"white",fontWeight:900,fontSize:17,opacity:busy?.65:1}}>{busy?"一果が確認中...":"一果に相談する"}</button>
            <div style={{fontSize:12,color:"#8a6666",lineHeight:1.7}}>β版：1日5回まで。現在はBoatStrikersの成立アラートを中心に一果目線で診断します。投票判断は最終的にご自身で行ってください。</div>
          </div>
          {error&&<div style={{marginTop:14,padding:12,borderRadius:12,background:"#fff0f0",color:"#a52020",fontWeight:700}}>{error}</div>}
        </section>

        <section style={{marginTop:18}}>
          <h2>相談履歴</h2>
          <div style={{display:"grid",gap:14}}>{history.length===0?<div style={card}>まだ相談はありません。</div>:history.map(item=><article key={item.id} style={card}>
            <div style={{fontSize:12,color:"#966",fontWeight:800}}>{item.course_name||"レース指定なし"}{item.race_no?` ${item.race_no}R`:""}</div>
            <div style={{marginTop:8,fontWeight:900}}>あなた：{item.question}</div>
            <div style={{marginTop:14,padding:16,borderRadius:16,background:"#fff7f7",whiteSpace:"pre-wrap",lineHeight:1.8}}>{item.ai_answer}</div>
            {item.admin_reply&&<div style={{marginTop:12,padding:16,borderRadius:16,background:"#fff2cf",lineHeight:1.8}}><strong>一果から追加返信</strong><br/>{item.admin_reply}</div>}
            {!item.escalated?<button onClick={()=>escalate(item.id)} disabled={busy} style={{marginTop:12,padding:"11px 14px",borderRadius:12,border:"1px solid #b72828",background:"white",color:"#b72828",fontWeight:900}}>もっと詳しく管理人に相談する</button>:<div style={{marginTop:12,fontSize:13,fontWeight:800,color:item.admin_status==="answered"?"#198754":"#a56b00"}}>{item.admin_status==="answered"?"追加返信済み":"管理人へ相談を送信済み"}</div>}
          </article>)}</div>
        </section>
      </>}
    </div>
  </main>;
}

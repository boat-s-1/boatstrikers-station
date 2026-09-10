"use client";

import { useEffect,useMemo,useState } from "react";
import { createClient } from "@supabase/supabase-js";

const CHARACTERS={ichika:{label:"一果",emoji:"🏁"},hatsune:{label:"初音",emoji:"🌸"},kiina:{label:"キイナ",emoji:"🚨"}};

function messageBody(m){
  if(m.content)return m.content;
  if(m.attachments?.length)return `📎 ${m.attachments.map(a=>a.name).join(" / ")}`;
  if(m.embeds_count)return `埋め込みメッセージ ${m.embeds_count}件`;
  return "本文を取得できません";
}

export default function DiscordRepliesAdmin(){
  const supabase=useMemo(()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),[]);
  const [character,setCharacter]=useState("ichika");
  const [token,setToken]=useState("");
  const [messages,setMessages]=useState([]);
  const [selected,setSelected]=useState(null);
  const [text,setText]=useState("");
  const [status,setStatus]=useState("読み込み中...");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{(async()=>{const {data}=await supabase.auth.getSession();const access=data?.session?.access_token||"";setToken(access);if(!access)setStatus("管理者アカウントでログインしてください");})();},[supabase]);
  useEffect(()=>{if(token)load();},[token,character]);

  async function load(){
    setStatus("読み込み中...");
    const r=await fetch(`/api/admin/discord-character-replies?character=${character}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setMessages([]);setStatus(j.error||"取得に失敗しました");return;}
    setMessages(j.messages||[]);setStatus(`${j.channel_name} の最新メッセージ`);
  }

  async function send(){
    if(!text.trim()||busy)return;
    setBusy(true);setStatus("送信中...");
    const r=await fetch("/api/admin/discord-character-replies",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({character,content:text.trim(),reply_user_id:selected?.author?.id||null})});
    const j=await r.json().catch(()=>({}));
    setBusy(false);
    if(!r.ok){setStatus(j.error||"送信に失敗しました");return;}
    setText("");setSelected(null);setStatus(`${CHARACTERS[character].label}名義で送信しました`);await load();
  }

  const visible=messages.filter(m=>!m.author?.bot&&!m.webhook);
  const hasMissingContent=visible.some(m=>m.content_unavailable);

  return <main style={{maxWidth:760,margin:"0 auto",padding:"24px 16px 80px",fontFamily:"system-ui,sans-serif"}}>
    <h1 style={{fontSize:28,marginBottom:6}}>Discord キャラ返信</h1>
    <p style={{color:"#667085",marginTop:0}}>質問を選んで、キャラクター名義で返信できます。</p>

    <div style={{display:"flex",gap:8,margin:"20px 0",flexWrap:"wrap"}}>
      {Object.entries(CHARACTERS).map(([key,c])=><button key={key} onClick={()=>{setCharacter(key);setSelected(null);setText("");}} style={{border:character===key?"2px solid #2563eb":"1px solid #d0d5dd",background:character===key?"#eff6ff":"white",borderRadius:12,padding:"10px 16px",fontWeight:800}}>{c.emoji} {c.label}</button>)}
    </div>

    <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:16,padding:16,marginBottom:18}}>
      <strong>{status}</strong>
      <button onClick={load} disabled={!token||busy} style={{float:"right",border:"1px solid #cbd5e1",background:"white",borderRadius:8,padding:"6px 10px"}}>更新</button>
    </div>

    {hasMissingContent&&<div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:14,padding:14,marginBottom:18,color:"#9a3412",fontSize:14,lineHeight:1.7}}>
      <strong>Discordの質問本文を取得できていません。</strong><br/>
      Discord Developer Portal → BoatStrikers Bot → Bot → Privileged Gateway Intents → <strong>Message Content Intent</strong> をONにしてください。保存後、この画面で「更新」を押すと本文が表示されます。
    </div>}

    <section style={{display:"grid",gap:10,marginBottom:22}}>
      {visible.length===0?<p style={{color:"#667085"}}>ユーザーからの質問はまだありません。</p>:visible.map(m=><button key={m.id} onClick={()=>setSelected(m)} style={{textAlign:"left",border:selected?.id===m.id?"2px solid #2563eb":"1px solid #e2e8f0",background:"white",borderRadius:14,padding:14}}>
        <div style={{fontWeight:800,marginBottom:5}}>{m.author?.name||"ユーザー"}</div>
        <div style={{whiteSpace:"pre-wrap",wordBreak:"break-word",color:m.content_unavailable?"#b45309":"inherit"}}>{messageBody(m)}</div>
        {m.attachments?.map(a=>a.url?<a key={a.id} href={a.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{display:"block",marginTop:6,color:"#2563eb"}}>添付を開く：{a.name}</a>:null)}
        <small style={{display:"block",color:"#98a2b3",marginTop:8}}>{m.created_at?new Date(m.created_at).toLocaleString("ja-JP"):""}</small>
      </button>)}
    </section>

    <section style={{border:"1px solid #e2e8f0",borderRadius:16,padding:16,background:"white"}}>
      <h2 style={{fontSize:20,marginTop:0}}>{CHARACTERS[character].emoji} {CHARACTERS[character].label}として返信</h2>
      {selected?<p style={{background:"#f8fafc",padding:10,borderRadius:10,fontSize:14}}>返信先：<strong>{selected.author?.name}</strong><br/>{messageBody(selected)}</p>:<p style={{color:"#667085",fontSize:14}}>質問を選ばない場合は通常投稿になります。</p>}
      <textarea value={text} onChange={e=>setText(e.target.value)} maxLength={1800} rows={7} placeholder={`${CHARACTERS[character].label}として返信する文章を入力`} style={{width:"100%",boxSizing:"border-box",border:"1px solid #cbd5e1",borderRadius:12,padding:12,fontSize:16,resize:"vertical"}} />
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}><small>{text.length}/1800</small><button onClick={send} disabled={!token||!text.trim()||busy} style={{border:0,borderRadius:10,padding:"11px 18px",fontWeight:800,background:"#2563eb",color:"white",opacity:(!token||!text.trim()||busy)?.55:1}}>{busy?"送信中...":`${CHARACTERS[character].label}名義で送信`}</button></div>
    </section>
  </main>;
}

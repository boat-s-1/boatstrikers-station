"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

function findInsertionPoint(){
  const lists=[...document.querySelectorAll('[class*="notificationList"]')];
  const list=lists.find(el=>el.textContent?.includes("一果・隠れイン理論"));
  if(!list)return null;
  let holder=document.getElementById("ichika-escape-surge-notification-holder");
  if(holder)return holder;
  holder=document.createElement("div");
  holder.id="ichika-escape-surge-notification-holder";
  const rows=[...list.children];
  const hiddenRow=rows.find(el=>el.textContent?.includes("一果・隠れイン理論"));
  if(hiddenRow?.nextSibling)list.insertBefore(holder,hiddenRow.nextSibling);
  else list.appendChild(holder);
  return holder;
}

export default function SurgeNotificationBridge(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [target,setTarget]=useState(null);
  const [userId,setUserId]=useState("");
  const [lineLinked,setLineLinked]=useState(false);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    function locate(){
      if(cancelled)return;
      const point=findInsertionPoint();
      if(point)setTarget(point);
    }
    locate();
    const timer=setInterval(locate,500);
    return()=>{cancelled=true;clearInterval(timer);};
  },[]);

  useEffect(()=>{
    if(!supabase)return;
    let alive=true;
    async function load(){
      const {data:{session}}=await supabase.auth.getSession();
      if(!alive||!session?.user?.id)return;
      const uid=session.user.id;
      setUserId(uid);
      const [{data:profile},{data:pref}]=await Promise.all([
        supabase.from("bs_member_profiles").select("line_user_id,line_linked_at").eq("user_id",uid).maybeSingle(),
        supabase.from("bs_member_notification_preferences").select("ichika_escape_surge").eq("user_id",uid).maybeSingle(),
      ]);
      if(!alive)return;
      setLineLinked(Boolean(profile?.line_user_id||profile?.line_linked_at));
      setChecked(Boolean(pref?.ichika_escape_surge));
    }
    load();
    return()=>{alive=false;};
  },[supabase]);

  async function toggle(){
    if(!supabase||!userId||!lineLinked||busy)return;
    const next=!checked;
    setBusy(true);
    setChecked(next);
    const {error}=await supabase.from("bs_member_notification_preferences")
      .upsert({user_id:userId,ichika_escape_surge:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(error)setChecked(!next);
    setBusy(false);
  }

  if(!target)return null;
  return createPortal(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"22px 28px",border:"1px solid #dfe6ee",borderRadius:22,background:"#fff",minHeight:118,marginBottom:16,boxSizing:"border-box"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:14,minWidth:0}}>
        <b style={{fontSize:30,lineHeight:1}}>🔥</b>
        <span style={{display:"grid",gap:5,minWidth:0}}>
          <strong style={{fontSize:22,lineHeight:1.25,color:"#14243d"}}>一果・イン逃げ急上昇アラート</strong>
          <small style={{fontSize:16,lineHeight:1.45,color:"#8a96a6"}}>展示1位＋一周1位でイン逃げ率が約15pt上昇した時に通知します</small>
        </span>
      </div>
      <button type="button" onClick={toggle} disabled={!lineLinked||busy} aria-pressed={checked} aria-label={`一果・イン逃げ急上昇アラート ${checked?"ON":"OFF"}`} style={{width:82,height:48,border:0,borderRadius:999,padding:4,background:checked?"#06c755":"#e9eef6",display:"flex",justifyContent:checked?"flex-end":"flex-start",alignItems:"center",flex:"0 0 auto",opacity:(!lineLinked||busy)?.65:1,cursor:(!lineLinked||busy)?"default":"pointer",transition:".2s"}}>
        <span style={{display:"block",width:40,height:40,borderRadius:"50%",background:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,.12)"}} />
      </button>
    </div>,
    target
  );
}

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

  const rows=[...list.children].filter(el=>el.id!=="ichika-escape-surge-notification-holder");
  const hiddenRow=rows.find(el=>el.textContent?.includes("一果・隠れイン理論"));
  if(!hiddenRow)return null;

  let holder=document.getElementById("ichika-escape-surge-notification-holder");
  if(!holder){
    holder=document.createElement("div");
    holder.id="ichika-escape-surge-notification-holder";
    holder.style.display="contents";
    if(hiddenRow.nextSibling)list.insertBefore(holder,hiddenRow.nextSibling);
    else list.appendChild(holder);
  }

  const textWrap=hiddenRow.children?.[0];
  const hiddenButton=hiddenRow.querySelector("button");
  const offRow=rows.find(el=>el.querySelector('button[aria-pressed="false"]'));
  const offButton=offRow?.querySelector("button");

  return {
    holder,
    rowClass:hiddenRow.className||"",
    textClass:textWrap?.className||"",
    buttonOnClass:hiddenButton?.className||"",
    buttonOffClass:offButton?.className||hiddenButton?.className||"",
  };
}

export default function SurgeNotificationBridge(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [mount,setMount]=useState(null);
  const [userId,setUserId]=useState("");
  const [lineLinked,setLineLinked]=useState(false);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    function locate(){
      if(cancelled)return;
      const point=findInsertionPoint();
      if(point)setMount(point);
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

  if(!mount?.holder)return null;

  return createPortal(
    <div className={mount.rowClass}>
      <div className={mount.textClass}>
        <b>🔥</b>
        <span>
          <strong>一果・イン逃げ急上昇</strong>
          <small>展示1位＋一周1位で通知</small>
        </span>
      </div>
      <button
        type="button"
        className={checked?mount.buttonOnClass:mount.buttonOffClass}
        onClick={toggle}
        disabled={!lineLinked||busy}
        aria-pressed={checked}
        aria-label={`一果・イン逃げ急上昇 ${checked?"ON":"OFF"}`}
      ><span /></button>
    </div>,
    mount.holder
  );
}

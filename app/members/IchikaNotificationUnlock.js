"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function IchikaNotificationUnlock(){
  useEffect(()=>{
    const supabase=makeSupabase();
    if(!supabase)return;
    let currentButton=null;
    let currentHandler=null;

    const paint=(button,on)=>{
      button.disabled=false;
      button.removeAttribute("disabled");
      button.setAttribute("aria-pressed",on?"true":"false");
      button.style.opacity="1";
      button.style.cursor="pointer";
      if(on){
        button.style.background="#22c55e";
        const knob=button.querySelector("span");
        if(knob)knob.style.transform="translateX(26px)";
      }else{
        button.style.background="#e8edf5";
        const knob=button.querySelector("span");
        if(knob)knob.style.transform="translateX(0)";
      }
    };

    const bind=async()=>{
      const title=[...document.querySelectorAll("strong")].find(el=>el.textContent?.trim()==="一果・イン逃げ注目");
      if(!title)return;
      const item=title.closest("div")?.parentElement;
      if(!item)return;
      item.style.opacity="1";
      const desc=title.parentElement?.querySelector("small");
      if(desc)desc.textContent="B1×展示色なし×1周1位の隠れイン条件を通知";
      const coming=title.parentElement?.querySelector("em");
      if(coming)coming.remove();

      const note=[...document.querySelectorAll("small")].find(el=>el.textContent?.includes("現在実際に配信されるのは"));
      if(note)note.textContent="現在実際に配信されるのは「4→5展開理論」と「一果・イン逃げ注目」です。";

      const button=item.querySelector('button[aria-label*="一果・イン逃げ注目"]')||item.querySelector("button");
      if(!button||button===currentButton)return;

      const {data:{session}}=await supabase.auth.getSession();
      if(!session)return;
      const {data}=await supabase.from("bs_member_notification_preferences").select("ichika_escape").eq("user_id",session.user.id).maybeSingle();
      let on=Boolean(data?.ichika_escape);
      paint(button,on);

      currentButton=button;
      currentHandler=async(event)=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        const next=!on;
        paint(button,next);
        const {error}=await supabase.from("bs_member_notification_preferences")
          .upsert({user_id:session.user.id,ichika_escape:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});
        if(error){paint(button,on);return;}
        on=next;
      };
      button.addEventListener("click",currentHandler,true);
    };

    bind();
    const observer=new MutationObserver(()=>bind());
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["disabled","class"]});
    return()=>{
      observer.disconnect();
      if(currentButton&&currentHandler)currentButton.removeEventListener("click",currentHandler,true);
    };
  },[]);

  return null;
}

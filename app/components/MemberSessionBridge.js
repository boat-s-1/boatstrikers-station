"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { clearMemberSession, syncMemberSession } from "../lib/memberSessionSync";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function MemberSessionBridge(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  useEffect(()=>{
    if(!supabase)return;
    let alive=true;

    const sync=async (session, source)=>{
      try{
        if(session?.access_token){
          await syncMemberSession(session, { source });
        }else{
          await clearMemberSession();
        }
      }catch(error){
        console.error("[MemberSessionBridge]",error);
      }
    };

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!alive)return;

      if(event==="SIGNED_OUT"){
        clearMemberSession().catch(error=>console.error("[MemberSessionBridge]",error));
        return;
      }
      if(["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) {
        sync(session||null, event);
      }
    });

    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);
  return null;
}

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

    const sync=async session=>{
      try{
        if(session?.access_token){
          await syncMemberSession(session);
        }else{
          await clearMemberSession();
        }
      }catch(error){
        console.error("[MemberSessionBridge]",error);
      }
    };

    // Initial page load uses the same shared sync path as auth events. If
    // INITIAL_SESSION fires at the same time, the in-flight Promise is reused.
    supabase.auth.getSession().then(({data})=>{if(alive)sync(data.session||null);});

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!alive)return;

      // Logout must invalidate the member cookie immediately. Login is also
      // immediate because logout clears the stored sync timestamp; routine
      // INITIAL_SESSION/TOKEN_REFRESHED events are suppressed by the 40m TTL.
      if(event==="SIGNED_OUT"){
        clearMemberSession().catch(error=>console.error("[MemberSessionBridge]",error));
        return;
      }
      sync(session||null);
    });

    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);
  return null;
}

"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

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
          await fetch("/api/members/session",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
        }else{
          await fetch("/api/members/session",{method:"DELETE",cache:"no-store"});
        }
      }catch(error){
        console.error("[MemberSessionBridge]",error);
      }
    };
    supabase.auth.getSession().then(({data})=>{if(alive)sync(data.session||null);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(alive)sync(session||null);});
    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);
  return null;
}

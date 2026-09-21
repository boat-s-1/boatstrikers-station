"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { clearMemberSession, syncMemberSession } from "../lib/memberSessionSync";
import {
  publishMemberAuthLoading,
  publishMemberAuthSession,
  publishMemberAuthSignedOut,
  registerMemberSignOut,
} from "../lib/memberAuthState";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function MemberSessionBridge(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  useEffect(()=>{
    if(!supabase){
      publishMemberAuthSignedOut();
      return;
    }
    let alive=true;
    let stateVersion=0;
    publishMemberAuthLoading();

    const sync=async session=>{
      const requestVersion=++stateVersion;
      try{
        if(session?.access_token){
          await syncMemberSession(session);
          if(alive&&requestVersion===stateVersion)publishMemberAuthSession(session);
        }else{
          await clearMemberSession();
          if(alive&&requestVersion===stateVersion)publishMemberAuthSignedOut();
        }
      }catch(error){
        console.error("[MemberSessionBridge]",error);
        if(alive&&requestVersion===stateVersion)publishMemberAuthSignedOut();
      }
    };

    const unregisterSignOut=registerMemberSignOut(async()=>{
      const requestVersion=++stateVersion;
      const {error}=await supabase.auth.signOut();
      if(error)throw error;
      publishMemberAuthSignedOut();
      try{
        await clearMemberSession();
      }catch(error){
        console.error("[MemberSessionBridge]",error);
      }
      return requestVersion;
    });

    // Initial page load uses the same shared sync path as auth events. If
    // INITIAL_SESSION fires at the same time, the in-flight Promise is reused.
    const initialVersion=stateVersion;
    supabase.auth.getSession()
      .then(({data,error})=>{
        if(!alive||stateVersion!==initialVersion)return;
        if(error)throw error;
        sync(data?.session||null);
      })
      .catch(error=>{
        console.error("[MemberSessionBridge]",error);
        if(alive&&stateVersion===initialVersion){
          stateVersion+=1;
          publishMemberAuthSignedOut();
          clearMemberSession().catch(clearError=>console.error("[MemberSessionBridge]",clearError));
        }
      });

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(!alive)return;

      // Whichever initial source arrives first owns the first sync. This avoids
      // even starting a second request in the common getSession/INITIAL_SESSION race.
      if(event==="INITIAL_SESSION"&&stateVersion!==initialVersion)return;

      // Logout must invalidate the member cookie immediately. Login is also
      // immediate because logout clears the stored sync timestamp; routine
      // INITIAL_SESSION/TOKEN_REFRESHED events are suppressed by the 40m TTL.
      if(event==="SIGNED_OUT"){
        stateVersion+=1;
        publishMemberAuthSignedOut();
        clearMemberSession().catch(error=>console.error("[MemberSessionBridge]",error));
        return;
      }
      sync(session||null);
    });

    return()=>{
      alive=false;
      stateVersion+=1;
      unregisterSignOut();
      subscription.unsubscribe();
    };
  },[supabase]);
  return null;
}

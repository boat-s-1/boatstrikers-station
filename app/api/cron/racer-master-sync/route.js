import { NextResponse } from "next/server";
import { getAdminSupabase } from "../../../admin/sync/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { fetchProfile } from "../../../../lib/racer-profile-sync";

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}
function jstDateString(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function compact(v){return v?String(v).replace(/[\s　]+/g,""):null;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});

  // Bound all I/O to leave response time before Vercel's 60-second limit.
  const signal=AbortSignal.timeout(52000);
  const started=Date.now();
  const today=jstDateString();

  try{
    const db=getAdminSupabase();
    const entries=[];
    for(let offset=0;;offset+=500){
      const {data:page,error:entriesError}=await db
        .from("bs_race_entries")
        .select("racer_registration_no,racer_name,racer_name_kana,racer_branch,racer_class,gender,race_date")
        .eq("race_date",today)
        .not("racer_registration_no","is",null)
        .order("id").range(offset,offset+499).abortSignal(signal);
      if(entriesError)throw entriesError;
      entries.push(...(page||[]));
      if(!page||page.length<500)break;
    }

    const unique=new Map();
    for(const row of entries||[]){
      const raw=String(row.racer_registration_no||"").trim();
      if(!/^\d{1,5}$/.test(raw)||Number(raw)===0)continue;
      const no=raw.padStart(5,"0");
      unique.set(no,{
        registration_no:no,
        racer_name:row.racer_name||null,
        racer_name_kana:row.racer_name_kana||null,
        racer_branch:row.racer_branch||null,
        racer_class:row.racer_class||null,
        gender:row.gender||null,
        last_seen_date:today,
        updated_at:new Date().toISOString(),
      });
    }

    // Query in bounded chunks; Supabase row limits must not hide existing racers.
    const numbers=[...unique.keys()];
    for(let i=0;i<numbers.length;i+=200){
      const {data:existing,error}=await db.from("bs_racers")
        .select("registration_no").in("registration_no",numbers.slice(i,i+200)).abortSignal(signal);
      if(error)throw error;
      for(const row of existing||[])unique.delete(row.registration_no);
    }
    if(unique.size){
      const {error:queueError}=await db
        .from("bs_racer_sync_queue")
        .upsert([...unique.values()],{onConflict:"registration_no"}).abortSignal(signal);
      if(queueError)throw queueError;
    }

    const {data:candidates,error:candidateError}=await db.rpc("bs_racer_sync_candidates",{
      p_recent_days:7,
      p_limit:4,
    }).abortSignal(signal);
    if(candidateError)throw candidateError;

    const synced=[];
    const failed=[];
    const queue=(candidates||[]).slice(0,4);
    let deferred=0;
    for(let i=0;i<queue.length;i+=2){
      // Reserve enough time for two 10s attempts and database writes.
      if(Date.now()-started>28000){deferred=queue.length-i;break;}
      const chunk=queue.slice(i,i+2);
      const results=await Promise.all(chunk.map(async candidate=>{
        try{
          const profile=await fetchProfile(candidate,signal);
          const {error}=await db.from("bs_racers").upsert(profile,{onConflict:"registration_no"}).abortSignal(signal);
          if(error)throw error;
          return {ok:true,profile};
        }catch(error){
          return {ok:false,candidate,error:error instanceof Error?error.message:String(error)};
        }
      }));
      for(const result of results){
        if(result.ok){
          synced.push({registration_no:result.profile.registration_no,name:result.profile.name});
        }else{
          failed.push({
            registration_no:result.candidate.racer_registration_no,
            name:compact(result.candidate.racer_name)||result.candidate.racer_registration_no,
            error:result.error,
          });
        }
      }
      if(i+2<queue.length)await sleep(250);
    }

    const {count,error:countError}=await db.from("bs_racers").select("registration_no",{count:"exact",head:true}).abortSignal(signal);
    if(countError)throw countError;
    console.info(JSON.stringify({
      level:"info",message:"daily racer master sync complete",today,
      queueRefreshed:unique.size,candidates:queue.length,synced:synced.length,failed:failed.length,total:count||0,
    }));

    return NextResponse.json({
      ok:failed.length===0&&deferred===0,
      today,
      queue_refreshed:unique.size,
      candidates:queue.length,
      synced:synced.length,
      failed,
      deferred,
      total_profiles:count||0,
    },{status:failed.length||deferred?207:200});
  }catch(error){
    const message=String(error?.message||error).slice(0,1200);
    console.error(JSON.stringify({level:"error",message:"daily racer master sync failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

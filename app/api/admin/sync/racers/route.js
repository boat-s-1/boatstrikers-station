import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";
import { getAdminSupabase } from "../../../../admin/sync/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { fetchProfile } from "../../../../../lib/racer-profile-sync";

function compact(v){return v?String(v).replace(/[\s　]+/g,""):null;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

export async function POST(request){
  if(!(await isAdminAuthenticated()))return NextResponse.json({error:"unauthorized"},{status:401});
  let body={};
  try{body=await request.json();}catch{}
  const requested=Number(body?.limit??4);
  const limit=Number.isInteger(requested)?Math.min(Math.max(requested,1),8):4;
  const recentDays=7;
  const excluded=new Set(Array.isArray(body?.exclude)?body.exclude.map(v=>String(v||"").trim()).filter(v=>/^\d{5}$/.test(v)).slice(0,100):[]);
  const db=getAdminSupabase();

  const candidateLimit=Math.min(limit+excluded.size,100);
  const {data:candidates,error:candidateError}=await db.rpc("bs_racer_sync_candidates",{
    p_recent_days:recentDays,p_limit:candidateLimit,
  });
  if(candidateError)return NextResponse.json({error:candidateError.message},{status:500});

  const synced=[];
  const failed=[];
  const queue=(candidates||[]).filter(x=>!excluded.has(x.racer_registration_no)).slice(0,limit);
  for(let i=0;i<queue.length;i+=2){
    const chunk=queue.slice(i,i+2);
    const results=await Promise.all(chunk.map(async(candidate)=>{
      try{
        const profile=await fetchProfile(candidate);
        const {error}=await db.from("bs_racers").upsert(profile,{onConflict:"registration_no"});
        if(error)throw error;
        return {ok:true,profile};
      }catch(error){
        return {
          ok:false,
          candidate,
          error:error instanceof Error?error.message:String(error),
        };
      }
    }));
    for(const result of results){
      if(result.ok){
        synced.push({registration_no:result.profile.registration_no,name:result.profile.name,birthday:result.profile.birthday});
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

  const {count}=await db.from("bs_racers").select("registration_no",{count:"exact",head:true});
  return NextResponse.json({
    ok:failed.length===0,
    requested:limit,
    candidates:queue.length,
    synced:synced.length,
    failed,
    total_profiles:count||0,
  },{status:failed.length?207:200});
}

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBoatersOriginalTenji } from "../../../../lib/boatersOriginalTenji";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_CRON_TOKEN_SHA256 = "d27064366c4812943a53cd5f8d8419c5cc95e9a4b4728488976f48f450510b8c";

function getSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase環境変数が未設定です");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function minutesUntil(raceDate,closingTime){if(!closingTime)return null;const t=String(closingTime).slice(0,8);const ms=new Date(`${raceDate}T${t}+09:00`).getTime()-Date.now();return ms/60000;}
function authorized(request){
  const secret=process.env.CRON_SECRET;
  if(secret&&request.headers.get("authorization")===`Bearer ${secret}`)return true;
  const token=request.headers.get("x-supabase-cron-token")||"";
  const digest=crypto.createHash("sha256").update(token).digest("hex");
  return token.length>0&&crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(SUPABASE_CRON_TOKEN_SHA256));
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const supabase=getSupabase();
    const raceDate=jstToday();
    const {data:events,error:eventError}=await supabase.from("bs_race_events").select("race_date,course_code,course_name,race_no,closing_time").eq("race_date",raceDate).not("closing_time","is",null);
    if(eventError)throw eventError;
    const targets=(events||[]).map(r=>({...r,remaining:minutesUntil(r.race_date,r.closing_time)})).filter(r=>r.remaining!==null&&r.remaining<=18&&r.remaining>=2).sort((a,b)=>a.remaining-b.remaining).slice(0,8);
    const results=[];
    for(const race of targets){
      const source=await fetchBoatersOriginalTenji({raceDate:race.race_date,courseCode:race.course_code,raceNo:race.race_no});
      if(!source.ok){results.push({courseCode:race.course_code,raceNo:race.race_no,remaining:race.remaining,published:false,status:source.status||null,error:source.error||null});continue;}
      const syncedAt=new Date().toISOString();
      for(const row of source.rows){
        const {error:updateError}=await supabase.from("bs_race_entries").update({official_lap:row.lapTime,official_turn:row.turnTime,official_straight:row.straightTime,official_exhibition_time:row.exhibitionTime,official_exhibition_source:"boaters_realtime",official_exhibition_synced_at:syncedAt}).eq("race_date",race.race_date).eq("course_code",race.course_code).eq("race_no",race.race_no).eq("boat_no",row.boatNo);
        if(updateError)throw updateError;
      }
      const {data:inserted,error:evalError}=await supabase.rpc("evaluate_boat4_double_top_alerts");
      if(evalError)throw evalError;
      results.push({courseCode:race.course_code,raceNo:race.race_no,remaining:race.remaining,published:true,rows:source.rows.length,inserted:Number(inserted||0)});
    }
    return NextResponse.json({ok:true,raceDate,checked:targets.length,results,ranAt:new Date().toISOString()});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"cron failed"},{status:500});}
}

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
function formatClosingTime(value){
  if(!value)return null;
  return String(value).slice(0,5);
}
function buildLineText(alert){
  const remaining=minutesUntil(alert.race_date,alert.closing_time);
  const remainingText=remaining===null?"":`\n締切まで約${Math.max(0,Math.ceil(remaining))}分`;
  const closing=formatClosingTime(alert.closing_time);
  const closingText=closing?`\n締切 ${closing}`:"";
  const raceUrl=`https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`;
  return [
    "🚨【4号艇ダブル上位】",
    `${alert.course_name||""} ${alert.race_no}R`,
    `④ 展示 ${alert.exhibition_time??"-"}【${alert.exhibition_rank??"-"}位】`,
    `④ 直線 ${alert.straight_time??"-"}【${alert.straight_rank??"-"}位】`,
    `${closingText}${remainingText}`.trim(),
    "BoatStrikersでレース詳細を見る",
    raceUrl,
  ].filter(Boolean).join("\n");
}
async function sendLineBroadcast(text){
  const accessToken=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if(!accessToken)throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response=await fetch("https://api.line.me/v2/bot/message/broadcast",{
    method:"POST",
    headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
    body:JSON.stringify({messages:[{type:"text",text}],notificationDisabled:false}),
  });
  if(!response.ok){
    const body=await response.text().catch(()=>"");
    throw new Error(`LINE broadcast failed: ${response.status} ${body}`.trim());
  }
}
async function sendPendingLineAlerts(supabase,raceDate){
  const {data:alerts,error}=await supabase.from("bs_exhibition_alerts")
    .select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_time,exhibition_rank,straight_time,straight_rank,detected_at,notified")
    .eq("race_date",raceDate).eq("notified",false).order("detected_at",{ascending:true}).limit(10);
  if(error)throw error;
  const sent=[];
  const failed=[];
  for(const alert of alerts||[]){
    try{
      await sendLineBroadcast(buildLineText(alert));
      const now=new Date().toISOString();
      const {error:updateError}=await supabase.from("bs_exhibition_alerts")
        .update({notified:true,notified_at:now,updated_at:now}).eq("id",alert.id).eq("notified",false);
      if(updateError)throw updateError;
      sent.push(alert.id);
    }catch(error){
      failed.push({id:alert.id,error:error?.message||"LINE send failed"});
    }
  }
  return {pending:(alerts||[]).length,sent,failed};
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
    const line=await sendPendingLineAlerts(supabase,raceDate);
    return NextResponse.json({ok:true,raceDate,checked:targets.length,results,line,ranAt:new Date().toISOString()});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"cron failed"},{status:500});}
}

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const SUPABASE_CRON_TOKEN_SHA256 = "8ba9be2c4bdca06f432f838869131995057bc2f482b8ac0bbf1fba9f4ad133aa";

function getSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function authorized(request){
  const secret=process.env.CRON_SECRET;
  if(secret&&request.headers.get("authorization")===`Bearer ${secret}`)return true;
  const token=request.headers.get("x-supabase-cron-token")||"";
  if(!token)return false;
  const digest=crypto.createHash("sha256").update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(SUPABASE_CRON_TOKEN_SHA256));
}

function jstToday(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

function minutesUntil(raceDate,closingTime){
  if(!closingTime)return null;
  const t=String(closingTime).slice(0,8);
  return (new Date(`${raceDate}T${t}+09:00`).getTime()-Date.now())/60000;
}

function buildLineText(alert){
  const remaining=minutesUntil(alert.race_date,alert.closing_time);
  const remainingMinutes=remaining===null?null:Math.max(0,Math.ceil(remaining));
  const closing=alert.closing_time?String(alert.closing_time).slice(0,5):null;
  const raceUrl=`https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`;
  const closingLine=[closing?`〆切 ${closing}`:"",remainingMinutes===null?"":`あと${remainingMinutes}分`].filter(Boolean).join("｜");
  return ["【速報】カド攻め理論成立！","",`${alert.course_name||""} ${alert.race_no}R`,closingLine,"",`展示${alert.exhibition_rank??"-"}位 ＋ 直線${alert.straight_rank??"-"}位`,"","出走表・展示情報はコチラ",raceUrl]
    .filter((line,index,lines)=>line!==""||(index>0&&lines[index-1]!=="")).join("\n");
}

async function getRecipients(supabase){
  const {data:prefs,error:prefsError}=await supabase.from("bs_member_notification_preferences").select("user_id").eq("boat4_double_top",true);
  if(prefsError)throw prefsError;
  const userIds=(prefs||[]).map(row=>row.user_id).filter(Boolean);
  if(!userIds.length)return [];
  const {data:profiles,error:profilesError}=await supabase.from("bs_member_profiles").select("line_user_id").in("user_id",userIds).eq("membership_status","active").not("line_user_id","is",null);
  if(profilesError)throw profilesError;
  return [...new Set((profiles||[]).map(row=>row.line_user_id).filter(Boolean))];
}

async function multicast(userIds,text){
  if(!userIds.length)return 0;
  const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if(!token)throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  let sent=0;
  for(let index=0;index<userIds.length;index+=500){
    const to=userIds.slice(index,index+500);
    const response=await fetch("https://api.line.me/v2/bot/message/multicast",{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false}),
    });
    if(!response.ok){
      const body=await response.text().catch(()=>"");
      throw new Error(`LINE multicast failed: ${response.status} ${body}`.trim());
    }
    sent+=to.length;
  }
  return sent;
}

async function sendPending(supabase,raceDate){
  const {data:alerts,error}=await supabase.from("bs_exhibition_alerts")
    .select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,straight_rank,detected_at")
    .eq("race_date",raceDate).eq("notified",false).order("detected_at",{ascending:true}).limit(20);
  if(error)throw error;
  const recipients=await getRecipients(supabase);
  if(!recipients.length)return {pending:(alerts||[]).length,eligibleRecipients:0,sent:[],failed:[]};

  const sent=[];const failed=[];
  for(const alert of alerts||[]){
    try{
      const recipientCount=await multicast(recipients,buildLineText(alert));
      const now=new Date().toISOString();
      const {error:updateError}=await supabase.from("bs_exhibition_alerts")
        .update({notified:true,notified_at:now,updated_at:now})
        .eq("id",alert.id).eq("notified",false);
      if(updateError)throw updateError;
      sent.push({id:alert.id,recipients:recipientCount});
    }catch(error){
      const message=String(error?.message||error).slice(0,1000);
      console.error(JSON.stringify({level:"error",message:"kiina line send failed",alertId:alert.id,error:message}));
      failed.push({id:alert.id,error:message});
    }
  }
  return {pending:(alerts||[]).length,eligibleRecipients:recipients.length,sent,failed};
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const startedAt=Date.now();
  try{
    const supabase=getSupabase();
    const raceDate=jstToday();
    const {data:inserted,error:evaluationError}=await supabase.rpc("evaluate_boat4_double_top_alerts");
    if(evaluationError)throw evaluationError;
    const line=await sendPending(supabase,raceDate);
    console.info(JSON.stringify({level:"info",message:"kiina line cron complete",raceDate,inserted:Number(inserted||0),sent:line.sent.length,failed:line.failed.length,durationMs:Date.now()-startedAt}));
    return NextResponse.json({ok:true,raceDate,inserted:Number(inserted||0),line,ranAt:new Date().toISOString()});
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    console.error(JSON.stringify({level:"error",message:"kiina line cron failed",error:message,durationMs:Date.now()-startedAt}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

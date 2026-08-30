import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_CRON_TOKEN_SHA256 = "8ba9be2c4bdca06f432f838869131995057bc2f482b8ac0bbf1fba9f4ad133aa";

function getSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase環境変数が未設定です");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function authorized(request){const secret=process.env.CRON_SECRET;if(secret&&request.headers.get("authorization")===`Bearer ${secret}`)return true;const token=request.headers.get("x-supabase-cron-token")||"";if(!token)return false;const digest=crypto.createHash("sha256").update(token).digest("hex");return crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(SUPABASE_CRON_TOKEN_SHA256));}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function minutesUntil(raceDate,closingTime){if(!closingTime)return null;return (new Date(`${raceDate}T${String(closingTime).slice(0,8)}+09:00`).getTime()-Date.now())/60000;}
function formatClosingTime(value){return value?String(value).slice(0,5):null;}
function buildLineText(alert){const remaining=minutesUntil(alert.race_date,alert.closing_time);const closing=formatClosingTime(alert.closing_time);const raceUrl=`https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`;const exGap=Number(alert.exhibition_advantage||0).toFixed(2);const lapGap=Number(alert.lap_advantage||0).toFixed(2);const level=alert.danger_level==="super_danger"?"🌸🌸 超警戒":"🌸 警戒";return [`🌸【初音・女子イン崩れ理論】${level}`,`${alert.course_name||""} ${alert.race_no}R`,`②が①より展示 ${exGap}秒速い`,`②が①より1周 ${lapGap}秒速い`,alert.danger_level==="super_danger"?"②③ともに①を上回る超警戒条件":"女子戦でイン崩れ条件成立",closing?`締切 ${closing}`:"",remaining===null?"":`締切まで約${Math.max(0,Math.ceil(remaining))}分`,"レース詳細を見る",raceUrl].filter(Boolean).join("\n");}
async function getRecipients(supabase){const {data:prefs,error:prefsError}=await supabase.from("bs_member_notification_preferences").select("user_id").eq("hatsune_venus",true);if(prefsError)throw prefsError;const ids=(prefs||[]).map(x=>x.user_id).filter(Boolean);if(!ids.length)return [];const {data:profiles,error:profilesError}=await supabase.from("bs_member_profiles").select("line_user_id").in("user_id",ids).eq("membership_status","active").not("line_user_id","is",null);if(profilesError)throw profilesError;return [...new Set((profiles||[]).map(x=>x.line_user_id).filter(Boolean))];}
async function sendLineMulticast(userIds,text){if(!userIds.length)return 0;const accessToken=process.env.LINE_CHANNEL_ACCESS_TOKEN;if(!accessToken)throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");let sent=0;for(let i=0;i<userIds.length;i+=500){const to=userIds.slice(i,i+500);const response=await fetch("https://api.line.me/v2/bot/message/multicast",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false})});if(!response.ok){const body=await response.text().catch(()=>"");throw new Error(`LINE multicast failed: ${response.status} ${body}`.trim());}sent+=to.length;}return sent;}
async function sendPendingAlerts(supabase,raceDate){const {data:alerts,error}=await supabase.from("bs_hatsune_womens_inner_break_alerts").select("*").eq("race_date",raceDate).eq("notified",false).order("detected_at",{ascending:true}).limit(20);if(error)throw error;const recipients=await getRecipients(supabase);if(!recipients.length){console.warn("[line-notification] no eligible recipients",{theory:"hatsune_womens_inner_break",raceDate,pending:(alerts||[]).length});}const sent=[];const failed=[];for(const alert of alerts||[]){try{const recipientCount=await sendLineMulticast(recipients,buildLineText(alert));const now=new Date().toISOString();const {error:updateError}=await supabase.from("bs_hatsune_womens_inner_break_alerts").update({notified:true,notified_at:now,updated_at:now}).eq("id",alert.id).eq("notified",false);if(updateError)throw updateError;sent.push({id:alert.id,recipients:recipientCount});}catch(error){const message=String(error?.message||"LINE send failed").slice(0,1000);console.error("[line-notification] send failed",{theory:"hatsune_womens_inner_break",alertId:alert.id,raceDate:alert.race_date,courseCode:alert.course_code,raceNo:alert.race_no,recipientCount:recipients.length,error:message});failed.push({id:alert.id,error:message});}}return {pending:(alerts||[]).length,eligibleRecipients:recipients.length,sent,failed};}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const supabase=getSupabase();
    const raceDate=jstToday();

    // Exhibition collection is owned by /api/cron/exhibition-alerts.
    // Hatsune only evaluates already-persisted official exhibition data.
    const {data:inserted,error:evalError}=await supabase.rpc("evaluate_hatsune_womens_inner_break_alerts");
    if(evalError)throw evalError;

    console.info("[theory-eval]",{
      theory:"hatsune_womens_inner_break",
      exhibitionSource:"shared_database",
      externalFetch:false,
      inserted:Number(inserted||0),
    });

    const line=await sendPendingAlerts(supabase,raceDate);
    return NextResponse.json({
      ok:true,
      raceDate,
      exhibitionSource:"shared_database",
      externalFetch:false,
      inserted:Number(inserted||0),
      line,
      ranAt:new Date().toISOString(),
    });
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"hatsune cron failed"},{status:500});}
}

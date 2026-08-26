import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBoatersOriginalTenji } from "../../../../lib/boatersOriginalTenji";
import { buildPhase2Predictions } from "../../../lib/phase2PredictionEngine";
import {
  predictionToDatabaseRow,
  upsertPredictionRows,
} from "../../../lib/aiPredictionPersistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_CRON_TOKEN_SHA256 = "d27064366c4812943a53cd5f8d8419c5cc95e9a4b4728488976f48f450510b8c";

function getSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase環境変数が未設定です");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function minutesUntil(raceDate,closingTime){if(!closingTime)return null;const t=String(closingTime).slice(0,8);const ms=new Date(`${raceDate}T${t}+09:00`).getTime()-Date.now();return ms/60000;}
function authorized(request){const secret=process.env.CRON_SECRET;if(secret&&request.headers.get("authorization")===`Bearer ${secret}`)return true;const token=request.headers.get("x-supabase-cron-token")||"";const digest=crypto.createHash("sha256").update(token).digest("hex");return token.length>0&&crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(SUPABASE_CRON_TOKEN_SHA256));}
function formatClosingTime(value){return value?String(value).slice(0,5):null;}
function buildLineText(alert){const remaining=minutesUntil(alert.race_date,alert.closing_time);const remainingText=remaining===null?"":`\n締切まで約${Math.max(0,Math.ceil(remaining))}分`;const closing=formatClosingTime(alert.closing_time);const closingText=closing?`\n締切 ${closing}`:"";const raceUrl=`https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`;return ["🚨【4→5展開理論】",`${alert.course_name||""} ${alert.race_no}R`,`④ 展示 ${alert.exhibition_time??"-"}【${alert.exhibition_rank??"-"}位】`,`④ 直線 ${alert.straight_time??"-"}【${alert.straight_rank??"-"}位】`,`${closingText}${remainingText}`.trim(),"BoatStrikersでレース詳細を見る",raceUrl].filter(Boolean).join("\n");}

function hasValue(value){return value!==null&&value!==undefined&&value!=="";}
function numberOrNull(value){if(!hasValue(value))return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function firstValue(...values){return values.find(hasValue)??null;}

function mapLiveEntry(row){
  return {
    ...row,
    boat_no:Number(firstValue(row.boat_no,row.teiban)),
    racer_name:String(firstValue(row.racer_name,row.shimei)??"").replace(/\u3000/g," ").replace(/\s+/g," ").trim(),
    national_win_rate:numberOrNull(row.national_win_rate),
    local_win_rate:numberOrNull(row.local_win_rate),
    motor_2_rate:numberOrNull(firstValue(row.motor_top2_rate,row.motor_2_rate)),
    boat_2_rate:numberOrNull(firstValue(row.race_boat_top2_rate,row.boat_2_rate)),
    average_st:numberOrNull(row.average_st),
    exhibition_time:numberOrNull(firstValue(row.official_exhibition_time,row.exhibition_time)),
    exhibition_st:numberOrNull(firstValue(row.official_exhibition_st,row.exhibition_st)),
    exhibition_fl:String(firstValue(row.official_exhibition_symbol,row.exhibition_fl)??"").trim().toUpperCase(),
    official_lap:numberOrNull(firstValue(row.official_lap,row.lap_time)),
    lap_time:numberOrNull(firstValue(row.official_lap,row.lap_time)),
    official_turn:numberOrNull(firstValue(row.official_turn,row.turn_time)),
    turn_time:numberOrNull(firstValue(row.official_turn,row.turn_time)),
    official_straight:numberOrNull(firstValue(row.official_straight,row.straight_time)),
    straight_time:numberOrNull(firstValue(row.official_straight,row.straight_time)),
  };
}

async function generateLivePredictionForRace(supabase,race){
  const [eventResult,entriesResult]=await Promise.all([
    supabase.from("bs_race_events").select("*").eq("race_date",race.race_date).eq("course_code",race.course_code).eq("race_no",race.race_no).maybeSingle(),
    supabase.from("bs_race_entries").select("*").eq("race_date",race.race_date).eq("course_code",race.course_code).eq("race_no",race.race_no).order("boat_no",{ascending:true}),
  ]);
  if(eventResult.error)throw eventResult.error;
  if(entriesResult.error)throw entriesResult.error;
  const entries=(entriesResult.data||[]).map(mapLiveEntry);
  const exhibitionReady=entries.length===6&&entries.every(entry=>numberOrNull(entry.exhibition_time)!==null);
  if(!eventResult.data||!exhibitionReady)return{generated:false,reason:"exhibition_not_ready"};
  const {livePrediction}=buildPhase2Predictions({event:{...eventResult.data,wind_speed:numberOrNull(eventResult.data.wind_speed)},entries});
  if(!livePrediction)return{generated:false,reason:"live_prediction_unavailable"};
  const row=predictionToDatabaseRow({raceDate:race.race_date,courseCode:race.course_code,raceNo:race.race_no,prediction:livePrediction});
  await upsertPredictionRows(supabase,[row]);
  return{generated:true,predictedAt:row.predicted_at,score:row.score,mainBoat:row.main_boat};
}

async function getBoat4Recipients(supabase){
  const {data:prefs,error:prefsError}=await supabase.from("bs_member_notification_preferences").select("user_id").eq("boat4_double_top",true);
  if(prefsError)throw prefsError;
  const ids=(prefs||[]).map(x=>x.user_id).filter(Boolean);
  if(!ids.length)return [];
  const {data:profiles,error:profilesError}=await supabase.from("bs_member_profiles").select("user_id,line_user_id,membership_status").in("user_id",ids).eq("membership_status","active").not("line_user_id","is",null);
  if(profilesError)throw profilesError;
  return [...new Set((profiles||[]).map(x=>x.line_user_id).filter(Boolean))];
}

async function sendLineMulticast(userIds,text){
  if(!userIds.length)return 0;
  const accessToken=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if(!accessToken)throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  let sent=0;
  for(let i=0;i<userIds.length;i+=500){
    const to=userIds.slice(i,i+500);
    const response=await fetch("https://api.line.me/v2/bot/message/multicast",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({to,messages:[{type:"text",text}],notificationDisabled:false})});
    if(!response.ok){const body=await response.text().catch(()=>"");throw new Error(`LINE multicast failed: ${response.status} ${body}`.trim());}
    sent+=to.length;
  }
  return sent;
}

async function sendPendingLineAlerts(supabase,raceDate){
  const {data:alerts,error}=await supabase.from("bs_exhibition_alerts").select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_time,exhibition_rank,straight_time,straight_rank,detected_at,notified").eq("race_date",raceDate).eq("notified",false).order("detected_at",{ascending:true}).limit(10);
  if(error)throw error;
  const recipients=await getBoat4Recipients(supabase);
  const sent=[];const failed=[];
  for(const alert of alerts||[]){
    try{
      const recipientCount=await sendLineMulticast(recipients,buildLineText(alert));
      const now=new Date().toISOString();
      const {error:updateError}=await supabase.from("bs_exhibition_alerts").update({notified:true,notified_at:now,updated_at:now}).eq("id",alert.id).eq("notified",false);
      if(updateError)throw updateError;
      sent.push({id:alert.id,recipients:recipientCount});
    }catch(error){failed.push({id:alert.id,error:error?.message||"LINE send failed"});}
  }
  return {pending:(alerts||[]).length,eligibleRecipients:recipients.length,sent,failed};
}

function buildWeatherUpdate(weather,syncedAt){
  if(!weather)return null;
  const update={api_synced_at:syncedAt,updated_at:syncedAt};
  if(weather.weather){update.weather=weather.weather;update.weather_code=weather.weather;update.api_weather_code=weather.weather;}
  if(weather.windDirection){update.wind_direction=weather.windDirection;update.wind_direction_code=weather.windDirection;update.api_wind_direction_code=weather.windDirection;}
  if(weather.windSpeed!==null&&weather.windSpeed!==undefined){update.wind_speed=weather.windSpeed;update.api_wind_speed=weather.windSpeed;}
  if(weather.waveHeight!==null&&weather.waveHeight!==undefined){update.wave_height=weather.waveHeight;update.api_wave_height=weather.waveHeight;}
  if(weather.airTemperature!==null&&weather.airTemperature!==undefined){update.air_temperature=weather.airTemperature;update.api_air_temperature=weather.airTemperature;}
  if(weather.waterTemperature!==null&&weather.waterTemperature!==undefined){update.water_temperature=weather.waterTemperature;update.api_water_temperature=weather.waterTemperature;}
  return update;
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const supabase=getSupabase();const raceDate=jstToday();
    const {data:events,error:eventError}=await supabase.from("bs_race_events").select("race_date,course_code,course_name,race_no,closing_time").eq("race_date",raceDate).not("closing_time","is",null);if(eventError)throw eventError;
    const targets=(events||[]).map(r=>({...r,remaining:minutesUntil(r.race_date,r.closing_time)})).filter(r=>r.remaining!==null&&r.remaining<=18&&r.remaining>=2).sort((a,b)=>a.remaining-b.remaining).slice(0,8);
    const results=[];
    for(const race of targets){
      const source=await fetchBoatersOriginalTenji({raceDate:race.race_date,courseCode:race.course_code,raceNo:race.race_no});
      if(!source.ok){results.push({courseCode:race.course_code,raceNo:race.race_no,remaining:race.remaining,published:false,status:source.status||null,error:source.error||null});continue;}
      const syncedAt=new Date().toISOString();
      for(const row of source.rows){
        const update={official_lap:row.lapTime,official_turn:row.turnTime,official_straight:row.straightTime,official_exhibition_time:row.exhibitionTime,official_exhibition_source:"boaters_realtime",official_exhibition_synced_at:syncedAt};
        if(row.exhibitionSt!==null&&row.exhibitionSt!==undefined)update.official_exhibition_st=row.exhibitionSt;
        if(row.exhibitionSymbol!==undefined)update.official_exhibition_symbol=row.exhibitionSymbol||null;
        const {error:updateError}=await supabase.from("bs_race_entries").update(update).eq("race_date",race.race_date).eq("course_code",race.course_code).eq("race_no",race.race_no).eq("boat_no",row.boatNo);if(updateError)throw updateError;
      }
      const weatherUpdate=buildWeatherUpdate(source.weather,syncedAt);
      if(weatherUpdate){const {error:weatherError}=await supabase.from("bs_race_events").update(weatherUpdate).eq("race_date",race.race_date).eq("course_code",race.course_code).eq("race_no",race.race_no);if(weatherError)throw weatherError;}
      const liveAi=await generateLivePredictionForRace(supabase,race);
      const {data:inserted,error:evalError}=await supabase.rpc("evaluate_boat4_double_top_alerts");if(evalError)throw evalError;
      results.push({courseCode:race.course_code,raceNo:race.race_no,remaining:race.remaining,published:true,startPublished:Boolean(source.startPublished),weatherPublished:Boolean(source.weatherPublished),rows:source.rows.length,liveAi,inserted:Number(inserted||0)});
    }
    const line=await sendPendingLineAlerts(supabase,raceDate);
    return NextResponse.json({ok:true,raceDate,checked:targets.length,results,line,ranAt:new Date().toISOString()});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"cron failed"},{status:500});}
}

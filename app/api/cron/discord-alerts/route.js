import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureNotificationRoles, getAdminClient, sendDiscordMessage, discordApi } from "../../../lib/discordPremium";
import { buildPhase2Predictions } from "../../../lib/phase2PredictionEngine";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const ALERT_CHARACTERS={
  ichika:{name:"一果",avatarKey:"ichika",avatarMime:"image/jpeg",webhookName:"BSC ALERT 一果"},
  hatsune:{name:"初音",avatarKey:"hatsune-final",avatarMime:"image/jpeg",webhookName:"BSC ALERT 初音"},
  kiina:{name:"キイナ",avatarKey:"kiina",avatarMime:"image/jpeg",webhookName:"BSC ALERT キイナ"},
};
const webhookCache=new Map();

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function raceLink(alert){return `https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`;}
function closeText(alert){return alert.closing_time?String(alert.closing_time).slice(0,5):"--:--";}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function normalizeEntry(row){
  return {
    ...row,
    boat_no:Number(row.boat_no??row.teiban),
    racer_name:String(row.racer_name??row.shimei??"").replace(/\u3000/g," ").replace(/\s+/g," ").trim(),
    national_win_rate:finite(row.national_win_rate),
    local_win_rate:finite(row.local_win_rate),
    motor_2_rate:finite(row.motor_top2_rate??row.motor_2_rate),
    boat_2_rate:finite(row.race_boat_top2_rate??row.boat_2_rate),
    average_st:finite(row.average_st),
  };
}
function strengthLevel(score){
  const n=finite(score);
  if(n===null)return "medium";
  if(n>=80)return "strong";
  if(n>=70)return "medium";
  return "weak";
}
function kiinaStrength(alert){
  const exhibition=Number(alert.exhibition_rank);
  const straight=Number(alert.straight_rank);
  if(exhibition===1&&straight===1)return "strong";
  if((exhibition===1&&straight<=2)||(straight===1&&exhibition<=2))return "medium";
  return "weak";
}
function hatsuneDangerStrength(level){
  const text=String(level||"");
  if(text.includes("高")&&!text.includes("やや"))return "strong";
  if(text.includes("やや高")||text.includes("中"))return "medium";
  return "weak";
}

async function getRacePredictionContext(admin,alert){
  const [eventResult,entriesResult]=await Promise.all([
    admin.from("bs_race_events").select("*").eq("race_date",alert.race_date).eq("course_code",alert.course_code).eq("race_no",alert.race_no).maybeSingle(),
    admin.from("bs_race_entries").select("*").eq("race_date",alert.race_date).eq("course_code",alert.course_code).eq("race_no",alert.race_no).order("boat_no",{ascending:true}),
  ]);
  if(eventResult.error||entriesResult.error)return {score:null,second:null};
  const entries=(entriesResult.data||[]).map(normalizeEntry);
  if(entries.length!==6)return {score:null,second:null};
  const {livePrediction}=buildPhase2Predictions({event:eventResult.data||{},entries});
  const second=livePrediction?.marks?.[1]?.boat_no;
  return {
    score:finite(livePrediction?.score),
    second:Number.isInteger(Number(second))?Number(second):null,
  };
}

function ichikaSurgeLine(alert){
  const level=strengthLevel(alert.strength_score);
  const second=alert.second_recommendation?`${alert.second_recommendation}号艇`:"相手候補をチェック";
  if(level==="strong")return `🔥 イン逃げ本線！ 2着オススメは${second}`;
  if(level==="weak")return `👀 1号艇をチェック。相手候補は${second}`;
  return `🏁 1号艇に注目！ 2着オススメは${second}`;
}
function kiinaLine(alert){
  const level=kiinaStrength(alert);
  const second=alert.second_recommendation?`${alert.second_recommendation}号艇`:"相手候補をチェック";
  if(level==="strong")return `🚨 4号艇かなり注目！ 2着オススメは${second}`;
  if(level==="weak")return `👀 4号艇をチェック。相手候補は${second}`;
  return `🚨 4号艇に注目！ 2着オススメは${second}`;
}
function hatsuneInnerLine(alert){
  const level=hatsuneDangerStrength(alert.danger_level);
  if(level==="strong")return "🌸 女子戦で波乱警戒！ イン崩れを強めにチェック";
  if(level==="weak")return "👀 女子戦でイン崩れの気配をチェック";
  return "🌸 女子戦でイン崩れに注目！";
}
function hatsuneBoxLine(alert){
  const values=[alert.box_234_rating,alert.box_235_rating,alert.box_345_rating]
    .map(v=>finite(v)).filter(v=>v!==null);
  const best=values.length?Math.max(...values):null;
  const level=strengthLevel(best);
  if(level==="strong")return "🎀 箱推し本命級！ 組み合わせを強めにチェック";
  if(level==="weak")return "👀 箱推し候補をチェック";
  return "🎀 箱推しで注目！";
}

async function loadAvatarDataUri(spec){
  const encoded=await readFile(path.join(process.cwd(),"public","discord",`${spec.avatarKey}.b64`),"utf8");
  return `data:${spec.avatarMime};base64,${encoded.trim()}`;
}
async function getCharacterWebhook(channelId,roleKey){
  const cacheKey=`${channelId}:${roleKey}`;
  if(webhookCache.has(cacheKey))return webhookCache.get(cacheKey);
  const spec=ALERT_CHARACTERS[roleKey];
  if(!spec)throw new Error(`通知キャラクター設定がありません: ${roleKey}`);
  const hooks=await discordApi(`/channels/${channelId}/webhooks`);
  let hook=(hooks||[]).find(h=>h.name===spec.webhookName&&h.token);
  if(!hook){
    const avatar=await loadAvatarDataUri(spec);
    hook=await discordApi(`/channels/${channelId}/webhooks`,{method:"POST",body:{name:spec.webhookName,avatar}});
  }
  if(!hook?.id||!hook?.token)throw new Error(`${spec.name}通知Webhookを作成できませんでした`);
  webhookCache.set(cacheKey,{hook,spec});
  return {hook,spec};
}
async function sendCharacterAlert(channelId,content,{roleId,roleKey}={}){
  const {hook,spec}=await getCharacterWebhook(channelId,roleKey);
  const bodyContent=roleId?`<@&${roleId}> ${content}`:content;
  const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      username:spec.name,
      content:String(bodyContent).slice(0,2000),
      allowed_mentions:roleId?{parse:[],roles:[roleId]}:{parse:[]},
    }),
    cache:"no-store",
  });
  if(!response.ok){const text=await response.text().catch(()=>"");throw new Error(`Discord Webhook failed: ${response.status} ${text}`.slice(0,1200));}
  return response.json().catch(()=>null);
}

const SOURCES=[
  {type:"kiina_double_top",table:"bs_exhibition_alerts",channel:"DISCORD_KIINA_CHANNEL_ID",roleKey:"kiina",select:"id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,straight_rank,detected_at",build:a=>`🚨 **キイナ｜カド攻め理論成立**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n${kiinaLine(a)}\n${raceLink(a)}`},
  {type:"ichika_hidden_escape",table:"bs_ichika_hidden_escape_alerts",channel:"DISCORD_ICHIKA_CHANNEL_ID",roleKey:"ichika",select:"id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,exhibition_gap,lap_rank,detected_at",build:a=>`🏁 **一果｜隠れイン理論成立**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n展示${a.exhibition_rank??"-"}位｜一周${a.lap_rank??"-"}位${a.exhibition_gap!=null?`｜展示差 ${a.exhibition_gap}`:""}\n${raceLink(a)}`},
  {type:"ichika_escape_surge",table:"bs_ichika_escape_surge_alerts",channel:"DISCORD_ICHIKA_CHANNEL_ID",roleKey:"ichika",select:"id,race_date,course_code,course_name,race_no,closing_time,exhibition_time,lap_time,uplift_points,detected_at",build:a=>`🔥 **一果｜イン逃げ急上昇**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n${ichikaSurgeLine(a)}\n${raceLink(a)}`},
  {type:"hatsune_inner_break",table:"bs_hatsune_womens_inner_break_alerts",channel:"DISCORD_HATSUNE_CHANNEL_ID",roleKey:"hatsune",select:"id,race_date,course_code,course_name,race_no,closing_time,danger_level,exhibition_advantage,lap_advantage,detected_at",build:a=>`🌸 **初音｜女子イン崩れアラート**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n${hatsuneInnerLine(a)}\n${raceLink(a)}`},
  {type:"hatsune_box",table:"bs_hatsune_box_alerts",channel:"DISCORD_HATSUNE_CHANNEL_ID",roleKey:"hatsune",select:"id,race_date,course_code,course_name,race_no,closing_time,box_234_rating,box_235_rating,box_345_rating,detected_at",build:a=>`🎀 **初音｜箱推し理論成立**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n${hatsuneBoxLine(a)}\n${raceLink(a)}`},
];
async function alreadySent(admin,type,alertId,channelKey){const {data,error}=await admin.from("bs_discord_notification_deliveries").select("id,sent_at").eq("alert_type",type).eq("alert_id",alertId).eq("channel_key",channelKey).maybeSingle();if(error)throw error;return Boolean(data?.sent_at);}
async function deliver(admin,source,alert,channelKey,channelId,roleId){
  if(!channelId)return {skipped:true};
  if(await alreadySent(admin,source.type,alert.id,channelKey))return {skipped:true};
  try{
    // キャラ別チャンネルはキャラ専用Webhook、全アラートはBoatStrikers Botアイコンのまま送信。
    const message=channelKey==="all"
      ?await sendDiscordMessage(channelId,source.build(alert),{roleId})
      :await sendCharacterAlert(channelId,source.build(alert),{roleId,roleKey:source.roleKey});
    const now=new Date().toISOString();
    const {error}=await admin.from("bs_discord_notification_deliveries").upsert({alert_type:source.type,alert_id:alert.id,channel_key:channelKey,discord_message_id:message?.id||null,sent_at:now,error:null,updated_at:now},{onConflict:"alert_type,alert_id,channel_key"});
    if(error)throw error;return {sent:true};
  }catch(error){const message=String(error?.message||error).slice(0,1000);await admin.from("bs_discord_notification_deliveries").upsert({alert_type:source.type,alert_id:alert.id,channel_key:channelKey,error:message,updated_at:new Date().toISOString()},{onConflict:"alert_type,alert_id,channel_key"});return {sent:false,error:message};}
}
export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const admin=getAdminClient();const raceDate=jstToday();const allChannel=process.env.DISCORD_ALL_ALERTS_CHANNEL_ID;const summary={raceDate,sent:0,failed:0,skipped:0};
  try{
    const roles=await ensureNotificationRoles();
    for(const source of SOURCES){
      const {data:alerts,error}=await admin.from(source.table).select(source.select).eq("race_date",raceDate).order("detected_at",{ascending:true}).limit(100);if(error)throw error;
      for(const rawAlert of alerts||[]){
        const alert={...rawAlert};
        if(["ichika_escape_surge","kiina_double_top"].includes(source.type)){
          const context=await getRacePredictionContext(admin,alert);
          alert.second_recommendation=context.second;
          alert.strength_score=context.score;
        }
        const targets=[["all",allChannel,roles.all_alerts],[source.channel,process.env[source.channel],roles[source.roleKey]]];
        for(const [channelKey,channelId,roleId] of targets){if(!channelId)continue;const result=await deliver(admin,source,alert,channelKey,channelId,roleId);if(result.sent)summary.sent+=1;else if(result.error)summary.failed+=1;else summary.skipped+=1;}
      }
    }
    console.info(JSON.stringify({level:"info",message:"discord alerts cron complete",...summary}));return NextResponse.json({ok:true,...summary,ranAt:new Date().toISOString()});
  }catch(error){const message=String(error?.message||error).slice(0,1000);console.error(JSON.stringify({level:"error",message:"discord alerts cron failed",error:message}));return NextResponse.json({ok:false,error:message},{status:500});}
}

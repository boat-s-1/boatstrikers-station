import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureNotificationRoles, getAdminClient, sendDiscordMessage, discordApi } from "../../../lib/discordPremium";
import { buildPhase2Predictions } from "../../../lib/phase2PredictionEngine";
import { deliverOnce, finishedDeliveryKeys, isDeliverable } from "../../../lib/discordAlertDelivery";
import { isDiscordAlertsCronAuthorized } from "../../../lib/discordAlertsCronAuth";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const ALERT_CHARACTERS={
  ichika:{name:"一果",avatarKey:"ichika",avatarMime:"image/jpeg",webhookName:"BSC ALERT 一果"},
  hatsune:{name:"初音",avatarKey:"hatsune-final",avatarMime:"image/jpeg",webhookName:"BSC ALERT 初音"},
  kiina:{name:"キイナ",avatarKey:"kiina",avatarMime:"image/jpeg",webhookName:"BSC ALERT キイナ"},
};
const webhookCache=new Map();
const WEBHOOK_TIMEOUT_MS=10_000;
function logWebhookStage(stage, roleKey, startedAt, outcome="ok"){
  console.info(JSON.stringify({level:"info",message:"discord webhook stage",stage,roleKey,outcome,durationMs:Date.now()-startedAt}));
}
const RUN_BUDGET_MS=18_000; // maxDuration（30秒）から、送信1件（最大10秒）と記録の分を残す

// Discord 通知専用の DISCORD_ALERTS_CRON_SECRET があればそれだけを、無ければ従来の CRON_SECRET を受け付ける
function authorized(request){
  return isDiscordAlertsCronAuthorized(request);
}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function jstYesterday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.now()-86_400_000));}
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
  const lookupStart=Date.now();
  let hooks;
  try { hooks=await discordApi(`/channels/${channelId}/webhooks`); logWebhookStage("lookup",roleKey,lookupStart); }
  catch(error){logWebhookStage("lookup",roleKey,lookupStart,"failed");throw error;}
  let hook=(hooks||[]).find(h=>h.name===spec.webhookName&&h.token);
  if(!hook){
    const avatar=await loadAvatarDataUri(spec);
    const createStart=Date.now();
    try { hook=await discordApi(`/channels/${channelId}/webhooks`,{method:"POST",body:{name:spec.webhookName,avatar}}); logWebhookStage("create",roleKey,createStart); }
    catch(error){logWebhookStage("create",roleKey,createStart,"failed");throw error;}
  }
  if(!hook?.id||!hook?.token)throw new Error(`${spec.name}通知Webhookを作成できませんでした`);
  webhookCache.set(cacheKey,{hook,spec});
  return {hook,spec};
}
async function sendCharacterAlert(channelId,content,{roleId,roleKey}={}){
  const {hook,spec}=await getCharacterWebhook(channelId,roleKey);
  const bodyContent=roleId?`<@&${roleId}> ${content}`:content;
  const sendStart=Date.now();
  let response;
  try { response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true`,{
    method:"POST",
    signal:AbortSignal.timeout(WEBHOOK_TIMEOUT_MS), // 応答が無ければ打ち切る（結果不明として再送しない）
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      username:spec.name,
      content:String(bodyContent).slice(0,2000),
      allowed_mentions:roleId?{parse:[],roles:[roleId]}:{parse:[]},
    }),
    cache:"no-store",
  }); logWebhookStage("send",roleKey,sendStart,response.ok?"ok":`http_${response.status}`); }
  catch(error){logWebhookStage("send",roleKey,sendStart,"failed");throw error;}
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

const QUALITY_SOURCE={
  type:"race_data_quality",
  build:a=>{
    const missing=Array.isArray(a.missing_fields)&&a.missing_fields.length?a.missing_fields.join(", "):"unknown";
    return `🚨 **管理者向け｜レースデータ欠損**\n${a.course_name||a.course_code} ${a.race_no}R（${a.race_date}）\n欠損: ${missing}\nhttps://www.boat-strike.online/admin/alerts`;
  },
};
// 配信の権利を取ってから送る（同時実行でも1回だけ。失敗は MAX_ATTEMPTS 回で打ち切り）
async function deliver(admin,source,alert,channelKey,channelId,roleId){
  if(!channelId)return {skipped:true};
  return deliverOnce(admin,{
    alertType:source.type,alertId:alert.id,channelKey,
    // 権利を取った直後にもう一度締切を確かめる（判定から送信までの間に締切を過ぎた場合は送らない）
    stillDeliverable:source.type===QUALITY_SOURCE.type?()=>true:()=>isDeliverable(alert),
    // キャラ別チャンネルはキャラ専用Webhook、全アラートと管理者向けはBoatStrikers Botアイコンのまま送信。
    send:()=>channelKey==="all"||source.type===QUALITY_SOURCE.type
      ?(channelKey==="all" ? discordApi(`/channels/${channelId}/messages`,{method:"POST",body:{content:String(roleId?`<@&${roleId}> ${source.build(alert)}`:source.build(alert)).slice(0,2000),allowed_mentions:roleId?{parse:[],roles:[roleId]}:{parse:[]}}}) : sendDiscordMessage(channelId,source.build(alert),{roleId}))
      :sendCharacterAlert(channelId,source.build(alert),{roleId,roleKey:source.roleKey}),
  });
}
export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const admin=getAdminClient();const raceDate=jstToday();const allChannel=process.env.DISCORD_ALL_ALERTS_CHANNEL_ID;const summary={raceDate,sent:0,failed:0,skipped:0,expired:0,deferred:0,unrecorded:0};const startedAt=Date.now();
  const count=result=>{if(result.sent)summary.sent+=1;else if(result.error)summary.failed+=1;else if(result.reason==="expired")summary.expired+=1;else summary.skipped+=1;if(result.recorded===false)summary.unrecorded+=1;};
  // 残り時間が少なければ新しい送信を始めない（maxDuration で途中終了して、送信中のまま残るのを避ける）
  const outOfTime=()=>Date.now()-startedAt>RUN_BUDGET_MS;
  try{
    const roles=await ensureNotificationRoles();
    for(const source of SOURCES){
      const {data:alerts,error}=await admin.from(source.table).select(source.select).eq("race_date",raceDate).order("detected_at",{ascending:true}).limit(100);if(error)throw error;
      const deliverable=(alerts||[]).filter(rawAlert=>{
        // 締切後（締切が無いものは検出から15分超）は送らない。停止中に溜まった分の一斉配信もここで止まる
        if(isDeliverable(rawAlert))return true;
        summary.expired+=1;return false;
      });
      const targetKeys=["all",source.channel].filter(key=>key==="all"?allChannel:process.env[source.channel]);
      // すべての通知先で送信済み・確定済みのアラートは、予想の計算もせずに飛ばす
      const finished=await finishedDeliveryKeys(admin,source.type,deliverable.map(a=>a.id));
      for(const rawAlert of deliverable){
        if(targetKeys.every(key=>finished.has(`${rawAlert.id}:${key}`))){summary.skipped+=targetKeys.length;continue;}
        if(outOfTime()){summary.deferred+=1;continue;}
        const alert={...rawAlert};
        if(["ichika_escape_surge","kiina_double_top"].includes(source.type)){
          const context=await getRacePredictionContext(admin,alert);
          alert.second_recommendation=context.second;
          alert.strength_score=context.score;
        }
        const targets=[["all",allChannel,roles.all_alerts],[source.channel,process.env[source.channel],roles[source.roleKey]]];
        for(const [channelKey,channelId,roleId] of targets){if(!channelId)continue;count(await deliver(admin,source,alert,channelKey,channelId,roleId));}
      }
    }
    // 管理者向けのデータ欠損通知：管理者チャンネルが明示されている場合だけ送る（会員向けの通知を先に処理する）
    // 全体チャンネルは sendDiscordMessage が投稿しないため、送り先にしない（以前はここで必ず失敗していた）
    const adminChannel=process.env.DISCORD_ADMIN_ALERTS_CHANNEL_ID;
    if(adminChannel&&String(adminChannel)!==String(allChannel||"")){
      const {data:qualityAlerts,error:qualityError}=await admin
        .from("bs_race_data_quality_alerts")
        .select("id,race_date,course_code,course_name,race_no,missing_fields,last_detected_at")
        // 欠損の検出は翌日 01:10 JST ごろに前日の日付で作られるため、前日分と当日分を読む（それより古いものは送らない）
        .gte("race_date",jstYesterday())
        .lte("race_date",raceDate)
        .eq("severity","critical")
        .eq("status","active")
        .order("last_detected_at",{ascending:true})
        .limit(100);
      if(qualityError)throw qualityError;
      for(const alert of qualityAlerts||[]){
        if(outOfTime()){summary.deferred+=1;continue;}
        count(await deliver(admin,QUALITY_SOURCE,alert,"admin",adminChannel,null));
      }
    }
    console.info(JSON.stringify({level:"info",message:"discord alerts cron complete",...summary}));return NextResponse.json({ok:true,...summary,ranAt:new Date().toISOString()});
  }catch(error){const message=String(error?.message||error).slice(0,1000);console.error(JSON.stringify({level:"error",message:"discord alerts cron failed",error:message}));return NextResponse.json({ok:false,error:message},{status:500});}
}

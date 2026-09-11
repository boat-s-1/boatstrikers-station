import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { discordApi, discordConfig, getAdminClient, sendDiscordMessage } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const ALERT_SOURCES=[
  {table:"bs_exhibition_alerts",roleKey:"kiina",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_ichika_hidden_escape_alerts",roleKey:"ichika",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_ichika_escape_surge_alerts",roleKey:"ichika",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_hatsune_womens_inner_break_alerts",roleKey:"hatsune",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_hatsune_box_alerts",roleKey:"hatsune",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
];

const CHARACTERS={
  ichika:{name:"一果",avatarKey:"ichika",avatarMime:"image/jpeg",webhookName:"BSC 実況 一果"},
  hatsune:{name:"初音",avatarKey:"hatsune-final",avatarMime:"image/jpeg",webhookName:"BSC 実況 初音"},
  kiina:{name:"キイナ",avatarKey:"kiina",avatarMime:"image/jpeg",webhookName:"BSC 実況 キイナ"},
};

const webhookCache=new Map();

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

function jstToday(){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date());
}

function threadName(alert){
  const [,month,day]=String(alert.race_date||"").split("-");
  const md=month&&day?`${Number(month)}/${Number(day)}`:"今日";
  return `${md} ${alert.course_name} ${alert.race_no}R実況`;
}

function closeText(alert){
  return alert.closing_time?String(alert.closing_time).slice(0,5):"--:--";
}

function raceKey(alert){
  return `${alert.race_date}:${alert.course_code}:${alert.race_no}`;
}

async function findRaceChatChannel(){
  const {guildId}=discordConfig();
  const channels=await discordApi(`/guilds/${guildId}/channels`);
  return (channels||[]).find(c=>c.type===0&&c.name==="レース実況")||null;
}

async function getActiveThreads(){
  const {guildId}=discordConfig();
  const data=await discordApi(`/guilds/${guildId}/threads/active`);
  return Array.isArray(data?.threads)?data.threads:[];
}

async function loadAvatarDataUri(spec){
  const encoded=await readFile(path.join(process.cwd(),"public","discord",`${spec.avatarKey}.b64`),"utf8");
  return `data:${spec.avatarMime};base64,${encoded.trim()}`;
}

async function getCharacterWebhook(parentChannelId,roleKey){
  const cacheKey=`${parentChannelId}:${roleKey}`;
  if(webhookCache.has(cacheKey))return webhookCache.get(cacheKey);

  const spec=CHARACTERS[roleKey];
  if(!spec)throw new Error(`実況キャラクター設定がありません: ${roleKey}`);

  const hooks=await discordApi(`/channels/${parentChannelId}/webhooks`);
  let hook=(hooks||[]).find(h=>h.name===spec.webhookName&&h.token);

  if(!hook){
    const avatar=await loadAvatarDataUri(spec);
    hook=await discordApi(`/channels/${parentChannelId}/webhooks`,{
      method:"POST",
      body:{name:spec.webhookName,avatar},
    });
  }
  if(!hook?.id||!hook?.token)throw new Error(`${spec.name}実況Webhookを作成できませんでした`);

  if(!hook.avatar){
    const avatar=await loadAvatarDataUri(spec);
    const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:spec.webhookName,avatar}),
      cache:"no-store",
    });
    if(response.ok){
      const updated=await response.json().catch(()=>null);
      if(updated)hook={...hook,...updated,token:hook.token};
    }
  }

  const value={hook,spec};
  webhookCache.set(cacheKey,value);
  return value;
}

async function sendCharacterThreadMessage(parentChannelId,threadId,roleKey,content){
  const {hook,spec}=await getCharacterWebhook(parentChannelId,roleKey);
  const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true&thread_id=${threadId}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      username:spec.name,
      content:String(content).slice(0,2000),
      allowed_mentions:{parse:[]},
    }),
    cache:"no-store",
  });
  if(!response.ok){
    const text=await response.text().catch(()=>"");
    throw new Error(`${spec.name}実況投稿に失敗しました: ${response.status} ${text}`.slice(0,1200));
  }
  return response.json().catch(()=>null);
}

function characterOpening(roleKey,alert,signalRoles){
  const signaled=signalRoles.has(roleKey);
  if(roleKey==="ichika"){
    return signaled
      ?`🏁 私の注目条件にも入ってるよ。まずは1号艇のイン逃げ成立条件と、展示・ST気配を中心に追っていくね。`
      :`🏁 私は1号艇のイン逃げ目線でチェックするね。展示とST気配で本線にできるか見ていくよ。`;
  }
  if(roleKey==="hatsune"){
    return signaled
      ?`🌸 私の注目条件にも入ってるレース。展開と選手の組み合わせを見ながら、イン崩れや相手候補を追うね。`
      :`🌸 私は展開と選手構成の角度から見るね。インが崩れる余地や相手候補をチェックしていくよ。`;
  }
  return signaled
    ?`🚨 アタシの穴条件にも引っかかってる！ 人気薄や外の攻めがハマる形がないか、穴目線で追うよ。`
    :`🚨 アタシは穴目線でチェック！ 人気薄や外枠に妙味が出る展開がないか見ていくね。`;
}

async function postOpeningCharacters(parentChannelId,thread,alert,signalRoles){
  for(const roleKey of ["ichika","hatsune","kiina"]){
    await sendCharacterThreadMessage(
      parentChannelId,
      thread.id,
      roleKey,
      characterOpening(roleKey,alert,signalRoles),
    );
  }
}

async function ensureRaceThread(channel,record,activeThreads){
  const {alert,signalRoles}=record;
  const name=threadName(alert);
  const existing=activeThreads.find(t=>t.parent_id===channel.id&&t.name===name);
  if(existing)return {thread:existing,created:false};

  const thread=await discordApi(`/channels/${channel.id}/threads`,{
    method:"POST",
    body:{
      name,
      type:11,
      auto_archive_duration:1440,
      rate_limit_per_user:0,
    },
  });
  if(!thread?.id)throw new Error(`実況スレッドを作成できませんでした: ${name}`);

  const starter=[
    `🏁 **BoatStrikers 注目レース実況**`,
    `${alert.course_name} ${alert.race_no}R｜〆切 ${closeText(alert)}`,
    `このスレッドで一果・初音・キイナと一緒にレースを追います。`,
    `予想・展示後の変化・実況・結果振り返りをここにまとめていきます。`,
    `https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`,
  ].join("\n");
  await sendDiscordMessage(thread.id,starter);
  await postOpeningCharacters(channel.id,thread,alert,signalRoles);
  activeThreads.push(thread);
  return {thread,created:true};
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});

  const raceDate=jstToday();
  const admin=getAdminClient();
  const summary={raceDate,created:0,existing:0,failed:0,races:0,characterPosts:0};

  try{
    const channel=await findRaceChatChannel();
    if(!channel){
      return NextResponse.json({ok:true,...summary,skipped:true,reason:"レース実況チャンネルが見つかりません"});
    }

    const unique=new Map();
    for(const source of ALERT_SOURCES){
      const {data,error}=await admin
        .from(source.table)
        .select(source.select)
        .eq("race_date",raceDate)
        .order("detected_at",{ascending:true})
        .limit(100);
      if(error)throw error;
      for(const alert of data||[]){
        if(!alert?.course_name||!alert?.race_no)continue;
        const key=raceKey(alert);
        if(!unique.has(key))unique.set(key,{alert,signalRoles:new Set()});
        unique.get(key).signalRoles.add(source.roleKey);
      }
    }

    summary.races=unique.size;
    const activeThreads=await getActiveThreads();
    for(const record of unique.values()){
      try{
        const result=await ensureRaceThread(channel,record,activeThreads);
        if(result.created){
          summary.created+=1;
          summary.characterPosts+=3;
        }else summary.existing+=1;
      }catch(error){
        summary.failed+=1;
        console.error(JSON.stringify({
          level:"error",
          message:"discord race thread create failed",
          race:raceKey(record.alert),
          error:String(error?.message||error).slice(0,1000),
        }));
      }
    }

    console.info(JSON.stringify({level:"info",message:"discord race threads cron complete",...summary}));
    return NextResponse.json({ok:true,...summary,ranAt:new Date().toISOString()});
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    console.error(JSON.stringify({level:"error",message:"discord race threads cron failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

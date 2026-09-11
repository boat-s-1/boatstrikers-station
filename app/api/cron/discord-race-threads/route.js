import { NextResponse } from "next/server";
import { discordApi, discordConfig, getAdminClient, sendDiscordMessage } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const ALERT_SOURCES=[
  {table:"bs_exhibition_alerts",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_ichika_hidden_escape_alerts",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_ichika_escape_surge_alerts",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_hatsune_womens_inner_break_alerts",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
  {table:"bs_hatsune_box_alerts",select:"id,race_date,course_code,course_name,race_no,closing_time,detected_at"},
];

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

async function ensureRaceThread(channel,alert,activeThreads){
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
  activeThreads.push(thread);
  return {thread,created:true};
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});

  const raceDate=jstToday();
  const admin=getAdminClient();
  const summary={raceDate,created:0,existing:0,failed:0,races:0};

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
        if(!unique.has(key))unique.set(key,alert);
      }
    }

    summary.races=unique.size;
    const activeThreads=await getActiveThreads();
    for(const alert of unique.values()){
      try{
        const result=await ensureRaceThread(channel,alert,activeThreads);
        if(result.created)summary.created+=1;
        else summary.existing+=1;
      }catch(error){
        summary.failed+=1;
        console.error(JSON.stringify({
          level:"error",
          message:"discord race thread create failed",
          race:raceKey(alert),
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

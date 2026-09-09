import { NextResponse } from "next/server";
import { getAdminClient, sendDiscordMessage } from "@/app/lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

function jstToday(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

function raceLink(alert){return `https://www.boat-strike.online/races/${alert.course_code}/${alert.race_no}`;}
function closeText(alert){return alert.closing_time?String(alert.closing_time).slice(0,5):"--:--";}

const SOURCES=[
  {
    type:"kiina_double_top",table:"bs_exhibition_alerts",channel:"DISCORD_KIINA_CHANNEL_ID",
    select:"id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,straight_rank,detected_at",
    build:a=>`🚨 **キイナ｜カド攻め理論成立**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n展示${a.exhibition_rank??"-"}位 ＋ 直線${a.straight_rank??"-"}位\n${raceLink(a)}`,
  },
  {
    type:"ichika_hidden_escape",table:"bs_ichika_hidden_escape_alerts",channel:"DISCORD_ICHIKA_CHANNEL_ID",
    select:"id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,exhibition_gap,lap_rank,detected_at",
    build:a=>`🏁 **一果｜隠れイン理論成立**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n展示${a.exhibition_rank??"-"}位｜一周${a.lap_rank??"-"}位${a.exhibition_gap!=null?`｜展示差 ${a.exhibition_gap}`:""}\n${raceLink(a)}`,
  },
  {
    type:"ichika_escape_surge",table:"bs_ichika_escape_surge_alerts",channel:"DISCORD_ICHIKA_CHANNEL_ID",
    select:"id,race_date,course_code,course_name,race_no,closing_time,exhibition_time,lap_time,uplift_points,detected_at",
    build:a=>`🔥 **一果｜イン逃げ急上昇**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}${a.uplift_points!=null?`\n上昇幅 +${a.uplift_points}pt`:""}\n${raceLink(a)}`,
  },
  {
    type:"hatsune_inner_break",table:"bs_hatsune_womens_inner_break_alerts",channel:"DISCORD_HATSUNE_CHANNEL_ID",
    select:"id,race_date,course_code,course_name,race_no,closing_time,danger_level,exhibition_advantage,lap_advantage,detected_at",
    build:a=>`🌸 **初音｜女子イン崩れアラート**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}${a.danger_level?`\n危険度 ${a.danger_level}`:""}\n${raceLink(a)}`,
  },
  {
    type:"hatsune_box",table:"bs_hatsune_box_alerts",channel:"DISCORD_HATSUNE_CHANNEL_ID",
    select:"id,race_date,course_code,course_name,race_no,closing_time,box_234_rating,box_235_rating,box_345_rating,detected_at",
    build:a=>`🎀 **初音｜箱推し理論成立**\n${a.course_name} ${a.race_no}R｜〆切 ${closeText(a)}\n234:${a.box_234_rating||"-"}｜235:${a.box_235_rating||"-"}｜345:${a.box_345_rating||"-"}\n${raceLink(a)}`,
  },
];

async function alreadySent(admin,type,alertId,channelKey){
  const {data,error}=await admin.from("bs_discord_notification_deliveries")
    .select("id,sent_at").eq("alert_type",type).eq("alert_id",alertId).eq("channel_key",channelKey).maybeSingle();
  if(error)throw error;
  return Boolean(data?.sent_at);
}

async function deliver(admin,source,alert,channelKey,channelId){
  if(!channelId)return {skipped:true,reason:"channel_not_configured"};
  if(await alreadySent(admin,source.type,alert.id,channelKey))return {skipped:true,reason:"already_sent"};
  try{
    const message=await sendDiscordMessage(channelId,source.build(alert));
    const now=new Date().toISOString();
    const {error}=await admin.from("bs_discord_notification_deliveries").upsert({
      alert_type:source.type,alert_id:alert.id,channel_key:channelKey,
      discord_message_id:message?.id||null,sent_at:now,error:null,updated_at:now,
    },{onConflict:"alert_type,alert_id,channel_key"});
    if(error)throw error;
    return {sent:true};
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    await admin.from("bs_discord_notification_deliveries").upsert({
      alert_type:source.type,alert_id:alert.id,channel_key:channelKey,error:message,updated_at:new Date().toISOString(),
    },{onConflict:"alert_type,alert_id,channel_key"});
    return {sent:false,error:message};
  }
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const admin=getAdminClient();
  const raceDate=jstToday();
  const allChannel=process.env.DISCORD_ALL_ALERTS_CHANNEL_ID;
  const summary={raceDate,sent:0,failed:0,skipped:0};
  try{
    for(const source of SOURCES){
      const {data:alerts,error}=await admin.from(source.table).select(source.select)
        .eq("race_date",raceDate).order("detected_at",{ascending:true}).limit(100);
      if(error)throw error;
      for(const alert of alerts||[]){
        const targets=[
          ["all",allChannel],
          [source.channel,process.env[source.channel]],
        ];
        for(const [channelKey,channelId] of targets){
          if(!channelId)continue;
          const result=await deliver(admin,source,alert,channelKey,channelId);
          if(result.sent)summary.sent+=1;else if(result.error)summary.failed+=1;else summary.skipped+=1;
        }
      }
    }
    console.info(JSON.stringify({level:"info",message:"discord alerts cron complete",...summary}));
    return NextResponse.json({ok:true,...summary,ranAt:new Date().toISOString()});
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    console.error(JSON.stringify({level:"error",message:"discord alerts cron failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

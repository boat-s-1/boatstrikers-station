import { NextResponse } from "next/server";
import { getAdminClient, sendDiscordMessage } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

const TARGETS=[
  ["all","DISCORD_ALL_ALERTS_CHANNEL_ID","全アラート"],
  ["ichika","DISCORD_ICHIKA_CHANNEL_ID","一果-イン逃げ速報"],
  ["hatsune","DISCORD_HATSUNE_CHANNEL_ID","初音-女子戦速報"],
  ["kiina","DISCORD_KIINA_CHANNEL_ID","キイナ-穴狙い速報"],
];

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const admin=getAdminClient();
  const summary={sent:0,skipped:0,failed:0};
  const message="✅ **BoatStrikers Discord通知テスト（再確認）**\nチャンネルID修正後の再テストです。\nこのメッセージが見えていれば、Discord通知経路は正常です。";

  for(const [channelKey,envKey,label] of TARGETS){
    const channelId=process.env[envKey];
    if(!channelId){summary.failed+=1;console.error(`discord test missing channel: ${envKey}`);continue;}
    const {data:existing,error:checkError}=await admin.from("bs_discord_notification_deliveries")
      .select("id,sent_at").eq("alert_type","system_test").eq("alert_id",2).eq("channel_key",channelKey).maybeSingle();
    if(checkError){summary.failed+=1;console.error("discord test check failed",checkError);continue;}
    if(existing?.sent_at){summary.skipped+=1;continue;}
    try{
      const result=await sendDiscordMessage(channelId,message);
      const now=new Date().toISOString();
      const {error}=await admin.from("bs_discord_notification_deliveries").upsert({
        alert_type:"system_test",alert_id:2,channel_key:channelKey,
        discord_message_id:result?.id||null,sent_at:now,error:null,updated_at:now,
      },{onConflict:"alert_type,alert_id,channel_key"});
      if(error)throw error;
      summary.sent+=1;
      console.info(`discord test sent: ${label}`);
    }catch(error){
      summary.failed+=1;
      console.error(`discord test failed: ${label}`,String(error?.message||error).slice(0,800));
    }
  }

  console.info(JSON.stringify({level:"info",message:"discord notification test complete",...summary}));
  return NextResponse.json({ok:summary.failed===0,...summary,ranAt:new Date().toISOString()},{status:summary.failed===0?200:500});
}

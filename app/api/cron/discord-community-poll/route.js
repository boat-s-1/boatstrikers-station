import { NextResponse } from "next/server";
import { discordApi, discordConfig } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const CATEGORY_NAME="20｜COMMUNITY";
const CHANNEL_NAME="今日のレース雑談";

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const {guildId}=discordConfig();
    const channels=await discordApi(`/guilds/${guildId}/channels`);
    const category=(channels||[]).find(c=>c.type===4&&c.name===CATEGORY_NAME);
    const channel=(channels||[]).find(c=>c.type===0&&c.name===CHANNEL_NAME&&(!category||c.parent_id===category.id));
    if(!channel)throw new Error(`${CATEGORY_NAME} / ${CHANNEL_NAME} が見つかりません`);

    const message=await discordApi(`/channels/${channel.id}/messages`,{
      method:"POST",
      body:{
        content:"🌊 **BoatStrikers 今日のコミュニティ投票**\n気になるレースがあれば、このチャンネルで理由や注目ポイントもぜひ教えてください。",
        poll:{
          question:{text:"今日の注目レース、どうする？"},
          answers:[
            {poll_media:{text:"買う！"}},
            {poll_media:{text:"展示を見て決める"}},
            {poll_media:{text:"今日は見送る"}},
          ],
          duration:12,
          allow_multiselect:false,
          layout_type:1,
        },
        allowed_mentions:{parse:[]},
      },
    });

    console.info(JSON.stringify({level:"info",message:"discord community poll posted",channelId:channel.id,messageId:message?.id||null}));
    return NextResponse.json({ok:true,channelId:channel.id,messageId:message?.id||null});
  }catch(error){
    const message=String(error?.message||error).slice(0,1200);
    console.error(JSON.stringify({level:"error",message:"discord community poll failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

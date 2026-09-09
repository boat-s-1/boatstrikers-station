import { NextResponse } from "next/server";
import { discordApi, discordConfig, sendDiscordMessage } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

const CATEGORY_NAME="20｜COMMUNITY";
const CHANNELS=[
  {
    name:"今日のレース雑談",
    topic:"今日のボートレースを気軽に話すBoatStrikersコミュニティ。無料参加OK。",
    intro:"👋 **今日のレース雑談へようこそ！**\n今日気になるレース、展示、選手などを自由に話してください。\n※買い目の強要・誹謗中傷・外部勧誘は禁止です。",
  },
  {
    name:"レース実況",
    topic:"開催中レースをみんなでリアルタイムに楽しむ実況チャンネル。無料参加OK。",
    intro:"📣 **レース実況チャンネル**\n開催中のレースをみんなで楽しむ場所です。\nスタート前後の感想やレース後の振り返りにどうぞ。",
  },
  {
    name:"一果に質問",
    topic:"イン逃げ・1号艇・BoatStrikers一果について質問できるコミュニティチャンネル。",
    intro:"🏁 **一果に質問！**\nイン逃げ・1号艇・基本的な見方など、一果に聞きたいことを書いてください。\nPREMIUM会員向けの詳しい個別相談はサイトの「一果に相談！」も利用できます。",
  },
  {
    name:"初音に質問",
    topic:"女子戦を中心に初音へ質問できるBoatStrikersコミュニティチャンネル。",
    intro:"🌸 **初音に質問！**\n女子戦・女子レーサー・女子戦の見方について気軽に質問してください。",
  },
  {
    name:"キイナに質問",
    topic:"穴狙い・5号艇・高配当を中心にキイナへ質問できるコミュニティチャンネル。",
    intro:"🚨 **キイナに質問！**\n穴狙い・5号艇・高配当の考え方などを気軽に質問してください。",
  },
];

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const {guildId}=discordConfig();
    const channels=await discordApi(`/guilds/${guildId}/channels`);
    let category=(channels||[]).find(c=>c.type===4&&c.name===CATEGORY_NAME);
    let createdCategory=false;
    if(!category){
      category=await discordApi(`/guilds/${guildId}/channels`,{
        method:"POST",
        body:{
          name:CATEGORY_NAME,
          type:4,
          permission_overwrites:[{
            id:guildId,
            type:0,
            allow:String(1024+2048+65536+64),
            deny:"0",
          }],
        },
      });
      createdCategory=true;
    }

    const existing=await discordApi(`/guilds/${guildId}/channels`);
    const results=[];
    for(const spec of CHANNELS){
      let channel=(existing||[]).find(c=>c.type===0&&c.parent_id===category.id&&c.name===spec.name);
      let created=false;
      if(!channel){
        channel=await discordApi(`/guilds/${guildId}/channels`,{
          method:"POST",
          body:{name:spec.name,type:0,parent_id:category.id,topic:spec.topic},
        });
        created=true;
        await sendDiscordMessage(channel.id,spec.intro);
      }
      results.push({name:spec.name,id:channel.id,created});
    }

    console.info(JSON.stringify({level:"info",message:"discord community setup complete",category:{id:category.id,created:createdCategory},channels:results}));
    return NextResponse.json({ok:true,category:{id:category.id,created:createdCategory},channels:results});
  }catch(error){
    const message=String(error?.message||error).slice(0,1200);
    console.error(JSON.stringify({level:"error",message:"discord community setup failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

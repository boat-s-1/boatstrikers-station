import { NextResponse } from "next/server";
import { discordApi, discordConfig } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const VIEW_CHANNEL="1024";

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

function categoryPerms(kind,{guildId,premiumRoleId}){
  if(kind==="premium"){
    return [
      {id:guildId,type:0,allow:"0",deny:VIEW_CHANNEL},
      {id:premiumRoleId,type:0,allow:VIEW_CHANNEL,deny:"0"},
    ];
  }
  return [
    {id:guildId,type:0,allow:VIEW_CHANNEL,deny:"0"},
  ];
}

async function ensureCategory(channels,name,oldNames,kind,config,position){
  let category=channels.find(c=>c.type===4&&c.name===name);
  if(!category){
    category=channels.find(c=>c.type===4&&oldNames.includes(c.name));
    if(category){
      category=await discordApi(`/channels/${category.id}`,{
        method:"PATCH",
        body:{name,position,permission_overwrites:categoryPerms(kind,config)},
      });
    }else{
      category=await discordApi(`/guilds/${config.guildId}/channels`,{
        method:"POST",
        body:{name,type:4,position,permission_overwrites:categoryPerms(kind,config)},
      });
    }
    channels.push(category);
  }else{
    category=await discordApi(`/channels/${category.id}`,{
      method:"PATCH",
      body:{position,permission_overwrites:categoryPerms(kind,config)},
    });
  }
  return category;
}

async function ensureTextChannel(channels,category,name,topic,position){
  let channel=channels.find(c=>c.type===0&&c.name===name);
  if(!channel){
    channel=await discordApi(`/guilds/${discordConfig().guildId}/channels`,{
      method:"POST",
      body:{name,type:0,parent_id:category.id,topic,position},
    });
    channels.push(channel);
    return {channel,created:true};
  }
  channel=await discordApi(`/channels/${channel.id}`,{
    method:"PATCH",
    body:{parent_id:category.id,topic,position},
  });
  return {channel,created:false};
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});

  try{
    const config=discordConfig();
    const channels=await discordApi(`/guilds/${config.guildId}/channels`);
    const summary={categories:[],created:[],moved:[]};

    const start=await ensureCategory(channels,"00｜START",[],"free",config,0);
    const free=await ensureCategory(channels,"10｜FREE",["20｜COMMUNITY"],"free",config,1);
    const premium=await ensureCategory(channels,"20｜PREMIUM",["10｜PREMIUM通知"],"premium",config,2);
    summary.categories=[start.name,free.name,premium.name];

    const freeChannels=[
      ["初心者ガイド","ボートレース初心者向け。基本ルール・舟券・見方をBoatStrikers流にまとめます。"],
      ["今日の注目レース","今日の注目レースや見どころを共有します。"],
      ["雑談","ボートレースやBoatStrikersについて自由に交流する場所です。"],
      ["質問","分からないことや予想の見方などを気軽に質問できます。"],
      ["レース実況","注目レースはレースごとのスレッドに分けて実況します。"],
      ["note更新","BoatStrikersのnote更新情報を配信します。"],
      ["5000円チャレンジ","5,000円スタートの公開検証企画。買い目・結果・残高を透明に記録します。"],
      ["的中報告","みんなの的中報告やレース結果を共有する場所です。"],
    ];

    const premiumChannels=[
      ["一果-イン逃げ速報","一果のイン逃げ系プレミアムアラート。"],
      ["初音-女子戦速報","初音の女子戦プレミアムアラート。"],
      ["キイナ-穴狙い速報","キイナの穴狙いプレミアムアラート。"],
      ["全アラート","BoatStrikersの全プレミアムアラートをまとめて配信します。"],
      ["12r生実況","ラジオと連動した12R生実況。展示後から結果までリアルタイムで追います。"],
      ["有料会員雑談","BSC PREMIUM会員限定の雑談・情報交換。"],
      ["展示後の最終判断","展示後の評価変更や締切前の最終コメントを共有します。"],
      ["data-lab先行公開","DATA LABの分析・検証結果を一般公開前に先行共有します。"],
    ];

    for(let i=0;i<freeChannels.length;i++){
      const [name,topic]=freeChannels[i];
      const result=await ensureTextChannel(channels,free,name,topic,i);
      (result.created?summary.created:summary.moved).push(name);
    }

    // 既存のキャラ質問チャンネルも無料コミュニティ側へまとめる。
    for(const name of ["一果に質問","初音に質問","キイナに質問"]){
      const channel=channels.find(c=>c.type===0&&c.name===name);
      if(channel){
        await discordApi(`/channels/${channel.id}`,{method:"PATCH",body:{parent_id:free.id}});
        summary.moved.push(name);
      }
    }

    for(let i=0;i<premiumChannels.length;i++){
      const [name,topic]=premiumChannels[i];
      const result=await ensureTextChannel(channels,premium,name,topic,i);
      (result.created?summary.created:summary.moved).push(name);
    }

    // 既存のSTARTチャンネルを00｜START配下に維持。
    for(const name of ["welcome","使い方","お知らせ"]){
      const channel=channels.find(c=>c.type===0&&c.name===name);
      if(channel&&channel.parent_id!==start.id){
        await discordApi(`/channels/${channel.id}`,{method:"PATCH",body:{parent_id:start.id}});
        summary.moved.push(name);
      }
    }

    console.info(JSON.stringify({level:"info",message:"discord community setup complete",...summary}));
    return NextResponse.json({ok:true,...summary,ranAt:new Date().toISOString()});
  }catch(error){
    const message=String(error?.message||error).slice(0,1200);
    console.error(JSON.stringify({level:"error",message:"discord community setup failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

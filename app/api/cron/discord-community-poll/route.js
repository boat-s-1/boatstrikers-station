import { NextResponse } from "next/server";
import { discordApi, discordConfig, getAdminClient } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

const CATEGORY_NAME="20｜COMMUNITY";
const CHANNEL_NAME="今日のレース雑談";
const COURSE_NAMES={
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",
  7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",
  19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村",
};

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

function jstDate(){
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

async function getIchikaTopRace(){
  const admin=getAdminClient();
  const rankingDate=jstDate();
  const {data,error}=await admin
    .from("ai_v2_daily_rankings")
    .select("course_code,race_no,probability,summary,data_timing,rank_no")
    .eq("ranking_date",rankingDate)
    .eq("ranking_type","ichika_escape_best10")
    .order("rank_no",{ascending:true})
    .limit(1)
    .maybeSingle();
  if(error)throw error;
  if(!data)return null;
  return {...data,ranking_date:rankingDate};
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  try{
    const [{guildId},topRace]=await Promise.all([Promise.resolve(discordConfig()),getIchikaTopRace()]);
    const channels=await discordApi(`/guilds/${guildId}/channels`);
    const category=(channels||[]).find(c=>c.type===4&&c.name===CATEGORY_NAME);
    const channel=(channels||[]).find(c=>c.type===0&&c.name===CHANNEL_NAME&&(!category||c.parent_id===category.id));
    if(!channel)throw new Error(`${CATEGORY_NAME} / ${CHANNEL_NAME} が見つかりません`);

    const courseName=topRace?COURSE_NAMES[Number(topRace.course_code)]||`${topRace.course_code}場`:null;
    const raceLabel=topRace?`${courseName}${Number(topRace.race_no)}R`:null;
    const probability=topRace&&Number.isFinite(Number(topRace.probability))?Math.round(Number(topRace.probability)*100):null;

    const content=topRace
      ? `🏁 **一果AI 今日の注目レース**\n**${raceLabel}** をみんなでチェック！${probability!==null?`\nイン逃げ期待度の目安：**${probability}%**`:""}\n\n投票したら、展示・選手・モーターなど気になるポイントもコメントで教えてください。`
      : "🌊 **BoatStrikers 今日のコミュニティ投票**\n今日は一果AIの当日ランキングがまだ出ていないため、気になるレースを自由に教えてください。";
    const question=topRace?`${raceLabel}、どう見る？`:"今日の注目レース、どうする？";

    const message=await discordApi(`/channels/${channel.id}/messages`,{
      method:"POST",
      body:{
        content,
        poll:{
          question:{text:question},
          answers:[
            {poll_media:{text:"買いたい！"}},
            {poll_media:{text:"展示を見て決める"}},
            {poll_media:{text:"見送る"}},
          ],
          duration:12,
          allow_multiselect:false,
          layout_type:1,
        },
        allowed_mentions:{parse:[]},
      },
    });

    console.info(JSON.stringify({
      level:"info",
      message:"discord community poll posted",
      channelId:channel.id,
      messageId:message?.id||null,
      rankingDate:topRace?.ranking_date||null,
      courseCode:topRace?.course_code||null,
      raceNo:topRace?.race_no||null,
      probability:topRace?.probability||null,
    }));
    return NextResponse.json({
      ok:true,
      channelId:channel.id,
      messageId:message?.id||null,
      topRace:topRace?{courseName,raceNo:Number(topRace.race_no),probability:topRace.probability,rankingDate:topRace.ranking_date}:null,
    });
  }catch(error){
    const message=String(error?.message||error).slice(0,1200);
    console.error(JSON.stringify({level:"error",message:"discord community poll failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

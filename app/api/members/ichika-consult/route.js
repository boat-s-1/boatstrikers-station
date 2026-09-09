import { NextResponse } from "next/server";
import { getAdminClient, isDiscordEligible } from "../../../lib/discordPremium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPICS = {
  escape: "イン逃げ期待度",
  buy_or_skip: "買うか見送るか",
  risk: "1号艇の不安材料",
  exhibition: "展示後チェック",
  ticket: "買い目の考え方",
};

function jstDateString(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

async function getMember(request){
  const auth=request.headers.get("authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)return {error:NextResponse.json({error:"ログインが必要です。"},{status:401})};
  const admin=getAdminClient();
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user)return {error:NextResponse.json({error:"ログイン情報が無効です。"},{status:401})};
  const {data:profile,error:profileError}=await admin.from("bs_member_profiles")
    .select("user_id,plan,membership_status").eq("user_id",user.id).maybeSingle();
  if(profileError)return {error:NextResponse.json({error:"会員情報を確認できませんでした。"},{status:500})};
  if(!isDiscordEligible(profile))return {error:NextResponse.json({error:"一果に相談！はPREMIUM対象会員限定です。"},{status:403})};
  return {admin,user,profile};
}

async function findRaceSignals(admin,{raceDate,courseCode,raceNo}){
  if(!raceDate||!courseCode||!raceNo)return {hidden:null,surge:null};
  const [{data:hidden},{data:surge}] = await Promise.all([
    admin.from("bs_ichika_hidden_escape_alerts")
      .select("course_name,race_no,closing_time,exhibition_rank,exhibition_gap,lap_rank,detected_at")
      .eq("race_date",raceDate).eq("course_code",courseCode).eq("race_no",raceNo).order("detected_at",{ascending:false}).limit(1).maybeSingle(),
    admin.from("bs_ichika_escape_surge_alerts")
      .select("course_name,race_no,closing_time,exhibition_time,lap_time,uplift_points,detected_at")
      .eq("race_date",raceDate).eq("course_code",courseCode).eq("race_no",raceNo).order("detected_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  return {hidden:hidden||null,surge:surge||null};
}

function buildIchikaAnswer({topic,question,raceDate,courseName,raceNo,signals}){
  const {hidden,surge}=signals||{};
  let conclusion="注意";
  const points=[];
  const risks=[];

  if(hidden){
    points.push(`隠れイン理論の成立データあり。展示順位${hidden.exhibition_rank??"-"}位・一周${hidden.lap_rank??"-"}位。`);
    conclusion="買い候補";
  }
  if(surge){
    points.push(`イン逃げ急上昇の成立データあり${surge.uplift_points!=null?`（+${surge.uplift_points}pt）`:""}。`);
    conclusion="買い候補";
  }
  if(!hidden&&!surge){
    points.push("現在のBoatStrikers成立アラートでは、一果系の強い成立サインはまだ確認できていません。");
    risks.push("展示・進入・直前気配で評価が変わる可能性があります。");
    conclusion=topic==="buy_or_skip"?"見送り寄り":"注意";
  }
  if(topic==="risk")risks.push("1号艇のST遅れ、進入変化、外の攻め気配は必ず直前確認したいです。");
  if(topic==="ticket")risks.push("買い目はオッズだけで広げず、相手候補を絞って点数管理するのがおすすめです。");
  if(topic==="exhibition")points.push("展示後は展示順位だけでなく、一周・直線・ST気配をセットで見ます。");

  const raceLabel=courseName&&raceNo?`${courseName} ${raceNo}R`:raceNo?`${raceNo}R`:"このレース";
  const intro=`${raceLabel}${raceDate?`（${raceDate}）`:""}を一果目線でチェックしたよ。`;
  const answer=[
    `【一果の結論】${conclusion}`,
    intro,
    `【見たポイント】${points.join(" ")}`,
    `【気になる点】${risks.length?risks.join(" "):"現時点では大きな追加警戒材料は確認できていません。"}`,
    `【一果のひとこと】「${String(question||"").slice(0,160)}」については、今のデータなら${conclusion==="買い候補"?"イン逃げ側を軸候補にしていいと思う！ただし直前展示で最終確認してね。":"無理に決め打ちせず、直前気配を見てから判断するのがよさそう！"}`,
  ].join("\n\n");
  return {conclusion,answer};
}

export async function GET(request){
  const member=await getMember(request);
  if(member.error)return member.error;
  const {admin,user}=member;
  const {data,error}=await admin.from("bs_ichika_consultations")
    .select("id,race_date,course_code,course_name,race_no,topic,question,ai_conclusion,ai_answer,escalated,admin_status,admin_reply,admin_replied_at,created_at")
    .eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
  if(error)return NextResponse.json({error:"相談履歴を取得できませんでした。"},{status:500});
  return NextResponse.json({ok:true,consultations:data||[]});
}

export async function POST(request){
  const member=await getMember(request);
  if(member.error)return member.error;
  const {admin,user}=member;
  const body=await request.json().catch(()=>({}));
  const topic=String(body.topic||"");
  const question=String(body.question||"").trim();
  const raceDate=String(body.raceDate||jstDateString()).slice(0,10);
  const courseCode=String(body.courseCode||"").trim().slice(0,4);
  const courseName=String(body.courseName||"").trim().slice(0,40);
  const raceNo=Number(body.raceNo||0)||null;
  if(!TOPICS[topic])return NextResponse.json({error:"相談テーマを選んでください。"},{status:400});
  if(question.length<2||question.length>500)return NextResponse.json({error:"質問は2〜500文字で入力してください。"},{status:400});
  if(raceNo&&(raceNo<1||raceNo>12))return NextResponse.json({error:"Rは1〜12で指定してください。"},{status:400});

  const start=new Date();
  start.setUTCHours(15,0,0,0); // JST 0:00
  if(new Date()<start)start.setUTCDate(start.getUTCDate()-1);
  const {count,error:countError}=await admin.from("bs_ichika_consultations")
    .select("id",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",start.toISOString());
  if(countError)return NextResponse.json({error:"利用回数を確認できませんでした。"},{status:500});
  if((count||0)>=5)return NextResponse.json({error:"本日の一果AI相談は5回までです。"},{status:429});

  const signals=await findRaceSignals(admin,{raceDate,courseCode,raceNo});
  const built=buildIchikaAnswer({topic,question,raceDate,courseName,raceNo,signals});
  const {data,error}=await admin.from("bs_ichika_consultations").insert({
    user_id:user.id,race_date:raceDate||null,course_code:courseCode||null,course_name:courseName||null,
    race_no:raceNo,topic,question,ai_conclusion:built.conclusion,ai_answer:built.answer,
  }).select("id,race_date,course_code,course_name,race_no,topic,question,ai_conclusion,ai_answer,escalated,admin_status,created_at").single();
  if(error)return NextResponse.json({error:"相談内容を保存できませんでした。"},{status:500});
  return NextResponse.json({ok:true,consultation:data,remaining:Math.max(0,4-(count||0))});
}

export async function PATCH(request){
  const member=await getMember(request);
  if(member.error)return member.error;
  const {admin,user}=member;
  const body=await request.json().catch(()=>({}));
  const id=Number(body.id||0);
  if(!id)return NextResponse.json({error:"相談IDが必要です。"},{status:400});
  const now=new Date().toISOString();
  const {data,error}=await admin.from("bs_ichika_consultations").update({
    escalated:true,admin_status:"pending",updated_at:now,
  }).eq("id",id).eq("user_id",user.id).select("id,escalated,admin_status").maybeSingle();
  if(error||!data)return NextResponse.json({error:"管理人への追加相談を送れませんでした。"},{status:500});
  return NextResponse.json({ok:true,consultation:data});
}

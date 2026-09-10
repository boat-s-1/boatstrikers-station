import { NextResponse } from "next/server";
import { getAdminClient, discordApi, discordConfig } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const CHARACTER_CONFIG={
  ichika:{name:"一果",channel:"一果に質問",avatar:"https://www.boat-strike.online/7562660D-EB9C-4981-A1D1-789E6211DACA.png"},
  hatsune:{name:"初音",channel:"初音に質問",avatar:"https://www.boat-strike.online/8A7A7A27-B954-4A3F-9DC3-52DB3DCE80AB.png"},
  kiina:{name:"キイナ",channel:"キイナに質問",avatar:"https://www.boat-strike.online/6D4CA65A-8CA7-403B-AF8D-C4A6581C423F.png"},
};

async function requireAdmin(request){
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)throw Object.assign(new Error("ログインが必要です"),{status:401});
  const admin=getAdminClient();
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data?.user)throw Object.assign(new Error("ログイン情報を確認できません"),{status:401});
  const allowIds=String(process.env.BSC_ADMIN_USER_IDS||"").split(",").map(v=>v.trim()).filter(Boolean);
  if(!allowIds.includes(data.user.id)){
    throw Object.assign(new Error(`管理者権限がありません。Vercel の BSC_ADMIN_USER_IDS に ${data.user.id} を登録してください。`),{status:403});
  }
  return {admin,user:data.user};
}

async function findQuestionChannel(character){
  const spec=CHARACTER_CONFIG[character];
  if(!spec)throw Object.assign(new Error("character が不正です"),{status:400});
  const {guildId}=discordConfig();
  const channels=await discordApi(`/guilds/${guildId}/channels`);
  const channel=(channels||[]).find(c=>c.type===0&&c.name===spec.channel);
  if(!channel)throw new Error(`${spec.channel} が見つかりません`);
  return {channel,spec};
}

async function getOrCreateWebhook(channel,spec){
  const hooks=await discordApi(`/channels/${channel.id}/webhooks`);
  let hook=(hooks||[]).find(h=>h.name===`BSC ${spec.name}`&&h.token);
  if(!hook){
    hook=await discordApi(`/channels/${channel.id}/webhooks`,{method:"POST",body:{name:`BSC ${spec.name}`}});
  }
  if(!hook?.id||!hook?.token)throw new Error("Webhookを作成できませんでした");
  return hook;
}

export async function GET(request){
  try{
    await requireAdmin(request);
    const url=new URL(request.url);
    const character=url.searchParams.get("character")||"ichika";
    const {channel,spec}=await findQuestionChannel(character);
    const messages=await discordApi(`/channels/${channel.id}/messages?limit=30`);
    const rows=(messages||[]).map(m=>({
      id:m.id,
      content:m.content||"",
      created_at:m.timestamp,
      author:{id:m.author?.id||null,name:m.member?.nick||m.author?.global_name||m.author?.username||"unknown",bot:Boolean(m.author?.bot)},
      webhook:Boolean(m.webhook_id),
    }));
    return NextResponse.json({ok:true,character,display_name:spec.name,channel_name:spec.channel,messages:rows});
  }catch(error){
    return NextResponse.json({ok:false,error:error?.message||"failed"},{status:error?.status||500});
  }
}

export async function POST(request){
  try{
    await requireAdmin(request);
    const body=await request.json();
    const character=String(body?.character||"");
    const content=String(body?.content||"").trim();
    const replyUserId=body?.reply_user_id?String(body.reply_user_id):null;
    if(content.length<1||content.length>1800)throw Object.assign(new Error("返信文は1〜1800文字で入力してください"),{status:400});
    const {channel,spec}=await findQuestionChannel(character);
    const hook=await getOrCreateWebhook(channel,spec);
    const text=replyUserId?`<@${replyUserId}>\n${content}`:content;
    const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username:spec.name,avatar_url:spec.avatar,content:text,allowed_mentions:replyUserId?{parse:[],users:[replyUserId]}:{parse:[]}}),
      cache:"no-store",
    });
    if(!response.ok){const t=await response.text().catch(()=>"");throw new Error(`Webhook送信に失敗しました: ${response.status} ${t}`.slice(0,1000));}
    const sent=await response.json();
    return NextResponse.json({ok:true,message_id:sent?.id||null,character,channel_name:spec.channel});
  }catch(error){
    return NextResponse.json({ok:false,error:error?.message||"failed"},{status:error?.status||500});
  }
}

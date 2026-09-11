import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAdminClient, discordApi, discordConfig } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const CHARACTER_CONFIG={
  ichika:{name:"一果",channel:"一果に質問",avatarKey:"ichika",avatarMime:"image/jpeg",webhookName:"BSC 一果 v2"},
  hatsune:{name:"初音",channel:"初音に質問",avatarKey:"hatsune-final",avatarMime:"image/jpeg",webhookName:"BSC 初音 final-v1",forceAvatar:true},
  kiina:{name:"キイナ",channel:"キイナに質問",avatarKey:"kiina",avatarMime:"image/jpeg",webhookName:"BSC キイナ v2"},
};

async function requireAdmin(request){
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)throw Object.assign(new Error("ログインが必要です"),{status:401});
  const admin=getAdminClient();
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data?.user)throw Object.assign(new Error("ログイン情報を確認できません"),{status:401});
  const allowIds=String(process.env.BSC_ADMIN_USER_IDS||"").split(",").map(v=>v.trim()).filter(Boolean);
  if(!allowIds.includes(data.user.id))throw Object.assign(new Error("管理者権限がありません"),{status:403});
  return {admin,user:data.user};
}

async function guildChannels(){
  const {guildId}=discordConfig();
  return discordApi(`/guilds/${guildId}/channels`);
}

async function findQuestionChannel(character){
  const spec=CHARACTER_CONFIG[character];
  if(!spec)throw Object.assign(new Error("character が不正です"),{status:400});
  const channels=await guildChannels();
  const channel=(channels||[]).find(c=>c.type===0&&c.name===spec.channel);
  if(!channel)throw new Error(`${spec.channel} が見つかりません`);
  return {channel,spec};
}

async function findRaceChannel(){
  const channels=await guildChannels();
  const channel=(channels||[]).find(c=>c.type===0&&c.name==="レース実況");
  if(!channel)throw new Error("レース実況チャンネルが見つかりません");
  return channel;
}

async function loadAvatarDataUri(spec){
  const encoded=await readFile(path.join(process.cwd(),"public","discord",`${spec.avatarKey}.b64`),"utf8");
  return `data:${spec.avatarMime||"image/jpeg"};base64,${encoded.trim()}`;
}

async function patchWebhookAvatarWithToken(hook,spec){
  const avatar=await loadAvatarDataUri(spec);
  const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}`,{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:spec.webhookName||`BSC ${spec.name}`,avatar}),cache:"no-store",
  });
  const text=await response.text().catch(()=>"");
  if(!response.ok)throw new Error(`Webhookアイコン設定に失敗しました: ${response.status} ${text}`.slice(0,1200));
  const updated=text?JSON.parse(text):{};
  return {...hook,...updated,token:hook.token};
}

async function getOrCreateWebhook(channel,spec,{race=false}={}){
  const hooks=await discordApi(`/channels/${channel.id}/webhooks`);
  const wantedName=race?`BSC 実況 ${spec.name}`:(spec.webhookName||`BSC ${spec.name}`);
  let hook=(hooks||[]).find(h=>h.name===wantedName&&h.token);
  if(!hook){
    const avatar=await loadAvatarDataUri(spec);
    hook=await discordApi(`/channels/${channel.id}/webhooks`,{method:"POST",body:{name:wantedName,avatar}});
  }
  if(!hook?.id||!hook?.token)throw new Error("Webhookを作成できませんでした");
  if(!race&&(spec.forceAvatar||!hook.avatar))hook=await patchWebhookAvatarWithToken(hook,spec);
  return hook;
}

async function listRaceThreads(){
  const {guildId}=discordConfig();
  const channel=await findRaceChannel();
  const active=await discordApi(`/guilds/${guildId}/threads/active`);
  const rows=(active?.threads||[])
    .filter(t=>t.parent_id===channel.id)
    .sort((a,b)=>String(b.id).localeCompare(String(a.id)))
    .map(t=>({id:t.id,name:t.name,archived:Boolean(t.thread_metadata?.archived)}));
  return {channel,threads:rows};
}

export async function GET(request){
  try{
    await requireAdmin(request);
    const url=new URL(request.url);
    const mode=url.searchParams.get("mode")||"questions";
    if(mode==="threads"){
      const {threads}=await listRaceThreads();
      return NextResponse.json({ok:true,threads});
    }
    const character=url.searchParams.get("character")||"ichika";
    const {channel,spec}=await findQuestionChannel(character);
    const messages=await discordApi(`/channels/${channel.id}/messages?limit=30`);
    const rows=(messages||[]).map(m=>({
      id:m.id,content:m.content||"",created_at:m.timestamp,
      author:{id:m.author?.id||null,name:m.member?.nick||m.author?.global_name||m.author?.username||"unknown",bot:Boolean(m.author?.bot)},
      webhook:Boolean(m.webhook_id),attachments:(m.attachments||[]).map(a=>({id:a.id,name:a.filename||"添付ファイル",url:a.url||null})),
      embeds_count:Array.isArray(m.embeds)?m.embeds.length:0,
      content_unavailable:!m.content&&!(m.attachments||[]).length&&!(m.embeds||[]).length,
    }));
    return NextResponse.json({ok:true,character,display_name:spec.name,channel_name:spec.channel,messages:rows});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"failed"},{status:error?.status||500});}
}

export async function POST(request){
  try{
    await requireAdmin(request);
    const body=await request.json();
    const character=String(body?.character||"");
    const content=String(body?.content||"").trim();
    const mode=String(body?.mode||"questions");
    if(content.length<1||content.length>1800)throw Object.assign(new Error("本文は1〜1800文字で入力してください"),{status:400});
    const spec=CHARACTER_CONFIG[character];
    if(!spec)throw Object.assign(new Error("character が不正です"),{status:400});

    if(mode==="thread"){
      const threadId=String(body?.thread_id||"").trim();
      if(!threadId)throw Object.assign(new Error("実況スレッドを選択してください"),{status:400});
      const {channel,threads}=await listRaceThreads();
      const thread=threads.find(t=>t.id===threadId);
      if(!thread)throw Object.assign(new Error("指定した実況スレッドが見つかりません"),{status:404});
      const hook=await getOrCreateWebhook(channel,spec,{race:true});
      const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true&thread_id=${encodeURIComponent(threadId)}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username:spec.name,content,allowed_mentions:{parse:[]}}),cache:"no-store",
      });
      if(!response.ok){const t=await response.text().catch(()=>"");throw new Error(`実況スレッド送信に失敗しました: ${response.status} ${t}`.slice(0,1000));}
      const sent=await response.json().catch(()=>({}));
      return NextResponse.json({ok:true,mode:"thread",message_id:sent?.id||null,thread_id:threadId,thread_name:thread.name,character});
    }

    const replyUserId=body?.reply_user_id?String(body.reply_user_id):null;
    const {channel}=await findQuestionChannel(character);
    const hook=await getOrCreateWebhook(channel,spec);
    const text=replyUserId?`<@${replyUserId}>\n${content}`:content;
    const payload={username:spec.name,content:text,allowed_mentions:replyUserId?{parse:[],users:[replyUserId]}:{parse:[]}};
    if(spec.forceAvatar&&hook.avatar)payload.avatar_url=`https://cdn.discordapp.com/avatars/${hook.id}/${hook.avatar}.png?size=128`;
    const response=await fetch(`https://discord.com/api/v10/webhooks/${hook.id}/${hook.token}?wait=true`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",
    });
    if(!response.ok){const t=await response.text().catch(()=>"");throw new Error(`Webhook送信に失敗しました: ${response.status} ${t}`.slice(0,1000));}
    const sent=await response.json();
    return NextResponse.json({ok:true,message_id:sent?.id||null,character,channel_name:spec.channel});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"failed"},{status:error?.status||500});}
}

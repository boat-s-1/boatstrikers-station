import { NextResponse } from "next/server";
import { addDiscordRole, ensureDefaultNotificationRoles, ensureNotificationRoles, getAdminClient, getDiscordMember, isDiscordEligible, removeDiscordRole } from "../../../../lib/discordPremium";

export const runtime="nodejs";

const KEYS=["ichika","hatsune","kiina","all_alerts"];

async function context(request){
  const auth=request.headers.get("authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)return {error:NextResponse.json({error:"ログインが必要です。"},{status:401})};
  const admin=getAdminClient();
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user)return {error:NextResponse.json({error:"ログイン情報が無効です。"},{status:401})};
  const [{data:profile,error:profileError},{data:link,error:linkError}]=await Promise.all([
    admin.from("bs_member_profiles").select("plan,membership_status").eq("user_id",user.id).maybeSingle(),
    admin.from("bs_member_discord_links").select("discord_user_id").eq("user_id",user.id).maybeSingle(),
  ]);
  if(profileError||linkError)throw profileError||linkError;
  if(!isDiscordEligible(profile))return {error:NextResponse.json({error:"PREMIUM対象会員限定です。"},{status:403})};
  if(!link?.discord_user_id)return {error:NextResponse.json({error:"Discord連携が必要です。"},{status:409})};
  return {admin,user,discordUserId:link.discord_user_id};
}

async function currentPreferences(discordUserId){
  const roles=await ensureDefaultNotificationRoles(discordUserId);
  const member=await getDiscordMember(discordUserId);
  const current=new Set(member?.roles||[]);
  return {
    roles,
    preferences:Object.fromEntries(KEYS.map(key=>[key,current.has(roles[key])])),
  };
}

export async function GET(request){
  try{
    const ctx=await context(request);if(ctx.error)return ctx.error;
    const {preferences}=await currentPreferences(ctx.discordUserId);
    return NextResponse.json({ok:true,preferences});
  }catch(error){
    console.error("discord preferences get failed",error);
    return NextResponse.json({error:"通知設定を取得できませんでした。"},{status:500});
  }
}

export async function POST(request){
  try{
    const ctx=await context(request);if(ctx.error)return ctx.error;
    const body=await request.json().catch(()=>({}));
    const key=String(body?.key||"");
    const enabled=Boolean(body?.enabled);
    if(!KEYS.includes(key))return NextResponse.json({error:"通知設定が不正です。"},{status:400});
    const roles=await ensureNotificationRoles();
    await ensureDefaultNotificationRoles(ctx.discordUserId);
    if(enabled)await addDiscordRole(ctx.discordUserId,roles[key]);
    else await removeDiscordRole(ctx.discordUserId,roles[key]);
    const {preferences}=await currentPreferences(ctx.discordUserId);
    return NextResponse.json({ok:true,preferences});
  }catch(error){
    console.error("discord preferences update failed",error);
    return NextResponse.json({error:"通知設定を更新できませんでした。"},{status:500});
  }
}

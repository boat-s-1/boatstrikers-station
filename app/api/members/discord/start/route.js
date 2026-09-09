import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { discordConfig, getAdminClient, isDiscordEligible } from "@/app/lib/discordPremium";

export const runtime="nodejs";

export async function POST(request){
  try{
    const auth=request.headers.get("authorization")||"";
    const accessToken=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!accessToken)return NextResponse.json({error:"ログインが必要です。"},{status:401});

    const admin=getAdminClient();
    const {data:{user},error:userError}=await admin.auth.getUser(accessToken);
    if(userError||!user)return NextResponse.json({error:"ログイン情報が無効です。"},{status:401});

    const {data:profile,error:profileError}=await admin.from("bs_member_profiles")
      .select("plan,membership_status")
      .eq("user_id",user.id).maybeSingle();
    if(profileError)throw profileError;
    if(!isDiscordEligible(profile)){
      return NextResponse.json({error:"Discord全通知は対象会員限定です。"},{status:403});
    }

    const state=randomBytes(24).toString("hex");
    const expiresAt=new Date(Date.now()+10*60*1000).toISOString();
    const {error:stateError}=await admin.from("bs_member_discord_oauth_states").insert({state,user_id:user.id,expires_at:expiresAt});
    if(stateError)throw stateError;

    const {clientId}=discordConfig();
    const origin=new URL(request.url).origin;
    const redirectUri=process.env.DISCORD_REDIRECT_URI||`${origin}/api/members/discord/callback`;
    const params=new URLSearchParams({
      response_type:"code",
      client_id:clientId,
      scope:"identify guilds.join",
      state,
      redirect_uri:redirectUri,
      prompt:"consent",
    });
    return NextResponse.json({ok:true,url:`https://discord.com/oauth2/authorize?${params.toString()}`});
  }catch(error){
    console.error("discord oauth start failed",error);
    return NextResponse.json({error:"Discord連携を開始できませんでした。"},{status:500});
  }
}

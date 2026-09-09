import { NextResponse } from "next/server";
import { addPremiumRole, discordConfig, getAdminClient, isDiscordEligible, joinGuild } from "@/app/lib/discordPremium";

export const runtime="nodejs";

export async function GET(request){
  const requestUrl=new URL(request.url);
  const origin=requestUrl.origin;
  const membersUrl=new URL("/members",origin);
  try{
    const code=requestUrl.searchParams.get("code")||"";
    const state=requestUrl.searchParams.get("state")||"";
    if(!code||!state)throw new Error("Discord OAuth code/state is missing");

    const admin=getAdminClient();
    const now=new Date().toISOString();
    const {data:stateRow,error:stateError}=await admin.from("bs_member_discord_oauth_states")
      .select("state,user_id,expires_at,used_at")
      .eq("state",state).maybeSingle();
    if(stateError)throw stateError;
    if(!stateRow||stateRow.used_at||new Date(stateRow.expires_at).getTime()<Date.now())throw new Error("Discord OAuth state is invalid or expired");

    const {error:consumeError}=await admin.from("bs_member_discord_oauth_states")
      .update({used_at:now}).eq("state",state).is("used_at",null);
    if(consumeError)throw consumeError;

    const {clientId,clientSecret}=discordConfig();
    const redirectUri=process.env.DISCORD_REDIRECT_URI||`${origin}/api/members/discord/callback`;
    const tokenBody=new URLSearchParams({
      client_id:clientId,
      client_secret:clientSecret,
      grant_type:"authorization_code",
      code,
      redirect_uri:redirectUri,
    });
    const tokenResponse=await fetch("https://discord.com/api/v10/oauth2/token",{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:tokenBody,
      cache:"no-store",
    });
    if(!tokenResponse.ok)throw new Error(`Discord token exchange failed: ${tokenResponse.status}`);
    const tokenData=await tokenResponse.json();
    if(!tokenData?.access_token)throw new Error("Discord access token missing");

    const meResponse=await fetch("https://discord.com/api/v10/users/@me",{
      headers:{Authorization:`Bearer ${tokenData.access_token}`},
      cache:"no-store",
    });
    if(!meResponse.ok)throw new Error(`Discord user fetch failed: ${meResponse.status}`);
    const discordUser=await meResponse.json();
    if(!discordUser?.id)throw new Error("Discord user id missing");

    const {data:profile,error:profileError}=await admin.from("bs_member_profiles")
      .select("plan,membership_status")
      .eq("user_id",stateRow.user_id).maybeSingle();
    if(profileError)throw profileError;
    if(!isDiscordEligible(profile))throw new Error("Discord premium eligibility expired");

    await joinGuild(discordUser.id,tokenData.access_token);
    await addPremiumRole(discordUser.id);

    const {error:linkError}=await admin.from("bs_member_discord_links").upsert({
      user_id:stateRow.user_id,
      discord_user_id:discordUser.id,
      discord_username:discordUser.username||null,
      discord_global_name:discordUser.global_name||null,
      discord_avatar:discordUser.avatar||null,
      linked_at:now,
      last_role_synced_at:now,
      last_role_state:"premium",
      updated_at:now,
    },{onConflict:"user_id"});
    if(linkError)throw linkError;

    membersUrl.searchParams.set("discord","linked");
    return NextResponse.redirect(membersUrl);
  }catch(error){
    console.error("discord oauth callback failed",error);
    membersUrl.searchParams.set("discord","error");
    return NextResponse.redirect(membersUrl);
  }
}

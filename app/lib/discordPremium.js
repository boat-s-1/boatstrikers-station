import { createClient } from "@supabase/supabase-js";

export function getAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export function discordConfig(){
  const required={
    DISCORD_CLIENT_ID:process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET:process.env.DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN:process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID:process.env.DISCORD_GUILD_ID,
    DISCORD_PREMIUM_ROLE_ID:process.env.DISCORD_PREMIUM_ROLE_ID,
  };
  const missing=Object.entries(required).filter(([,value])=>!value).map(([key])=>key);
  if(missing.length){
    throw new Error(`Discord環境変数が未設定です: ${missing.join(",")}`);
  }
  return {
    clientId:required.DISCORD_CLIENT_ID,
    clientSecret:required.DISCORD_CLIENT_SECRET,
    botToken:required.DISCORD_BOT_TOKEN,
    guildId:required.DISCORD_GUILD_ID,
    premiumRoleId:required.DISCORD_PREMIUM_ROLE_ID,
  };
}

export function isDiscordEligible(profile){
  if(!profile||profile.membership_status!=="active")return false;
  return ["beta_premium","plus","premium"].includes(profile.plan);
}

export async function discordApi(path,{method="GET",body,token}={}){
  const response=await fetch(`https://discord.com/api/v10${path}`,{
    method,
    headers:{
      Authorization:token||`Bot ${discordConfig().botToken}`,
      ...(body?{"Content-Type":"application/json"}:{}),
    },
    body:body?JSON.stringify(body):undefined,
    cache:"no-store",
  });
  if(!response.ok){
    const text=await response.text().catch(()=>"");
    throw new Error(`Discord API failed: ${response.status} ${text}`.slice(0,1200));
  }
  if(response.status===204)return null;
  return response.json().catch(()=>null);
}

export async function addPremiumRole(discordUserId){
  const {guildId,premiumRoleId}=discordConfig();
  await discordApi(`/guilds/${guildId}/members/${discordUserId}/roles/${premiumRoleId}`,{method:"PUT"});
}

export async function removePremiumRole(discordUserId){
  const {guildId,premiumRoleId}=discordConfig();
  await discordApi(`/guilds/${guildId}/members/${discordUserId}/roles/${premiumRoleId}`,{method:"DELETE"});
}

export async function joinGuild(discordUserId,userAccessToken){
  const {guildId,premiumRoleId}=discordConfig();
  return discordApi(`/guilds/${guildId}/members/${discordUserId}`,{
    method:"PUT",
    body:{access_token:userAccessToken,roles:[premiumRoleId]},
  });
}

export async function sendDiscordMessage(channelId,content){
  if(!channelId)return null;
  return discordApi(`/channels/${channelId}/messages`,{
    method:"POST",
    body:{content:String(content).slice(0,2000),allowed_mentions:{parse:[]}},
  });
}

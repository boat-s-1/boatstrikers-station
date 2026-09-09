import { createClient } from "@supabase/supabase-js";

export const DISCORD_NOTIFICATION_ROLES={
  configured:"BSC 通知設定済",
  ichika:"BSC 一果通知",
  hatsune:"BSC 初音通知",
  kiina:"BSC キイナ通知",
  all_alerts:"BSC 全アラート通知",
};

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

export async function ensureNotificationRoles(){
  const {guildId}=discordConfig();
  const existing=await discordApi(`/guilds/${guildId}/roles`);
  const result={};
  for(const [key,name] of Object.entries(DISCORD_NOTIFICATION_ROLES)){
    let role=(existing||[]).find(item=>item?.name===name);
    if(!role){
      role=await discordApi(`/guilds/${guildId}/roles`,{
        method:"POST",
        body:{name,hoist:false,mentionable:key!=="configured"},
      });
    }else if(key!=="configured"&&!role.mentionable){
      role=await discordApi(`/guilds/${guildId}/roles/${role.id}`,{
        method:"PATCH",
        body:{mentionable:true},
      });
    }
    result[key]=role.id;
  }
  return result;
}

export async function getDiscordMember(discordUserId){
  const {guildId}=discordConfig();
  return discordApi(`/guilds/${guildId}/members/${discordUserId}`);
}

export async function addDiscordRole(discordUserId,roleId){
  const {guildId}=discordConfig();
  await discordApi(`/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,{method:"PUT"});
}

export async function removeDiscordRole(discordUserId,roleId){
  const {guildId}=discordConfig();
  await discordApi(`/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,{method:"DELETE"});
}

export async function ensureDefaultNotificationRoles(discordUserId){
  const roles=await ensureNotificationRoles();
  const member=await getDiscordMember(discordUserId);
  const current=new Set(member?.roles||[]);
  if(current.has(roles.configured))return roles;
  for(const key of ["configured","ichika","hatsune","kiina","all_alerts"]){
    await addDiscordRole(discordUserId,roles[key]);
  }
  return roles;
}

export async function addPremiumRole(discordUserId){
  const {premiumRoleId}=discordConfig();
  await addDiscordRole(discordUserId,premiumRoleId);
}

export async function removePremiumRole(discordUserId){
  const {premiumRoleId}=discordConfig();
  await removeDiscordRole(discordUserId,premiumRoleId);
}

export async function joinGuild(discordUserId,userAccessToken){
  const {guildId,premiumRoleId}=discordConfig();
  return discordApi(`/guilds/${guildId}/members/${discordUserId}`,{
    method:"PUT",
    body:{access_token:userAccessToken,roles:[premiumRoleId]},
  });
}

export async function sendDiscordMessage(channelId,content,{roleId}={}){
  if(!channelId)return null;
  const bodyContent=roleId?`<@&${roleId}> ${content}`:content;
  return discordApi(`/channels/${channelId}/messages`,{
    method:"POST",
    body:{
      content:String(bodyContent).slice(0,2000),
      allowed_mentions:roleId?{parse:[],roles:[roleId]}:{parse:[]},
    },
  });
}

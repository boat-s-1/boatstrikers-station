import { NextResponse } from "next/server";
import { addPremiumRole, getAdminClient, isDiscordEligible, removePremiumRole } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const admin=getAdminClient();
  try{
    const {data:links,error:linksError}=await admin.from("bs_member_discord_links")
      .select("user_id,discord_user_id,last_role_state").limit(1000);
    if(linksError)throw linksError;
    if(!links?.length)return NextResponse.json({ok:true,checked:0,granted:0,revoked:0,failed:0});

    const userIds=links.map(row=>row.user_id);
    const {data:profiles,error:profilesError}=await admin.from("bs_member_profiles")
      .select("user_id,plan,membership_status").in("user_id",userIds);
    if(profilesError)throw profilesError;
    const profileMap=new Map((profiles||[]).map(row=>[row.user_id,row]));
    let granted=0,revoked=0,failed=0;

    for(const link of links){
      const eligible=isDiscordEligible(profileMap.get(link.user_id));
      const desired=eligible?"premium":"inactive";
      try{
        if(eligible)await addPremiumRole(link.discord_user_id);
        else await removePremiumRole(link.discord_user_id);
        const now=new Date().toISOString();
        await admin.from("bs_member_discord_links").update({last_role_state:desired,last_role_synced_at:now,updated_at:now}).eq("user_id",link.user_id);
        if(desired!==link.last_role_state){if(eligible)granted+=1;else revoked+=1;}
      }catch(error){
        failed+=1;
        console.error(JSON.stringify({level:"error",message:"discord membership sync failed",userId:link.user_id,error:String(error?.message||error).slice(0,600)}));
      }
    }
    return NextResponse.json({ok:true,checked:links.length,granted,revoked,failed,ranAt:new Date().toISOString()});
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    console.error(JSON.stringify({level:"error",message:"discord membership sync cron failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

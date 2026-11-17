import { NextResponse } from "next/server";
import { isDiscordAlertsCronAuthorized } from "../../../lib/discordAlertsCronAuth";
import { addPremiumRole, ensureDefaultNotificationRoles, getAdminClient, isDiscordEligible, removePremiumRole } from "../../../lib/discordPremium";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;
const MAX_MEMBERS_PER_RUN=10;
const RUN_BUDGET_MS=20_000;

function authorized(request){
  return isDiscordAlertsCronAuthorized(request);
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});
  const admin=getAdminClient();
  const startedAt=Date.now();
  try{
    const {data:links,error:linksError}=await admin.from("bs_member_discord_links")
      .select("user_id,discord_user_id,last_role_state").order("last_role_synced_at",{ascending:true,nullsFirst:true}).limit(MAX_MEMBERS_PER_RUN);
    if(linksError)throw linksError;
    if(!links?.length)return NextResponse.json({ok:true,checked:0,granted:0,revoked:0,failed:0});

    const userIds=links.map(row=>row.user_id);
    const {data:profiles,error:profilesError}=await admin.from("bs_member_profiles")
      .select("user_id,plan,membership_status").in("user_id",userIds);
    if(profilesError)throw profilesError;
    const profileMap=new Map((profiles||[]).map(row=>[row.user_id,row]));
    let granted=0,revoked=0,failed=0,checked=0,deferred=0;

    for(const link of links){
      if(Date.now()-startedAt>=RUN_BUDGET_MS){deferred+=1;continue;}
      checked+=1;
      const eligible=isDiscordEligible(profileMap.get(link.user_id));
      const desired=eligible?"premium":"inactive";
      try{
        if(eligible){
          await addPremiumRole(link.discord_user_id);
          await ensureDefaultNotificationRoles(link.discord_user_id);
        }else{
          await removePremiumRole(link.discord_user_id);
        }
        const now=new Date().toISOString();
        const {data:updated,error:updateError}=await admin.from("bs_member_discord_links").update({last_role_state:desired,last_role_synced_at:now,updated_at:now}).eq("user_id",link.user_id).select("user_id");
        if(updateError)throw updateError;
        if(!updated?.length)throw new Error("Discord role sync state update affected zero rows");
        if(desired!==link.last_role_state){if(eligible)granted+=1;else revoked+=1;}
      }catch(error){
        failed+=1;
        console.error(JSON.stringify({level:"error",message:"discord membership sync failed",userId:link.user_id,error:String(error?.message||error).slice(0,600)}));
      }
    }
    console.info(JSON.stringify({level:"info",message:"discord membership sync cron complete",checked,granted,revoked,failed,deferred}));
    return NextResponse.json({ok:failed===0,checked,granted,revoked,failed,deferred,ranAt:new Date().toISOString()},{status:failed?207:200});
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    console.error(JSON.stringify({level:"error",message:"discord membership sync cron failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}

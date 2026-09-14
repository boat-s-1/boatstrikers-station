import { NextResponse } from "next/server";
import { getMemberAdminClient, requireMemberEntitlementFromRequest } from "../../../../lib/memberEntitlement";
import { MEMBER_FEATURE_LIMITS, jstUsageDate } from "../../../../lib/memberFeatureUsage";

export const dynamic = "force-dynamic";

const VISIBLE_FEATURES=["elimination_ai","exhibition_compare_ai","ai_detail"];

function dateOffset(days){
  const now=new Date();
  const shifted=new Date(now.getTime()-days*86400000);
  return jstUsageDate(shifted);
}

function summarize(rows){
  const byFeature={};
  for(const key of VISIBLE_FEATURES){
    const definition=MEMBER_FEATURE_LIMITS[key];
    const featureRows=rows.filter(row=>row.feature_key===key);
    const users=new Set(featureRows.map(row=>row.user_id));
    const totalUses=featureRows.reduce((sum,row)=>sum+Number(row.usage_count||0),0);
    const exhaustedUsers=new Set(featureRows.filter(row=>Number(row.usage_count||0)>=Number(definition?.freeDailyLimit||Infinity)).map(row=>row.user_id));
    byFeature[key]={
      label:definition?.label||key,
      limit:definition?.freeDailyLimit||null,
      users:users.size,
      uses:totalUses,
      exhaustedUsers:exhaustedUsers.size,
      avgPerUser:users.size?Number((totalUses/users.size).toFixed(2)):0,
    };
  }
  const allUsers=new Set(rows.map(row=>row.user_id));
  return {
    users:allUsers.size,
    uses:rows.reduce((sum,row)=>sum+Number(row.usage_count||0),0),
    exhaustedUsers:new Set(rows.filter(row=>{
      const limit=MEMBER_FEATURE_LIMITS[row.feature_key]?.freeDailyLimit;
      return limit&&Number(row.usage_count||0)>=limit;
    }).map(row=>row.user_id)).size,
    byFeature,
  };
}

export async function GET(request){
  try{
    const access=await requireMemberEntitlementFromRequest(request,{level:"admin"});
    if(!access.ok)return NextResponse.json({ok:false,error:access.error},{status:access.status});

    const admin=getMemberAdminClient();
    const today=jstUsageDate();
    const start30=dateOffset(29);
    const {data,error}=await admin.from("bs_member_feature_usage_daily")
      .select("user_id,feature_key,usage_date,usage_count")
      .in("feature_key",VISIBLE_FEATURES)
      .gte("usage_date",start30)
      .lte("usage_date",today)
      .order("usage_date",{ascending:true});
    if(error)throw error;

    const rows=data||[];
    const start7=dateOffset(6);
    const todayRows=rows.filter(row=>row.usage_date===today);
    const sevenRows=rows.filter(row=>row.usage_date>=start7);
    const daily=Array.from({length:30},(_,index)=>{
      const date=dateOffset(29-index);
      const dayRows=rows.filter(row=>row.usage_date===date);
      return {date,...summarize(dayRows)};
    });

    return NextResponse.json({
      ok:true,
      generatedAt:new Date().toISOString(),
      today,
      periods:{today:summarize(todayRows),days7:summarize(sevenRows),days30:summarize(rows)},
      daily,
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[admin feature usage]",error);
    return NextResponse.json({ok:false,error:"利用状況を取得できませんでした。"},{status:500});
  }
}

import { NextResponse } from "next/server";
import { BETA_ACCESS_END, getMemberAdminClient, requireMemberEntitlementFromRequest } from "../../../../lib/memberEntitlement";
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

function percent(part,total){
  return total?Number(((part/total)*100).toFixed(1)):0;
}

function dateDiffDays(fromDate,toDate){
  const from=new Date(`${fromDate}T00:00:00+09:00`).getTime();
  const to=new Date(`${toDate}T00:00:00+09:00`).getTime();
  if(!Number.isFinite(from)||!Number.isFinite(to))return null;
  return Math.floor((to-from)/86400000);
}

function buildFunnel({profiles,allUsageRows,planEvents}){
  const activeProfiles=profiles.filter(profile=>profile.membership_status==="active"&&!profile.is_admin);
  const planCounts={free:0,betaPremium:0,premium:0,legacyPlus:0,other:0};
  for(const profile of activeProfiles){
    if(profile.plan==="free")planCounts.free+=1;
    else if(profile.plan==="beta_premium")planCounts.betaPremium+=1;
    else if(profile.plan==="premium")planCounts.premium+=1;
    else if(profile.plan==="plus")planCounts.legacyPlus+=1;
    else planCounts.other+=1;
  }

  const paidConversionEvents=planEvents.filter(event=>event.to_plan==="premium"&&event.from_plan&&event.from_plan!=="premium");
  const paidConvertedUsers=new Set(paidConversionEvents.map(event=>event.user_id));
  const betaOpen=Date.now()<BETA_ACCESS_END.getTime();
  const paidEligibleBase=planCounts.free+planCounts.premium;

  const firstUsageByUser=new Map();
  for(const row of allUsageRows){
    const current=firstUsageByUser.get(row.user_id);
    if(!current||row.usage_date<current)firstUsageByUser.set(row.user_id,row.usage_date);
  }

  let sameDayUsers=0;
  let within7DaysUsers=0;
  let everUsedUsers=0;
  for(const profile of activeProfiles){
    const firstUsage=firstUsageByUser.get(profile.user_id);
    if(!firstUsage)continue;
    everUsedUsers+=1;
    const createdDate=jstUsageDate(new Date(profile.created_at));
    const diff=dateDiffDays(createdDate,firstUsage);
    if(diff===0)sameDayUsers+=1;
    if(diff!==null&&diff>=0&&diff<=7)within7DaysUsers+=1;
  }

  const conversionByFeature=Object.fromEntries(VISIBLE_FEATURES.map(key=>[key,{label:MEMBER_FEATURE_LIMITS[key]?.label||key,conversions:0}]));
  for(const event of paidConversionEvents){
    const conversionDate=jstUsageDate(new Date(event.changed_at));
    for(const key of VISIBLE_FEATURES){
      const limit=MEMBER_FEATURE_LIMITS[key]?.freeDailyLimit;
      const reached=allUsageRows.some(row=>row.user_id===event.user_id&&row.feature_key===key&&row.usage_date<=conversionDate&&Number(row.usage_count||0)>=Number(limit||Infinity));
      if(reached)conversionByFeature[key].conversions+=1;
    }
  }

  return {
    betaOpen,
    conversion:{
      available:!betaOpen,
      convertedUsers:paidConvertedUsers.size,
      eligibleUsers:paidEligibleBase,
      rate:!betaOpen?percent(paidConvertedUsers.size,paidEligibleBase):null,
      note:betaOpen?"β PREMIUM無料開放期間中のため、有料PREMIUM転換率は正式課金開始後に表示します。":"FREEから有料PREMIUMへ移行した会員の割合です。",
    },
    planCounts,
    activation:{
      members:activeProfiles.length,
      sameDayUsers,
      sameDayRate:percent(sameDayUsers,activeProfiles.length),
      within7DaysUsers,
      within7DaysRate:percent(within7DaysUsers,activeProfiles.length),
      everUsedUsers,
      everUsedRate:percent(everUsedUsers,activeProfiles.length),
      preSignupTracking:false,
      note:"未ログイン時のAI利用は現在記録していないため、登録前の利用比較は対象外です。登録後の初回利用を基準に集計しています。",
    },
    conversionByFeature,
  };
}

export async function GET(request){
  try{
    const access=await requireMemberEntitlementFromRequest(request,{level:"admin"});
    if(!access.ok)return NextResponse.json({ok:false,error:access.error},{status:access.status});

    const admin=getMemberAdminClient();
    const today=jstUsageDate();
    const start30=dateOffset(29);
    const [{data,error},{data:profilesData,error:profilesError},{data:eventsData,error:eventsError},{data:allUsageData,error:allUsageError}]=await Promise.all([
      admin.from("bs_member_feature_usage_daily")
        .select("user_id,feature_key,usage_date,usage_count")
        .in("feature_key",VISIBLE_FEATURES)
        .gte("usage_date",start30)
        .lte("usage_date",today)
        .order("usage_date",{ascending:true}),
      admin.from("bs_member_profiles")
        .select("user_id,plan,membership_status,created_at,is_admin"),
      admin.from("bs_member_plan_events")
        .select("user_id,from_plan,to_plan,changed_at")
        .order("changed_at",{ascending:true}),
      admin.from("bs_member_feature_usage_daily")
        .select("user_id,feature_key,usage_date,usage_count")
        .in("feature_key",VISIBLE_FEATURES)
        .order("usage_date",{ascending:true}),
    ]);
    if(error)throw error;
    if(profilesError)throw profilesError;
    if(eventsError)throw eventsError;
    if(allUsageError)throw allUsageError;

    const rows=data||[];
    const start7=dateOffset(6);
    const todayRows=rows.filter(row=>row.usage_date===today);
    const sevenRows=rows.filter(row=>row.usage_date>=start7);
    const daily=Array.from({length:30},(_,index)=>{
      const date=dateOffset(29-index);
      const dayRows=rows.filter(row=>row.usage_date===date);
      return {date,...summarize(dayRows)};
    });
    const funnel=buildFunnel({profiles:profilesData||[],allUsageRows:allUsageData||[],planEvents:eventsData||[]});

    return NextResponse.json({
      ok:true,
      generatedAt:new Date().toISOString(),
      today,
      periods:{today:summarize(todayRows),days7:summarize(sevenRows),days30:summarize(rows)},
      daily,
      funnel,
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[admin feature usage]",error);
    return NextResponse.json({ok:false,error:"利用状況を取得できませんでした。"},{status:500});
  }
}

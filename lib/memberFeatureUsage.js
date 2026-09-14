import { getMemberAdminClient, getMemberEntitlementFromRequest } from "./memberEntitlement";

export const MEMBER_FEATURE_LIMITS={
  elimination_ai:{label:"消去法AI",freeDailyLimit:3},
  exhibition_compare_ai:{label:"展示比較AI",freeDailyLimit:3},
  first_mark_simulator:{label:"1マークシミュレーター",freeDailyLimit:3},
  ai_detail:{label:"AI詳細診断",freeDailyLimit:5},
};

export function jstUsageDate(date=new Date()){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",
  }).format(date);
}

export function getMemberFeatureDefinition(featureKey){
  return MEMBER_FEATURE_LIMITS[featureKey]||null;
}

export function isUnlimitedFeatureEntitlement(entitlement){
  return Boolean(entitlement?.premium);
}

export async function getMemberFeatureUsageStatus({admin,userId,featureKey,entitlement,usageDate=jstUsageDate()}){
  const definition=getMemberFeatureDefinition(featureKey);
  if(!definition)throw new Error(`Unknown member feature: ${featureKey}`);
  if(isUnlimitedFeatureEntitlement(entitlement)){
    return {featureKey,label:definition.label,unlimited:true,limit:null,used:0,remaining:null,usageDate};
  }
  const db=admin||getMemberAdminClient();
  const {data,error}=await db.from("bs_member_feature_usage_daily")
    .select("usage_count")
    .eq("user_id",userId)
    .eq("feature_key",featureKey)
    .eq("usage_date",usageDate)
    .maybeSingle();
  if(error)throw error;
  const used=Math.max(0,Number(data?.usage_count||0));
  const limit=definition.freeDailyLimit;
  return {featureKey,label:definition.label,unlimited:false,limit,used,remaining:Math.max(0,limit-used),usageDate};
}

export async function reserveMemberFeatureUsage({admin,userId,featureKey,entitlement,usageDate=jstUsageDate()}){
  const definition=getMemberFeatureDefinition(featureKey);
  if(!definition)throw new Error(`Unknown member feature: ${featureKey}`);
  if(isUnlimitedFeatureEntitlement(entitlement)){
    return {allowed:true,reserved:false,featureKey,label:definition.label,unlimited:true,limit:null,used:0,remaining:null,usageDate};
  }
  const db=admin||getMemberAdminClient();
  const {data,error}=await db.rpc("bs_try_consume_member_feature",{
    p_user_id:userId,
    p_feature_key:featureKey,
    p_usage_date:usageDate,
    p_limit:definition.freeDailyLimit,
  });
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  return {
    allowed:Boolean(row?.allowed),reserved:Boolean(row?.allowed),featureKey,label:definition.label,
    unlimited:false,limit:definition.freeDailyLimit,used:Number(row?.usage_count||0),
    remaining:Number(row?.remaining||0),usageDate,
  };
}

export async function refundMemberFeatureUsage({admin,userId,featureKey,entitlement,usageDate=jstUsageDate()}){
  if(isUnlimitedFeatureEntitlement(entitlement))return 0;
  const db=admin||getMemberAdminClient();
  const {data,error}=await db.rpc("bs_refund_member_feature",{
    p_user_id:userId,p_feature_key:featureKey,p_usage_date:usageDate,
  });
  if(error)throw error;
  return Number(data||0);
}

export async function getFeatureAccessFromRequest(request,featureKey){
  const entitlement=await getMemberEntitlementFromRequest(request);
  if(!entitlement.authenticated)return {ok:false,status:401,error:"会員ログインが必要です。",entitlement};
  if(!entitlement.active)return {ok:false,status:403,error:"有効なBoatStrikers会員のみ利用できます。",entitlement};
  const definition=getMemberFeatureDefinition(featureKey);
  if(!definition)return {ok:false,status:400,error:"対象機能が見つかりません。",entitlement};
  return {ok:true,status:200,error:null,entitlement,definition};
}

export async function runWithMemberFeatureQuota(request,featureKey,handler){
  const access=await getFeatureAccessFromRequest(request,featureKey);
  if(!access.ok){
    const error=new Error(access.error);
    error.status=access.status;
    throw error;
  }
  const admin=getMemberAdminClient();
  const usageDate=jstUsageDate();
  const reservation=await reserveMemberFeatureUsage({
    admin,userId:access.entitlement.user.id,featureKey,entitlement:access.entitlement,usageDate,
  });
  if(!reservation.allowed){
    const error=new Error(`本日の${reservation.label}の無料利用回数に達しました。PREMIUMなら無制限で利用できます。`);
    error.status=429;
    error.usage=reservation;
    throw error;
  }
  try{
    const result=await handler({admin,entitlement:access.entitlement,usage:reservation});
    return {result,usage:reservation};
  }catch(error){
    if(reservation.reserved){
      await refundMemberFeatureUsage({
        admin,userId:access.entitlement.user.id,featureKey,entitlement:access.entitlement,usageDate,
      }).catch(refundError=>console.error("[member feature usage refund]",refundError));
    }
    throw error;
  }
}

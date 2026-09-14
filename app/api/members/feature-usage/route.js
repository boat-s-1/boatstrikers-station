import { NextResponse } from "next/server";
import { getMemberAdminClient, getMemberEntitlementFromRequest } from "../../../../lib/memberEntitlement";
import { MEMBER_FEATURE_LIMITS, getMemberFeatureUsageStatus, reserveMemberFeatureUsage } from "../../../../lib/memberFeatureUsage";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request){
  try{
    const entitlement=await getMemberEntitlementFromRequest(request);
    if(!entitlement.authenticated){
      return NextResponse.json({ok:false,error:"会員ログインが必要です。"},{status:401});
    }
    if(!entitlement.active){
      return NextResponse.json({ok:false,error:"有効なBoatStrikers会員のみ利用できます。"},{status:403});
    }
    const requested=new URL(request.url).searchParams.get("feature");
    const featureKeys=requested?[requested]:Object.keys(MEMBER_FEATURE_LIMITS);
    if(featureKeys.some(key=>!MEMBER_FEATURE_LIMITS[key])){
      return NextResponse.json({ok:false,error:"対象機能が見つかりません。"},{status:400});
    }
    const admin=getMemberAdminClient();
    const statuses=await Promise.all(featureKeys.map(featureKey=>getMemberFeatureUsageStatus({
      admin,userId:entitlement.user.id,featureKey,entitlement,
    })));
    return NextResponse.json({
      ok:true,
      plan:entitlement.plan,
      betaOpen:entitlement.betaOpen,
      premium:entitlement.premium,
      features:Object.fromEntries(statuses.map(status=>[status.featureKey,status])),
    },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    console.error("[member feature usage]",error);
    return NextResponse.json({ok:false,error:"利用回数を確認できませんでした。"},{status:500});
  }
}

export async function POST(request){
  try{
    const entitlement=await getMemberEntitlementFromRequest(request);
    if(!entitlement.authenticated){
      return NextResponse.json({ok:false,error:"会員ログインが必要です。"},{status:401});
    }
    if(!entitlement.active){
      return NextResponse.json({ok:false,error:"有効なBoatStrikers会員のみ利用できます。"},{status:403});
    }

    const body=await request.json().catch(()=>({}));
    const featureKey=String(body?.feature||"");
    if(!MEMBER_FEATURE_LIMITS[featureKey]){
      return NextResponse.json({ok:false,error:"対象機能が見つかりません。"},{status:400});
    }

    const admin=getMemberAdminClient();
    const usage=await reserveMemberFeatureUsage({
      admin,
      userId:entitlement.user.id,
      featureKey,
      entitlement,
    });

    if(!usage.allowed){
      return NextResponse.json({
        ok:false,
        error:`本日の${usage.label}の無料利用回数に達しました。PREMIUMなら無制限で利用できます。`,
        usage,
      },{status:429,headers:{"Cache-Control":"private, no-store, max-age=0"}});
    }

    return NextResponse.json({
      ok:true,
      plan:entitlement.plan,
      betaOpen:entitlement.betaOpen,
      premium:entitlement.premium,
      usage,
    },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    console.error("[member feature usage consume]",error);
    return NextResponse.json({ok:false,error:"利用回数を更新できませんでした。"},{status:500});
  }
}

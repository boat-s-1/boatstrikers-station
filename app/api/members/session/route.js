import { NextResponse } from "next/server";
import { getMemberEntitlementFromRequest, MEMBER_ACCESS_COOKIE } from "../../../../lib/memberEntitlement";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request){
  const startedAt=Date.now();
  const sourceHeader=request.headers.get("x-member-sync-source");
  const source=["INITIAL_SESSION","SIGNED_IN","TOKEN_REFRESHED","USER_UPDATED","PASSWORD_RECOVERY","magazine","consumer"].includes(sourceHeader)?sourceHeader:"unknown";
  const log=(outcome)=>console.info("[member session sync]",JSON.stringify({source,outcome,durationMs:Date.now()-startedAt}));
  try{
    const auth=request.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token){log("missing-token");return NextResponse.json({error:"ログイン情報を確認できません。"},{status:401});}
    const entitlement=await getMemberEntitlementFromRequest(request);
    if(!entitlement.authenticated){log("unauthenticated");return NextResponse.json({error:"ログイン情報が無効です。"},{status:401});}
    const response=NextResponse.json({ok:true,plan:entitlement.plan,plus:entitlement.plus,premium:entitlement.premium});
    response.cookies.set(MEMBER_ACCESS_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:3300});
    response.headers.set("Cache-Control", "private, no-store");
    log("synced");
    return response;
  }catch(error){
    log("error");
    console.error("[member session sync] failed");
    return NextResponse.json({error:"会員セッションを同期できませんでした。"},{status:500});
  }
}

export async function DELETE(){
  const response=NextResponse.json({ok:true});
  response.cookies.set(MEMBER_ACCESS_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

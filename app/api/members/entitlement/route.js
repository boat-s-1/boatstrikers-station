import { NextResponse } from "next/server";
import { getMemberEntitlementFromRequest } from "../../../../lib/memberEntitlement";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request){
  try{
    const result=await getMemberEntitlementFromRequest(request);
    return NextResponse.json({
      authenticated:result.authenticated,
      active:result.active,
      plan:result.plan,
      betaOpen:result.betaOpen,
      plus:result.plus,
      premium:result.premium,
      lineLinked:Boolean(result.profile?.line_user_id),
    },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    console.error("[member entitlement]",error);
    return NextResponse.json({authenticated:false,active:false,plan:"free",betaOpen:false,plus:false,premium:false,lineLinked:false},{status:500});
  }
}

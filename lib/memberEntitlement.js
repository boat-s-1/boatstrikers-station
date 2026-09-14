import { createClient } from "@supabase/supabase-js";

export const MEMBER_ACCESS_COOKIE = "bs_member_access";
export const BETA_ACCESS_END = new Date("2027-01-01T00:00:00+09:00");

export function getMemberAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export function tokenFromMemberRequest(request){
  const auth=request.headers.get("authorization")||"";
  if(auth.startsWith("Bearer "))return auth.slice(7);
  return request.cookies.get(MEMBER_ACCESS_COOKIE)?.value||"";
}

function emptyEntitlement(){
  return {authenticated:false,active:false,betaOpen:false,plan:"free",plus:false,premium:false,admin:false,user:null,profile:null};
}

function paidWindowIsActive(profile){
  if(!profile?.premium_until)return true;
  const end=new Date(profile.premium_until).getTime();
  return Number.isFinite(end)&&end>Date.now();
}

export function evaluateMemberEntitlement(profile){
  const active=profile?.membership_status==="active";
  const betaOpen=active&&Date.now()<BETA_ACCESS_END.getTime();
  const plan=profile?.plan||"free";
  const paidActive=active&&paidWindowIsActive(profile);
  const plus=betaOpen||(paidActive&&["plus","premium"].includes(plan));
  const premium=betaOpen||(paidActive&&plan==="premium");
  const admin=Boolean(active&&profile?.is_admin);
  return {active,betaOpen,plan,plus,premium,admin};
}

export async function getMemberEntitlementFromToken(token){
  if(!token)return emptyEntitlement();
  const adminClient=getMemberAdminClient();
  const {data:{user},error:userError}=await adminClient.auth.getUser(token);
  if(userError||!user)return emptyEntitlement();
  const {data:profile,error:profileError}=await adminClient.from("bs_member_profiles")
    .select("user_id,plan,membership_status,beta_member,premium_until,line_user_id,line_linked_at,is_admin")
    .eq("user_id",user.id).maybeSingle();
  if(profileError)throw profileError;
  const evaluated=evaluateMemberEntitlement(profile);
  return {authenticated:true,user,profile,...evaluated};
}

export async function getMemberEntitlementFromRequest(request){
  return getMemberEntitlementFromToken(tokenFromMemberRequest(request));
}

export async function requireMemberEntitlementFromRequest(request,{level="active"}={}){
  const entitlement=await getMemberEntitlementFromRequest(request);
  if(!entitlement.authenticated)return {ok:false,status:401,error:"会員ログインが必要です。",entitlement};
  if(!entitlement.active)return {ok:false,status:403,error:"有効なBoatStrikers会員のみ利用できます。",entitlement};
  if(level==="admin"&&!entitlement.admin)return {ok:false,status:403,error:"管理者権限が必要です。",entitlement};
  if(level==="plus"&&!entitlement.plus)return {ok:false,status:403,error:"この機能はPREMIUM対象会員限定です。",entitlement};
  if(level==="premium"&&!entitlement.premium)return {ok:false,status:403,error:"この機能はPREMIUM対象会員限定です。",entitlement};
  return {ok:true,status:200,error:null,entitlement};
}

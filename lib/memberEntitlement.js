import { createClient } from "@supabase/supabase-js";

export const MEMBER_ACCESS_COOKIE = "bs_member_access";
export const BETA_ACCESS_END = new Date("2027-01-01T00:00:00+09:00");

function getAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

function tokenFromRequest(request){
  const auth=request.headers.get("authorization")||"";
  if(auth.startsWith("Bearer "))return auth.slice(7);
  return request.cookies.get(MEMBER_ACCESS_COOKIE)?.value||"";
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
  return {active,betaOpen,plan,plus,premium};
}

export async function getMemberEntitlementFromRequest(request){
  const token=tokenFromRequest(request);
  if(!token)return {authenticated:false,active:false,betaOpen:false,plan:"free",plus:false,premium:false,user:null,profile:null};
  const admin=getAdminClient();
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user)return {authenticated:false,active:false,betaOpen:false,plan:"free",plus:false,premium:false,user:null,profile:null};
  const {data:profile,error:profileError}=await admin.from("bs_member_profiles")
    .select("user_id,plan,membership_status,beta_member,premium_until,line_user_id,line_linked_at")
    .eq("user_id",user.id).maybeSingle();
  if(profileError)throw profileError;
  const evaluated=evaluateMemberEntitlement(profile);
  return {authenticated:true,user,profile,...evaluated};
}

import { NextResponse } from "next/server";
import { getAdminClient, isDiscordEligible } from "@/app/lib/discordPremium";

export const runtime="nodejs";

export async function GET(request){
  try{
    const auth=request.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return NextResponse.json({error:"ログインが必要です。"},{status:401});
    const admin=getAdminClient();
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)return NextResponse.json({error:"ログイン情報が無効です。"},{status:401});
    const [{data:profile,error:profileError},{data:link,error:linkError}]=await Promise.all([
      admin.from("bs_member_profiles").select("plan,membership_status").eq("user_id",user.id).maybeSingle(),
      admin.from("bs_member_discord_links").select("discord_user_id,discord_username,discord_global_name,linked_at,last_role_synced_at,last_role_state").eq("user_id",user.id).maybeSingle(),
    ]);
    if(profileError)throw profileError;
    if(linkError)throw linkError;
    return NextResponse.json({ok:true,eligible:isDiscordEligible(profile),linked:Boolean(link),link:link||null});
  }catch(error){
    console.error("discord status failed",error);
    return NextResponse.json({error:"Discord連携状況を取得できませんでした。"},{status:500});
  }
}

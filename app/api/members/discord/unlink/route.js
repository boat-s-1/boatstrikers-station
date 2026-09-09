import { NextResponse } from "next/server";
import { getAdminClient, removePremiumRole } from "../../../../lib/discordPremium";

export const runtime="nodejs";

export async function POST(request){
  try{
    const auth=request.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return NextResponse.json({error:"ログインが必要です。"},{status:401});
    const admin=getAdminClient();
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)return NextResponse.json({error:"ログイン情報が無効です。"},{status:401});

    const {data:link,error:linkError}=await admin.from("bs_member_discord_links")
      .select("discord_user_id").eq("user_id",user.id).maybeSingle();
    if(linkError)throw linkError;
    if(link?.discord_user_id){
      await removePremiumRole(link.discord_user_id).catch(error=>console.error("discord role removal during unlink failed",error));
      const {error:deleteError}=await admin.from("bs_member_discord_links").delete().eq("user_id",user.id);
      if(deleteError)throw deleteError;
    }
    return NextResponse.json({ok:true});
  }catch(error){
    console.error("discord unlink failed",error);
    return NextResponse.json({error:"Discord連携を解除できませんでした。"},{status:500});
  }
}

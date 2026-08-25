import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

function getAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

function makeCode(){
  return `BSLINK-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function POST(request){
  try{
    const auth=request.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return NextResponse.json({error:"ログイン情報を確認できません。"},{status:401});

    const admin=getAdminClient();
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)return NextResponse.json({error:"ログイン情報が無効です。"},{status:401});

    const {data:profile}=await admin.from("bs_member_profiles")
      .select("line_user_id,line_linked_at")
      .eq("user_id",user.id).maybeSingle();
    if(profile?.line_user_id){
      return NextResponse.json({ok:true,linked:true,lineLinkedAt:profile.line_linked_at||null});
    }

    await admin.from("bs_member_line_link_codes")
      .delete().eq("user_id",user.id).is("used_at",null);

    const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
    let code=null;
    let insertError=null;
    for(let i=0;i<5;i+=1){
      code=makeCode();
      const {error}=await admin.from("bs_member_line_link_codes").insert({
        user_id:user.id,
        code,
        expires_at:expiresAt,
      });
      if(!error){insertError=null;break;}
      insertError=error;
    }
    if(insertError)throw insertError;

    return NextResponse.json({ok:true,linked:false,code,expiresAt});
  }catch(error){
    console.error("line link code issue failed",error);
    return NextResponse.json({error:"LINE連携コードを発行できませんでした。時間をおいてお試しください。"},{status:500});
  }
}

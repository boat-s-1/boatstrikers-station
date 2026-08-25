import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export async function POST(request){
  try{
    const auth=request.headers.get("authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return NextResponse.json({error:"ログイン情報を確認できません。"},{status:401});

    const admin=getAdminClient();
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user)return NextResponse.json({error:"ログイン情報が無効です。"},{status:401});

    const {error:deleteError}=await admin.auth.admin.deleteUser(user.id);
    if(deleteError)throw deleteError;

    return NextResponse.json({ok:true});
  }catch(error){
    console.error("member delete failed",error);
    return NextResponse.json({error:"退会処理に失敗しました。時間をおいてもう一度お試しください。"},{status:500});
  }
}

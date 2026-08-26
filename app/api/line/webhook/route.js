import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function getAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

function verifySignature(rawBody,signature,secret){
  if(!signature||!secret)return false;
  const expected=createHmac("sha256",secret).update(rawBody).digest("base64");
  const a=Buffer.from(signature);
  const b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}

async function lineRequest(path,payload){
  const accessToken=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if(!accessToken){
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
    return {ok:false,status:0,body:"missing access token"};
  }
  try{
    const response=await fetch(`https://api.line.me/v2/bot/message/${path}`,{
      method:"POST",
      headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),
    });
    const body=await response.text().catch(()=>"");
    if(!response.ok){
      console.error(`LINE ${path} failed`,response.status,body);
      return {ok:false,status:response.status,body};
    }
    return {ok:true,status:response.status,body};
  }catch(error){
    console.error(`LINE ${path} request failed`,error);
    return {ok:false,status:0,body:String(error?.message||error||"")};
  }
}

async function replyOrPush({replyToken,lineUserId,text}){
  if(replyToken){
    const reply=await lineRequest("reply",{replyToken,messages:[{type:"text",text}]});
    if(reply.ok)return true;
  }
  if(lineUserId){
    const push=await lineRequest("push",{to:lineUserId,messages:[{type:"text",text}],notificationDisabled:false});
    return push.ok;
  }
  return false;
}

export async function POST(request){
  const rawBody=await request.text();
  const secret=process.env.LINE_CHANNEL_SECRET;
  const signature=request.headers.get("x-line-signature")||"";
  if(!secret)return NextResponse.json({error:"LINE_CHANNEL_SECRET is not configured"},{status:503});
  if(!verifySignature(rawBody,signature,secret))return NextResponse.json({error:"invalid signature"},{status:401});

  try{
    const body=JSON.parse(rawBody||"{}");
    const admin=getAdminClient();

    for(const event of body.events||[]){
      if(event?.type!=="message"||event?.message?.type!=="text")continue;
      const lineUserId=event?.source?.userId;
      const code=String(event.message.text||"").trim().toUpperCase();
      if(!lineUserId||!/^BSLINK-[0-9A-F]{8}$/.test(code))continue;

      const {data:linkCode,error:codeError}=await admin.from("bs_member_line_link_codes")
        .select("id,user_id,expires_at,used_at")
        .eq("code",code).is("used_at",null).maybeSingle();

      if(codeError||!linkCode){
        await replyOrPush({replyToken:event.replyToken,lineUserId,text:"連携コードを確認できませんでした。サイトの会員ページで新しいコードを発行してください。"});
        continue;
      }
      if(new Date(linkCode.expires_at).getTime()<Date.now()){
        await replyOrPush({replyToken:event.replyToken,lineUserId,text:"連携コードの有効期限が切れています。サイトの会員ページで新しいコードを発行してください。"});
        continue;
      }

      const now=new Date().toISOString();
      const {error:profileError}=await admin.from("bs_member_profiles")
        .update({line_user_id:lineUserId,line_linked_at:now,updated_at:now})
        .eq("user_id",linkCode.user_id);
      if(profileError)throw profileError;

      const {error:codeUpdateError}=await admin.from("bs_member_line_link_codes")
        .update({used_at:now,line_user_id:lineUserId}).eq("id",linkCode.id);
      if(codeUpdateError)throw codeUpdateError;

      await replyOrPush({
        replyToken:event.replyToken,
        lineUserId,
        text:"✅ BoatStrikers会員とのLINE連携が完了しました。\n通知設定はBoatStrikers会員ページから変更できます。",
      });
    }

    return NextResponse.json({ok:true});
  }catch(error){
    console.error("LINE webhook failed",error);
    return NextResponse.json({error:"webhook failed"},{status:500});
  }
}

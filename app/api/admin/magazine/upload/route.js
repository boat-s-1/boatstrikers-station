import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../lib/supabaseRadioAdmin";
const allowed = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
export async function POST(request){try{await requireRadioBlogAdmin();const form=await request.formData();const file=form.get("file");if(!(file instanceof File))return NextResponse.json({error:"画像を選択してください。"},{status:400});if(!allowed.has(file.type))return NextResponse.json({error:"JPEG・PNG・WebP・GIFのみ対応しています。"},{status:400});if(file.size>10*1024*1024)return NextResponse.json({error:"画像は10MB以下にしてください。"},{status:400});const path=`${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext[file.type]}`;const supabase=getRadioAdminSupabase();const {error}=await supabase.storage.from("magazine-images").upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type,cacheControl:"3600"});if(error)throw error;const {data}=supabase.storage.from("magazine-images").getPublicUrl(path);return NextResponse.json({url:data.publicUrl,path});}catch(error){return NextResponse.json({error:error.message||"アップロードに失敗しました。"},{status:error.status||500});}}

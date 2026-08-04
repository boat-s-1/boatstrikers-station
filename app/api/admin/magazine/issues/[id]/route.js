import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../../lib/supabaseRadioAdmin";
function normalize(body) {
  const status = body.status === "published" ? "published" : "draft";
  return { slug:String(body.slug||"").trim().toLowerCase(), volume:String(body.volume||"").trim(), title:String(body.title||"").trim(), subtitle:String(body.subtitle||"").trim(), summary:String(body.summary||"").trim(), cover_image_url:body.cover_image_url||null, theme_color:body.theme_color||"#0c3f78", accent_color:body.accent_color||"#ff4f87", status, published_at:status === "published" ? (body.published_at || new Date().toISOString()) : (body.published_at || null), sections:Array.isArray(body.sections)?body.sections:[] };
}
export async function PUT(request,{params}) { try { await requireRadioBlogAdmin(); const {id}=await params; const issue=normalize(await request.json()); if(!issue.title) return NextResponse.json({error:"雑誌タイトルを入力してください。"},{status:400}); const {data,error}=await getRadioAdminSupabase().from("magazine_issues").update(issue).eq("id",id).select("*").single(); if(error) throw error; return NextResponse.json({issue:data}); } catch(error){return NextResponse.json({error:error.message||"更新に失敗しました。"},{status:error.status||500});}}
export async function DELETE(_request,{params}) { try { await requireRadioBlogAdmin(); const {id}=await params; const {error}=await getRadioAdminSupabase().from("magazine_issues").delete().eq("id",id); if(error) throw error; return NextResponse.json({ok:true}); } catch(error){return NextResponse.json({error:error.message||"削除に失敗しました。"},{status:error.status||500});}}

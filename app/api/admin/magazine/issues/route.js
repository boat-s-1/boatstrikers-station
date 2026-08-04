import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../lib/supabaseRadioAdmin";

function normalize(body) {
  const status = body.status === "published" ? "published" : "draft";
  return {
    slug: String(body.slug || "").trim().toLowerCase(),
    volume: String(body.volume || "").trim(),
    title: String(body.title || "").trim(),
    subtitle: String(body.subtitle || "").trim(),
    summary: String(body.summary || "").trim(),
    cover_image_url: body.cover_image_url || null,
    theme_color: body.theme_color || "#0c3f78",
    accent_color: body.accent_color || "#ff4f87",
    status,
    published_at: status === "published" ? (body.published_at || new Date().toISOString()) : (body.published_at || null),
    sections: Array.isArray(body.sections) ? body.sections : [],
  };
}
function validate(issue) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(issue.slug)) return "URL名は半角英数字とハイフンで入力してください。";
  if (!issue.title) return "雑誌タイトルを入力してください。";
  return null;
}
export async function GET() {
  try {
    await requireRadioBlogAdmin();
    const { data, error } = await getRadioAdminSupabase().from("magazine_issues").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ issues: data || [] });
  } catch (error) { return NextResponse.json({ error: error.message || "取得に失敗しました。" }, { status: error.status || 500 }); }
}
export async function POST(request) {
  try {
    await requireRadioBlogAdmin();
    const issue = normalize(await request.json());
    const message = validate(issue); if (message) return NextResponse.json({ error: message }, { status: 400 });
    const { data, error } = await getRadioAdminSupabase().from("magazine_issues").insert(issue).select("*").single();
    if (error) throw error;
    return NextResponse.json({ issue: data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error?.code === "23505" ? "同じURL名がすでにあります。" : error.message || "保存に失敗しました。" }, { status: error.status || 500 }); }
}

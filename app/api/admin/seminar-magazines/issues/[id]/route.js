import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../../lib/supabaseRadioAdmin";
import { normalizeAdminIssue } from "../../../../../../lib/seminarMagazineDb";

export async function PUT(request, { params }) {
  try {
    await requireRadioBlogAdmin();
    const { id } = await params;
    const issue = normalizeAdminIssue(await request.json());
    if (!issue.title) return NextResponse.json({ error: "タイトルを入力してください。" }, { status: 400 });
    const { data, error } = await getRadioAdminSupabase().from("seminar_magazine_issues").update(issue).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ issue: data });
  } catch (error) {
    return NextResponse.json({ error: error.message || "更新に失敗しました。" }, { status: error.status || 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireRadioBlogAdmin();
    const { id } = await params;
    const { error } = await getRadioAdminSupabase().from("seminar_magazine_issues").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "削除に失敗しました。" }, { status: error.status || 500 });
  }
}

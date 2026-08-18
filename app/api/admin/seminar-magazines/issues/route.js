import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../lib/supabaseRadioAdmin";
import { normalizeAdminIssue, SEMINAR_BUCKET } from "../../../../../lib/seminarMagazineDb";

async function withPreviews(rows) {
  const supabase = getRadioAdminSupabase();
  return Promise.all((rows || []).map(async (row) => {
    const pages = Array.isArray(row.page_paths) ? row.page_paths : [];
    const hydrated = await Promise.all(pages.map(async (p) => {
      const { data } = await supabase.storage.from(SEMINAR_BUCKET).createSignedUrl(p.path, 3600);
      return { ...p, preview_url: data?.signedUrl || "" };
    }));
    return { ...row, page_paths: hydrated };
  }));
}

export async function GET() {
  try {
    await requireRadioBlogAdmin();
    const { data, error } = await getRadioAdminSupabase()
      .from("seminar_magazine_issues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ issues: await withPreviews(data) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "取得に失敗しました。" }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    await requireRadioBlogAdmin();
    const issue = normalizeAdminIssue(await request.json());
    if (!/^\d{3,4}$/.test(issue.issue_no)) return NextResponse.json({ error: "号数IDは001のように3〜4桁で入力してください。" }, { status: 400 });
    if (!issue.title) return NextResponse.json({ error: "タイトルを入力してください。" }, { status: 400 });
    const { data, error } = await getRadioAdminSupabase().from("seminar_magazine_issues").insert(issue).select("*").single();
    if (error) throw error;
    return NextResponse.json({ issue: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.code === "23505" ? "同じキャラクター・号数がすでにあります。" : error.message || "保存に失敗しました。" }, { status: error.status || 500 });
  }
}

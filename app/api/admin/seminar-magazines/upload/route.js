import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../lib/supabaseRadioAdmin";
import { SEMINAR_BUCKET } from "../../../../../lib/seminarMagazineDb";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request) {
  try {
    await requireRadioBlogAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const series = String(form.get("series") || "");
    const issueNo = String(form.get("issue_no") || "");
    const pageNo = Number(form.get("page_no") || 0);
    if (!(file instanceof File)) return NextResponse.json({ error: "画像を選択してください。" }, { status: 400 });
    if (!["ichika", "hatsune", "kiina"].includes(series) || !/^\d{3,4}$/.test(issueNo) || !Number.isInteger(pageNo) || pageNo < 1 || pageNo > 99) return NextResponse.json({ error: "シリーズ・号数・ページ番号を確認してください。" }, { status: 400 });
    if (!allowed.has(file.type)) return NextResponse.json({ error: "JPEG・PNG・WebPのみ対応しています。" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "画像は10MB以下にしてください。" }, { status: 400 });

    const filename = `page-${String(pageNo).padStart(2, "0")}-${crypto.randomUUID().slice(0, 8)}.${ext[file.type]}`;
    const path = `${series}/${issueNo}/${filename}`;
    const supabase = getRadioAdminSupabase();
    const { error } = await supabase.storage.from(SEMINAR_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "3600" });
    if (error) throw error;
    const { data } = await supabase.storage.from(SEMINAR_BUCKET).createSignedUrl(path, 3600);
    return NextResponse.json({ path, preview_url: data?.signedUrl || "" });
  } catch (error) {
    return NextResponse.json({ error: error.message || "アップロードに失敗しました。" }, { status: error.status || 500 });
  }
}

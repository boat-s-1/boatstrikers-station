import { NextResponse } from "next/server";
import { isScheduleAdminAuthenticated } from "../../../../admin/schedule/_lib/scheduleAdminAuth";
import { getAdminScheduleSupabase } from "../../../../../lib/scheduleSupabase";

export const dynamic = "force-dynamic";

const BUCKET = "result-images";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 8 * 1024 * 1024;

function safeExt(file) {
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byType[file.type] || "jpg";
}

export async function POST(request) {
  if (!(await isScheduleAdminAuthenticated())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "画像を選択してください" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "JPG・PNG・WebPのみアップロードできます" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "画像は8MB以下にしてください" }, { status: 400 });
    }

    const supabase = getAdminScheduleSupabase();
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const ext = safeExt(file);
    const filename = `${crypto.randomUUID()}.${ext}`;
    const path = `${y}/${m}/${d}/${filename}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "3600" });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("画像URLを取得できませんでした");

    return NextResponse.json({ url: data.publicUrl, path });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "画像アップロードに失敗しました" }, { status: 500 });
  }
}

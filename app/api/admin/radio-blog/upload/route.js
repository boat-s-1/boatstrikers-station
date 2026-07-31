import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../lib/supabaseRadioAdmin";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request) {
  try {
    await requireRadioBlogAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "画像を選択してください。" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "JPEG・PNG・WebP・GIFのみアップロードできます。" },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "画像は8MB以下にしてください。" },
        { status: 400 }
      );
    }

    const extension = EXTENSIONS[file.type];
    const dateFolder = new Date().toISOString().slice(0, 10);
    const path = `${dateFolder}/${crypto.randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const supabase = getRadioAdminSupabase();
    const { error } = await supabase.storage
      .from("radio-blog-images")
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("radio-blog-images")
      .getPublicUrl(path);

    return NextResponse.json({
      url: data.publicUrl,
      path,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "アップロードに失敗しました。" },
      { status: error.status || 500 }
    );
  }
}

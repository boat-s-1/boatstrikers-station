import { NextResponse } from "next/server";
import {
  assertAiAdmin,
  getSupabaseAdmin,
} from "../_shared.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_JOB_TYPES = new Set([
  "history_import",
  "previous_day_prediction",
  "after_exhibition_prediction",
  "full_pipeline",
]);

function safeFilename(filename) {
  return filename
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(-180);
}

export async function POST(request) {
  try {
    assertAiAdmin(request);

    const body = await request.json();
    const jobType = String(body.jobType || "");
    const raceDate = String(body.raceDate || "") || null;
    const filename = safeFilename(
      String(body.filename || "upload.csv"),
    );

    if (!ALLOWED_JOB_TYPES.has(jobType)) {
      return NextResponse.json(
        { error: "未対応の処理種類です" },
        { status: 400 },
      );
    }

    if (!filename.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "CSV形式のみアップロードできます" },
        { status: 400 },
      );
    }

    const datePart = raceDate || "history";
    const storagePath = `${jobType}/${datePart}/${Date.now()}-${filename}`;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from("bsc-ai-csv")
      .createSignedUploadUrl(storagePath);

    if (error) throw error;

    return NextResponse.json({
      bucket: "bsc-ai-csv",
      storagePath,
      token: data.token,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "アップロード情報の作成に失敗しました",
      },
      { status: error?.status || 500 },
    );
  }
}

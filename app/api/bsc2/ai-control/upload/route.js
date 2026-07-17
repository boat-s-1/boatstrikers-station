import { NextResponse } from "next/server";
import { assertAiAdmin, getSupabaseAdmin } from "../_shared";

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

    const formData = await request.formData();
    const file = formData.get("file");
    const jobType = String(formData.get("jobType") || "");
    const raceDate = String(formData.get("raceDate") || "") || null;
    const runCalibration =
      String(formData.get("runCalibration") || "true") === "true";
    const runDiagnosis =
      String(formData.get("runDiagnosis") || "true") === "true";

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "CSVファイルが必要です" },
        { status: 400 },
      );
    }

    if (!ALLOWED_JOB_TYPES.has(jobType)) {
      return NextResponse.json(
        { error: "未対応の処理種類です" },
        { status: 400 },
      );
    }

    const lowerName = String(file.name || "").toLowerCase();

    if (!lowerName.endsWith(".csv")) {
      return NextResponse.json(
        { error: "CSV形式のみアップロードできます" },
        { status: 400 },
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "CSVは50MB以下にしてください" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const timestamp = Date.now();
    const filename = safeFilename(file.name || "upload.csv");
    const datePart = raceDate || "history";
    const storagePath = `${jobType}/${datePart}/${timestamp}-${filename}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("bsc-ai-csv")
      .upload(storagePath, bytes, {
        contentType: file.type || "text/csv",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: job, error: jobError } = await supabase
      .from("ai_control_jobs")
      .insert({
        job_type: jobType,
        status: "queued",
        source_filename: file.name,
        storage_bucket: "bsc-ai-csv",
        storage_path: storagePath,
        race_date: raceDate,
        options: {
          run_calibration: runCalibration,
          run_diagnosis: runDiagnosis,
        },
        progress_percent: 0,
        progress_message: "Workerの実行待ちです",
      })
      .select("*")
      .single();

    if (jobError) {
      await supabase.storage.from("bsc-ai-csv").remove([storagePath]);
      throw jobError;
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "アップロードに失敗しました" },
      { status: error?.status || 500 },
    );
  }
}

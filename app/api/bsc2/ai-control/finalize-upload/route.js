import { NextResponse } from "next/server";
import { assertAiAdmin, getSupabaseAdmin } from "../_shared.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "history_import",
  "previous_day_prediction",
  "after_exhibition_prediction",
  "full_pipeline",
]);

export async function POST(request) {
  try {
    assertAiAdmin(request);
    const body = await request.json();
    const jobType = String(body.jobType || "");
    const raceDate = String(body.raceDate || "") || null;
    const sourceFilename = String(body.sourceFilename || "upload.csv");
    const storagePath = String(body.storagePath || "");

    if (!ALLOWED.has(jobType)) {
      return NextResponse.json({ error: "未対応の処理種類です" }, { status: 400 });
    }
    if (!storagePath) {
      return NextResponse.json({ error: "storagePathが必要です" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: job, error } = await supabase
      .from("ai_control_jobs")
      .insert({
        job_type: jobType,
        status: "queued",
        source_filename: sourceFilename,
        storage_bucket: "bsc-ai-csv",
        storage_path: storagePath,
        race_date: raceDate,
        options: {
          run_calibration: body.runCalibration !== false,
          run_diagnosis: body.runDiagnosis !== false,
          run_notification: body.runNotification === true,
        },
        progress_percent: 0,
        progress_message: "Workerの実行待ちです",
        current_stage: "queued",
        stage_index: 0,
        stage_total: jobType === "history_import" ? 2 : 7,
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("ai_job_events").insert({
      job_id: job.id,
      event_type: "queued",
      stage_code: "queued",
      level: "info",
      message: "CSVアップロード完了・実行待ちへ登録",
    });

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "ジョブ登録に失敗しました" },
      { status: error?.status || 500 },
    );
  }
}

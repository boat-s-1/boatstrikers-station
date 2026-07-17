import { NextResponse } from "next/server";
import { assertAiAdmin, getSupabaseAdmin } from "../_shared.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    assertAiAdmin(request);
    const body = await request.json();
    const jobId = String(body.jobId || "");
    const action = String(body.action || "");
    if (!jobId) return NextResponse.json({ error: "jobIdが必要です" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from("ai_control_jobs").select("*").eq("id", jobId).single();
    if (readError) throw readError;

    let values;
    let message;
    if (action === "retry") {
      values = {
        status: "queued", worker_name: null, claimed_at: null, started_at: null,
        completed_at: null, progress_percent: 0, progress_message: "再実行待ちです",
        error_message: null, current_stage: "queued", stage_index: 0,
        cancel_requested: false,
      };
      message = "再実行待ちへ戻しました";
    } else if (action === "cancel") {
      if (current.status === "running") {
        values = { cancel_requested: true, progress_message: "キャンセル要求を送信しました" };
        message = "Workerへキャンセル要求を送信しました";
      } else {
        values = { status: "cancelled", completed_at: new Date().toISOString(), current_stage: "cancelled", progress_message: "キャンセルしました" };
        message = "キャンセルしました";
      }
    } else if (action === "delete") {
      const { error: deleteError } = await supabase.from("ai_control_jobs").delete().eq("id", jobId);
      if (deleteError) throw deleteError;
      return NextResponse.json({ ok: true, message: "ジョブを削除しました" });
    } else {
      return NextResponse.json({ error: "未対応の操作です" }, { status: 400 });
    }

    const { data: job, error } = await supabase.from("ai_control_jobs").update(values).eq("id", jobId).select("*").single();
    if (error) throw error;
    await supabase.from("ai_job_events").insert({
      job_id: jobId, event_type: action, stage_code: job.current_stage || action,
      level: "info", message,
    });
    return NextResponse.json({ ok: true, message, job });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "ジョブ操作に失敗しました" },
      { status: error?.status || 500 },
    );
  }
}

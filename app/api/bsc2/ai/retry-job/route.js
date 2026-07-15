import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    assertAiAdminRequest(request);
    const body = await request.json();
    const jobId = String(body?.job_id || "");

    if (!jobId) {
      return NextResponse.json({ error: "job_idが必要です" }, { status: 400 });
    }

    const supabase = getAiAdminSupabase();
    const { data: oldJob, error: readError } = await supabase
      .from("ai_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (readError) throw readError;

    const { data: newJob, error: insertError } = await supabase
      .from("ai_jobs")
      .insert({
        job_type: oldJob.job_type,
        status: "pending",
        progress: 0,
        file_id: oldJob.file_id,
        parameters: oldJob.parameters || {},
        requested_by: "bsc-ai-retry",
        message: "再実行待ち",
        retry_of_job_id: oldJob.id,
        retry_count: Number(oldJob.retry_count || 0) + 1,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (oldJob.file_id) {
      await supabase
        .from("ai_uploaded_files")
        .update({ status: "uploaded", error_message: null })
        .eq("id", oldJob.file_id);
    }

    return NextResponse.json({ job: newJob });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "再実行登録に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}

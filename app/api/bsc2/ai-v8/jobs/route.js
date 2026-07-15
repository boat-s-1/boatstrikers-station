
import { NextResponse } from "next/server";
import { assertAiAdminRequest, getAiAdminSupabase } from "../../../../../lib/aiAdminSupabase";

const ALLOWED = new Set([
  "train_ichika_v3",
  "train_hatsune_v1",
  "train_kiina_v1",
  "train_all_characters",
  "predict_all_characters",
  "generate_ensemble",
  "run_product_daily",
]);

export async function POST(request) {
  try {
    assertAiAdminRequest(request);
    const body = await request.json();
    const jobType = String(body?.job_type || "");
    if (!ALLOWED.has(jobType)) {
      return NextResponse.json({ error: "許可されていないジョブです" }, { status: 400 });
    }
    const supabase = getAiAdminSupabase();
    const { data, error } = await supabase.from("ai_jobs").insert({
      job_type: jobType,
      status: "pending",
      progress: 0,
      requested_by: "bsc-ai-v8",
      message: "実行待ち",
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ job: data });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "登録に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}

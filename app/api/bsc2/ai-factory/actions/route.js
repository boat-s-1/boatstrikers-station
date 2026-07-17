import { NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin } from "../_shared.js";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const action = String(body.action || "");
    const modelId = body.modelId ? String(body.modelId) : null;
    const jobId = body.jobId ? String(body.jobId) : null;
    const supabase = getSupabaseAdmin();

    if (action === "activate") {
      if (!modelId) return NextResponse.json({error:"modelIdが必要です"},{status:400});
      const {data,error} = await supabase.from("ai_factory_jobs").insert({
        job_type:"activate",status:"queued",target_model_id:modelId,
        progress_percent:0,progress_message:"モデル採用待ちです"
      }).select("*").single();
      if(error) throw error;
      return NextResponse.json({job:data});
    }

    if (action === "archive") {
      if (!modelId) return NextResponse.json({error:"modelIdが必要です"},{status:400});
      const {data,error} = await supabase.from("ai_factory_jobs").insert({
        job_type:"archive",status:"queued",target_model_id:modelId,
        progress_percent:0,progress_message:"アーカイブ待ちです"
      }).select("*").single();
      if(error) throw error;
      return NextResponse.json({job:data});
    }

    if (action === "retry") {
      if (!jobId) return NextResponse.json({error:"jobIdが必要です"},{status:400});
      const {data,error} = await supabase.from("ai_factory_jobs").update({
        status:"queued",worker_name:null,claimed_at:null,started_at:null,completed_at:null,
        progress_percent:0,progress_message:"再実行待ちです",error_message:null
      }).eq("id",jobId).select("*").single();
      if(error) throw error;
      return NextResponse.json({job:data});
    }

    return NextResponse.json({error:"未対応のactionです"},{status:400});
  } catch(error) {
    return NextResponse.json({error:error.message||"操作に失敗しました"},{status:error.status||500});
  }
}

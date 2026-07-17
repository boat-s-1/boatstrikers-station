import { NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin } from "../_shared.js";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAdmin(request);
    const supabase = getSupabaseAdmin();
    const [{data:jobs,error:jobsError},{data:summary,error:summaryError}] = await Promise.all([
      supabase.from("ai_factory_jobs").select("*").order("created_at",{ascending:false}).limit(50),
      supabase.from("v_ai_factory_summary").select("*").single()
    ]);
    if (jobsError) throw jobsError;
    if (summaryError) throw summaryError;
    return NextResponse.json({jobs:jobs||[],summary:summary||null});
  } catch(error) {
    return NextResponse.json({error:error.message||"ジョブ取得に失敗しました"},{status:error.status||500});
  }
}

export async function POST(request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const character = String(body.characterCode || "");
    const timing = String(body.dataTiming || "");
    if (!["ichika","hatsune","kiina"].includes(character)) {
      return NextResponse.json({error:"characterCodeが不正です"},{status:400});
    }
    if (!["previous_day","after_exhibition"].includes(timing)) {
      return NextResponse.json({error:"dataTimingが不正です"},{status:400});
    }
    const {data,error} = await getSupabaseAdmin().from("ai_factory_jobs").insert({
      job_type:"train",
      status:"queued",
      character_code:character,
      data_timing:timing,
      options:{
        force:Boolean(body.force),
        notes:String(body.notes||""),
        compare_active:body.compareActive !== false
      },
      progress_percent:0,
      progress_message:"学習実行待ちです"
    }).select("*").single();
    if(error) throw error;
    return NextResponse.json({job:data});
  } catch(error) {
    return NextResponse.json({error:error.message||"学習ジョブ登録に失敗しました"},{status:error.status||500});
  }
}

import { NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin } from "../_shared.js";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAdmin(request);
    const supabase = getSupabaseAdmin();
    const [{data:workers,error:workerError},{data:events,error:eventError}] = await Promise.all([
      supabase.from("v_ai_factory_worker_health").select("*").order("heartbeat_at",{ascending:false}),
      supabase.from("ai_factory_events").select("*").order("created_at",{ascending:false}).limit(30)
    ]);
    if(workerError) throw workerError;
    if(eventError) throw eventError;
    return NextResponse.json({workers:workers||[],events:events||[]});
  } catch(error) {
    return NextResponse.json({error:error.message||"状態取得に失敗しました"},{status:error.status||500});
  }
}

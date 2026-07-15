import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAiAdminRequest(request);
    const supabase = getAiAdminSupabase();
    const { data, error } = await supabase
      .from("ai_system_status")
      .select("*")
      .eq("id", "main")
      .maybeSingle();

    if (error) throw error;

    const last = data?.last_heartbeat_at
      ? new Date(data.last_heartbeat_at).getTime()
      : 0;

    return NextResponse.json({
      ...data,
      effective_online:
        Boolean(data?.worker_online) && Date.now() - last < 60000,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "状態確認に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}

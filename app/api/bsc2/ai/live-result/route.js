import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    assertAiAdminRequest(request);

    const body = await request.json();

    const upcomingRaceId = Number(body?.upcoming_race_id);
    const winnerBoatNo =
      body?.winner_boat_no === "" ||
      body?.winner_boat_no === null ||
      body?.winner_boat_no === undefined
        ? null
        : Number(body.winner_boat_no);

    if (!Number.isInteger(upcomingRaceId)) {
      return NextResponse.json(
        { error: "upcoming_race_idが不正です" },
        { status: 400 }
      );
    }

    if (
      winnerBoatNo !== null &&
      (!Number.isInteger(winnerBoatNo) ||
        winnerBoatNo < 1 ||
        winnerBoatNo > 6)
    ) {
      return NextResponse.json(
        { error: "1着艇は1～6で入力してください" },
        { status: 400 }
      );
    }

    const escapeSuccess =
      winnerBoatNo === null ? null : winnerBoatNo === 1;

    const supabase = getAiAdminSupabase();

    const { data, error } = await supabase
      .from("ai_live_results")
      .upsert(
        {
          upcoming_race_id: upcomingRaceId,
          boat1_first: escapeSuccess,
          escape_success: escapeSuccess,
          winner_boat_no: winnerBoatNo,
          finish_order: body?.finish_order || null,
          payout_3t:
            body?.payout_3t === "" ||
            body?.payout_3t === null ||
            body?.payout_3t === undefined
              ? null
              : Number(body.payout_3t),
          memo: body?.memo || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "upcoming_race_id",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ result: data });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "結果登録に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}

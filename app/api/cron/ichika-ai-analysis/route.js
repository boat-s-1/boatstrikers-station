import { NextResponse } from "next/server";
import {
  jstYesterdayString,
  refreshIchikaAiAnalysis,
} from "../../../../lib/ichikaAiDailyAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || jstYesterdayString();
    const windowDays = Number(url.searchParams.get("window_days") || 30);

    const result = await refreshIchikaAiAnalysis({
      date,
      windowDays,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { collectMorningGeminiNews } from "../../../../lib/morningGeminiNewsCollector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await collectMorningGeminiNews({ limit: 12 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { generateMissingMediaEditorials } from "../../../../lib/mediaEditorialAuto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateMissingMediaEditorials({ limit: 3, scanLimit: 24 });
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}

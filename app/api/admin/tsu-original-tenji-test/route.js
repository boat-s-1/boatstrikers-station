import { NextResponse } from "next/server";
import { fetchTsuOfficialOriginalTenji } from "../../../../lib/tsuOfficialOriginalTenji";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raceNo = Math.min(12, Math.max(1, Number(searchParams.get("race") || 12)));
  const result = await fetchTsuOfficialOriginalTenji({ raceDate: jstToday(), courseCode: 9, raceNo }, { timeoutMs: 7000 });
  return NextResponse.json({ ok: result.ok, raceNo, source: result.source, status: result.status ?? null, error: result.error ?? null, url: result.url ?? null, rows: result.rows || [], ranAt: new Date().toISOString() });
}

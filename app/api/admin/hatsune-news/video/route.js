import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";
import { generateHatsuneVideoDraft } from "../../../../../lib/hatsuneNewsVideoAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!['daily_short', 'weekly_news'].includes(body?.videoType)) {
      return NextResponse.json({ ok: false, error: "videoType is invalid" }, { status: 400 });
    }
    const item = await generateHatsuneVideoDraft(body);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}

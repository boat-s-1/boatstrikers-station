import { NextResponse } from 'next/server';
import { dispatchPreviousDayCollector } from '../../../lib/trinityGitHubDispatch.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await dispatchPreviousDayCollector({ token: process.env.TRINITY_GITHUB_DISPATCH_TOKEN });
    if (result.status !== 'dispatched') {
      console.error('[trinity-previous-day-dispatch] scheduled call arrived outside 21:00–23:59 JST');
      return NextResponse.json({ ok: false, ...result }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[trinity-previous-day-dispatch]', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }
}

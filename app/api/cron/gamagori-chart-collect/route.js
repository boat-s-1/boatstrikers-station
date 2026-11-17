import {createIsolatedGamagoriClient} from '../../../../lib/gamagori-environment.mjs';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { collectCharts } from '../../../../lib/gamagori-chart-collector.mjs';
import { withGamagoriLease } from '../../../../lib/gamagori-chart-lease.mjs';
import { parseGamagoriChart } from '../../../../lib/gamagori-chart-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.GAMAGORI_COLLECTOR_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const limit = Number(url.searchParams.get('limit') || 3);
  const first = Number(url.searchParams.get('race') || 1);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date || '') ||
      Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
      !Number.isInteger(limit) || limit < 1 || limit > 3 || !Number.isInteger(first) || first < 1 || first > 12) {
    return NextResponse.json({ error: 'valid date (YYYY-MM-DD) and race (1-12) required' }, { status: 400 });
  }
  try {
    const db=await createIsolatedGamagoriClient(createClient);
    const leased = await withGamagoriLease(db, () => collectCharts({ db, parse: parseGamagoriChart, date, first, limit }));
    if (leased.busy) {
      console.info('gamagori_chart_collect', JSON.stringify({ date, status: 'collector_busy' }));
      return NextResponse.json({ error: 'collector_busy' }, { status: 409, headers: { 'Retry-After': '120' } });
    }
    const result = leased.value;
    console.info('gamagori_chart_collect', JSON.stringify(result));
    return NextResponse.json(result, { status: result.results.some(x => ['failed', 'blocked_partial_existing'].includes(x.status)) ? 207 : 200 });
  } catch {
    console.error('gamagori_chart_collect', JSON.stringify({ date, status: 'database_lookup_failed' }));
    return NextResponse.json({ error: 'database_lookup_failed' }, { status: 502 });
  }
}

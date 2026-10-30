import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseGamagoriChart } from '../../../../lib/gamagori-chart-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COURSE_CODE = 7;
const MAX_RACES = 3;
const timeoutMs = 8000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const first = Number(url.searchParams.get('race') || 1);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date || '') ||
      Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
      !Number.isInteger(first) || first < 1 || first > 12) {
    return NextResponse.json({ error: 'valid date (YYYY-MM-DD) and race (1-12) required' }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'database configuration missing' }, { status: 503 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const end = Math.min(12, first + MAX_RACES - 1);
  const { data: events, error: eventError } = await db.from('bs_race_events')
    .select('race_no').eq('race_date', date).eq('course_code', COURSE_CODE)
    .gte('race_no', first).lte('race_no', end);
  if (eventError) return NextResponse.json({ error: 'event lookup failed' }, { status: 502 });
  const validRaces = new Set((events || []).map(x => Number(x.race_no)));
  const results = [];
  for (let race = first; race <= end; race++) {
    if (!validRaces.has(race)) {
      results.push({ race, status: 'skipped_no_event' });
      continue;
    }
    const source = `https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend${date.replaceAll('-', '')}07${String(race).padStart(2, '0')}.htm`;
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'BoatStrikers chart research collector (contact via boat-strike.online)' },
        cache: 'no-store' });
      if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
      const html = await response.text();
      if (html.length > 400000) throw new Error('upstream document too large');
      const marks = parseGamagoriChart(html);
      const rows = marks.map(mark => ({
        race_date: date, race_no: race, ...mark, source_url: source,
      }));
      const { error } = await db.from('bsc_gamagori_chart_ratings')
        .upsert(rows, { onConflict: 'race_date,race_no,boat_no', ignoreDuplicates: true });
      if (error) throw new Error('database insert failed');
      results.push({ race, status: 'saved_or_existing', boats: rows.length });
    } catch (error) {
      results.push({ race, status: 'failed', reason: String(error.message).slice(0, 140) });
    }
    if (race < end) await sleep(1200);
  }
  console.info('gamagori_chart_collect', JSON.stringify({ date, results }));
  return NextResponse.json({ date, results });
}

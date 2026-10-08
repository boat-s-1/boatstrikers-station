import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function nextWeeklyRunJst(now = new Date()) {
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const next = new Date(jstNow);
  const day = next.getUTCDay();
  let days = (1 - day + 7) % 7;
  if (days === 0 && next.getUTCHours() >= 4) days = 7;
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(4, 0, 0, 0);
  return new Date(next.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  try {
    const db = getSupabase();
    const [{ data: status, error: statusError }, { data: snapshots, error: snapshotError }, { data: runs, error: runError }] = await Promise.all([
      db.rpc('bs_engine_v3_status'),
      db.from('stadium_data_snapshots').select('course_code,period_start,period_end,generated_at').order('course_code'),
      db.from('boatstrikers_engine_v3_runs')
        .select('id,run_type,course_code,as_of_date,success,race_count,message,started_at,finished_at')
        .order('id', { ascending: false })
        .limit(250),
    ]);
    if (statusError) throw statusError;
    if (snapshotError) throw snapshotError;
    if (runError) throw runError;

    const latestByCourse = new Map();
    for (const run of runs || []) {
      const code = Number(run.course_code);
      if (run.run_type === 'single' && code >= 1 && code <= 24 && !latestByCourse.has(code)) latestByCourse.set(code, run);
    }

    const snapshotByCourse = new Map((snapshots || []).map(row => [Number(row.course_code), row]));
    const stadiums = Array.from({ length: 24 }, (_, index) => {
      const code = index + 1;
      const run = latestByCourse.get(code) || null;
      const snapshot = snapshotByCourse.get(code) || null;
      return {
        course_code: code,
        success: run ? Boolean(run.success) : Boolean(snapshot),
        as_of_date: run?.as_of_date || snapshot?.period_end || null,
        race_count: run?.race_count ?? null,
        message: run?.message || null,
        finished_at: run?.finished_at || snapshot?.generated_at || null,
        generated_at: snapshot?.generated_at || null,
      };
    });

    const successCount = stadiums.filter(row => row.success).length;
    const failedCount = stadiums.filter(row => !row.success).length;
    const latestAllRun = (runs || []).find(run => run.run_type === 'all') || null;
    const latestSuccessfulFinish = stadiums
      .filter(row => row.success && row.finished_at)
      .map(row => new Date(row.finished_at).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];

    const batchDates = stadiums.map(row => row.as_of_date).filter(Boolean);
    const latestBatchDate = batchDates.length ? batchDates.sort().at(-1) : null;

    return NextResponse.json({
      ok: true,
      status,
      weekly: {
        schedule_label: '毎週月曜 4:00 JST',
        next_run_at: nextWeeklyRunJst(),
        latest_all_run: latestAllRun,
        latest_batch_date: latestBatchDate,
        latest_success_at: latestSuccessfulFinish ? new Date(latestSuccessfulFinish).toISOString() : null,
        success_count: successCount,
        failed_count: failedCount,
        stadiums,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || '状態確認に失敗しました。' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const asOf = body.asOf || new Date().toISOString().slice(0, 10);
    const db = getSupabase();

    if (body.scope === 'all') {
      const { data, error } = await db.rpc('bs_engine_v3_refresh_all', { p_as_of: asOf });
      if (error) throw error;
      return NextResponse.json({ ok: true, scope: 'all', rows: data });
    }

    const code = Number(body.courseCode || 1);
    if (!Number.isInteger(code) || code < 1 || code > 24) {
      return NextResponse.json({ ok: false, error: '場コードは1〜24で指定してください。' }, { status: 400 });
    }
    const { data, error } = await db.rpc('bs_engine_v3_refresh_stadium', {
      p_course_code: code,
      p_as_of: asOf,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, scope: 'single', result: data });
  } catch (error) {
    console.error('engine v3 refresh error', error);
    return NextResponse.json({ ok: false, error: error?.message || '再集計に失敗しました。' }, { status: 500 });
  }
}
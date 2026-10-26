import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminError, adminServerError, guardAdminWrite, intInRange, jstToday, readJsonBody, validDateInRange } from '../../../../../lib/adminApiGuard.js';
import { acquireAdminJobLock, releaseAdminJobLock } from '../../../../../lib/adminJobLock.js';

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

// 書き込み（再集計）の制限。基準日は JST の今日から7日前まで、全場は30分に1回、1場は同じ場で60秒に1回
const AS_OF_DAYS_BACK = 7;
const ALL_COOLDOWN_SECONDS = 30 * 60;
const SINGLE_COOLDOWN_SECONDS = 60;
// ロックの期限：1場は実績最大74秒に対して15分。全場は実績最大約22分（1328秒）に対して40分
const SINGLE_LOCK_TTL_SECONDS = 15 * 60;
const ALL_LOCK_TTL_SECONDS = 40 * 60;

export async function POST(request) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body) return adminError(400, 'リクエストの形式が不正です。');
  const scope = body.scope;
  if (scope !== 'all' && scope !== 'single') return adminError(400, 'scope は all か single を指定してください。');
  const asOf = body.asOf ?? jstToday();
  if (!validDateInRange(asOf, { daysBack: AS_OF_DAYS_BACK })) return adminError(400, `基準日は今日から${AS_OF_DAYS_BACK}日前までの日付で指定してください。`);
  const code = scope === 'single' ? body.courseCode : null;
  if (scope === 'single' && !intInRange(code, 1, 24)) return adminError(400, '場コードは1〜24で指定してください。');

  let db;
  let lock;
  try {
    db = getSupabase();

    // 直近の成功した実行より古い基準日で上書きしない（意図して戻すときは allowOlder: true）
    let latest = db.from('boatstrikers_engine_v3_runs').select('as_of_date,finished_at,success').eq('run_type', scope).order('id', { ascending: false }).limit(20);
    if (scope === 'single') latest = latest.eq('course_code', code);
    const { data: runs, error: runError } = await latest;
    if (runError) throw runError;
    const lastSuccess = (runs || []).find((run) => run.success);
    if (lastSuccess?.as_of_date && asOf < lastSuccess.as_of_date && body.allowOlder !== true) {
      return adminError(409, `最新の集計（基準日 ${lastSuccess.as_of_date}）より古い基準日です。戻す場合は確認のうえ allowOlder を指定してください。`);
    }
    const cooldown = scope === 'all' ? ALL_COOLDOWN_SECONDS : SINGLE_COOLDOWN_SECONDS;
    const lastFinished = runs?.[0]?.finished_at ? new Date(runs[0].finished_at).getTime() : 0;
    if (Date.now() - lastFinished < cooldown * 1000) return adminError(429, '直前に再集計したばかりです。しばらくしてから実行してください。');

    lock = await acquireAdminJobLock(db, 'engine-v3-refresh', { ttlSeconds: scope === 'all' ? ALL_LOCK_TTL_SECONDS : SINGLE_LOCK_TTL_SECONDS });
    if (!lock.ok) {
      if (lock.reason === 'error') throw lock.error;
      return adminError(409, '別の再集計が実行中です。終わってから実行してください。');
    }

    if (scope === 'all') {
      const { data, error } = await db.rpc('bs_engine_v3_refresh_all', { p_as_of: asOf });
      if (error) throw error;
      await releaseAdminJobLock(db, lock, { cooldownSeconds: ALL_COOLDOWN_SECONDS });
      return NextResponse.json({ ok: true, scope: 'all', rows: data });
    }

    const { data, error } = await db.rpc('bs_engine_v3_refresh_stadium', {
      p_course_code: code,
      p_as_of: asOf,
    });
    if (error) throw error;
    await releaseAdminJobLock(db, lock, { cooldownSeconds: SINGLE_COOLDOWN_SECONDS });
    return NextResponse.json({ ok: true, scope: 'single', result: data });
  } catch (error) {
    if (lock?.ok) await releaseAdminJobLock(db, lock).catch(() => {});
    return adminServerError('engine-v3-refresh', error);
  }
}

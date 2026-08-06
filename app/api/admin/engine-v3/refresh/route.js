import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    const db = getSupabase();
    const { data, error } = await db.rpc('bs_engine_v3_status');
    if (error) throw error;
    return NextResponse.json({ ok: true, status: data }, { headers: { 'Cache-Control': 'no-store' } });
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

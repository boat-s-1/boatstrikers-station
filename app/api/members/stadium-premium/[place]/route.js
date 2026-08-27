import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveStadium } from '../../../../../lib/stadiums';
import { GET as getTodayStadium } from '../../../stadium/today/[place]/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase環境変数が未設定です。');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request, { params }) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      return NextResponse.json({ ok: false, error: '会員ログインが必要です。' }, { status: 401 });
    }

    const db = adminClient();
    const { data: { user }, error: userError } = await db.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'ログイン情報が無効です。もう一度ログインしてください。' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await db
      .from('bs_member_profiles')
      .select('plan,membership_status,beta_member')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.membership_status !== 'active') {
      return NextResponse.json({ ok: false, error: '有効なBoatStrikers会員のみ閲覧できます。' }, { status: 403 });
    }

    const route = await params;
    const stadium = resolveStadium(route.place);
    if (!stadium) {
      return NextResponse.json({ ok: false, error: '場コードが見つかりません。' }, { status: 404 });
    }

    const { data: snapshot, error: snapshotError } = await db
      .from('stadium_data_snapshots')
      .select('payload,generated_at,period_start,period_end')
      .eq('course_code', stadium.courseCode)
      .maybeSingle();
    if (snapshotError) throw snapshotError;

    const payload = snapshot?.payload || {};
    let today = null;
    try {
      const todayResponse = await getTodayStadium(request, { params: Promise.resolve({ place: route.place }) });
      today = await todayResponse.json();
    } catch (todayError) {
      console.error('member stadium premium today error', todayError);
    }

    return NextResponse.json({
      ok: true,
      member: {
        plan: profile.plan || 'beta_premium',
        betaMember: Boolean(profile.beta_member),
      },
      stadium: {
        courseCode: stadium.courseCode,
        name: stadium.name,
        place: stadium.place,
      },
      premium: {
        insideStrategy: payload.inside_strategy || null,
        upsetStrategy: payload.upset_strategy || null,
        exhibitionReliability: payload.exhibition_reliability || null,
        aiProfile: payload.ai_profile || null,
        aggregationFrom: payload.aggregation_from || snapshot?.period_start || null,
        aggregationTo: payload.aggregation_to || snapshot?.period_end || null,
        generatedAt: snapshot?.generated_at || null,
      },
      today,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('member stadium premium api error', error);
    return NextResponse.json({ ok: false, error: 'Premiumデータを取得できませんでした。' }, { status: 500 });
  }
}

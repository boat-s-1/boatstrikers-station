import { NextResponse } from 'next/server';
import { resolveStadium } from '../../../../../lib/stadiums';
import { getMemberAdminClient, requireMemberEntitlementFromRequest } from '../../../../../lib/memberEntitlement';
import { GET as getTodayStadium } from '../../../stadium/today/[place]/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  try {
    const access = await requireMemberEntitlementFromRequest(request, { level: 'premium' });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }

    const db = getMemberAdminClient();
    const profile = access.entitlement.profile;
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
        plan: access.entitlement.plan,
        betaMember: Boolean(profile?.beta_member),
        betaOpen: access.entitlement.betaOpen,
        premium: access.entitlement.premium,
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

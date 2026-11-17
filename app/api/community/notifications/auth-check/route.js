import { NextResponse } from 'next/server';
import { loadVerifiedNotificationMember } from '../../../../lib/community/notificationMemberServer';
import { notificationAuthProbe } from '../../../../lib/community/notificationAuthProbe.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Read-only endpoint: returns a boolean only, never a token, user ID,
// membership record, subscription, or notification content.
export async function GET(request) {
  const result = await notificationAuthProbe(
    request.headers.get('authorization'),
    loadVerifiedNotificationMember
  );
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

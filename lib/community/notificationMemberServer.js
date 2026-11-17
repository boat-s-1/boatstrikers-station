import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { verifyNotificationAccessToken } from './notificationAuthServer';

// Authentication and profile retrieval must use the SAME user bearer token.
// The anon key is public; Supabase RLS must independently enforce self-SELECT.
// No service_role key, admin claim or browser-supplied trusted flag is used.
export async function loadVerifiedNotificationMember(token) {
  const identity = await verifyNotificationAccessToken(token);
  if (!identity) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.from('bs_member_profiles')
      .select('user_id,membership_status,withdrawn_at')
      .eq('user_id', identity.userId)
      .maybeSingle();
    if (error || !data || data.user_id !== identity.userId) return null;
    // A server-produced provenance marker, never taken from request JSON.
    return Object.freeze({
      identity,
      profile: Object.freeze({ ...data, verifiedByTrustedServer: true }),
    });
  } catch {
    return null;
  }
}

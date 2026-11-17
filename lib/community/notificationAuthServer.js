import 'server-only';
import { createClient } from '@supabase/supabase-js';

// This is only identity verification. It does NOT establish an active member
// profile, billing entitlement, or notification authorization.
const MAX_TOKEN_LENGTH = 8192;
export async function verifyNotificationAccessToken(token) {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH ||
      !/^[A-Za-z0-9_.-]+$/.test(token)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // getUser(token) asks Supabase Auth to validate the token; never use
    // getSession() or locally decoded JWT claims as proof of identity.
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user || typeof data.user.id !== 'string' ||
        data.user.is_anonymous === true) return null;
    return Object.freeze({ userId: data.user.id, verifiedByAuthServer: true });
  } catch {
    return null;
  }
}

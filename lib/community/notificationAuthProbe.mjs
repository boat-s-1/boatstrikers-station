import { extractNotificationBearerToken } from './notificationBearer.mjs';
import { verifiedNotificationMembership } from './notificationMembership.mjs';
import { verifiedNotificationPrincipal } from './notificationPrincipal.mjs';

// Pure handler for a read-only auth probe. The server route supplies a
// server-only member loader; this module must never receive request JSON claims.
export async function notificationAuthProbe(authorization, loadMember) {
  const headers = { 'Cache-Control': 'no-store, private', 'Content-Type': 'application/json' };
  const token = extractNotificationBearerToken(authorization);
  if (!token) return { status: 401, headers, body: { authenticated: false } };
  if (typeof loadMember !== 'function') return { status: 503, headers, body: { available: false } };
  try {
    const member = await loadMember(token);
    const principal = verifiedNotificationPrincipal(
      verifiedNotificationMembership(member?.identity, member?.profile)
    );
    if (!principal) return { status: 401, headers, body: { authenticated: false } };
    return { status: 200, headers, body: { authenticated: true } };
  } catch {
    return { status: 503, headers, body: { available: false } };
  }
}

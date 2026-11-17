// Pure request identity checks for future notification API routes.
// NEVER trust a client-provided userId or an unverified decoded JWT.
// The caller must first validate the session with the authentication provider.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function verifiedNotificationPrincipal(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  if (session.verifiedByAuthServer !== true) return null;
  if (typeof session.userId !== 'string' || !UUID.test(session.userId)) return null;
  if (session.isAnonymous === true || session.withdrawn === true || session.blocked === true) return null;
  if (session.accountStatus !== 'active') return null;
  return Object.freeze({ userId: session.userId.toLowerCase() });
}

export function canReadNotificationForPrincipal(principal, row) {
  if (!principal || typeof principal.userId !== 'string' ||
      !row || typeof row !== 'object' || Array.isArray(row)) return false;
  return row.recipient_user_id === principal.userId && row.deleted_at == null &&
    row.authorized_by_server === true;
}

export function canAcknowledgeNotificationForPrincipal(principal, row, requestedId) {
  return canReadNotificationForPrincipal(principal, row) &&
    typeof requestedId === 'string' && requestedId.length > 0 &&
    row.id === requestedId;
}

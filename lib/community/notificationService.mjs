import { verifiedNotificationMembership } from './notificationMembership.mjs';
import { verifiedNotificationPrincipal, canAcknowledgeNotificationForPrincipal } from './notificationPrincipal.mjs';
import { visibleInboxItems, normalizeInboxPageSize } from './notificationInbox.mjs';

// Application orchestration for a future server-only API. Every dependency
// must be implemented server-side; no client-provided trusted flags are accepted.
// In particular, fetchProfile must return a verified trusted-server profile.
export async function listNotificationsForVerifiedIdentity(identity, deps, { limit = 20 } = {}) {
  if (!deps || typeof deps.fetchProfile !== 'function' || typeof deps.fetchInbox !== 'function') {
    return { ok: false, reason: 'unconfigured', items: [] };
  }
  if (!identity || identity.verifiedByAuthServer !== true) return { ok: false, reason: 'unauthorized', items: [] };
  try {
    const profile = await deps.fetchProfile(identity.userId);
    const member = verifiedNotificationMembership(identity, profile);
    const principal = verifiedNotificationPrincipal(member);
    if (!principal) return { ok: false, reason: 'unauthorized', items: [] };
    const pageSize = normalizeInboxPageSize(limit);
    const rows = await deps.fetchInbox(principal.userId, pageSize);
    if (!Array.isArray(rows)) return { ok: false, reason: 'unavailable', items: [] };
    return { ok: true, items: visibleInboxItems(rows, principal.userId, { limit: pageSize }) };
  } catch {
    return { ok: false, reason: 'unavailable', items: [] };
  }
}

export async function markNotificationReadForVerifiedIdentity(identity, notificationId, deps) {
  if (!deps || typeof deps.fetchProfile !== 'function' ||
      typeof deps.fetchNotification !== 'function' || typeof deps.markRead !== 'function') {
    return { ok: false, reason: 'unconfigured' };
  }
  if (!identity || identity.verifiedByAuthServer !== true) return { ok: false, reason: 'unauthorized' };
  if (typeof notificationId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(notificationId)) {
    return { ok: false, reason: 'invalid_id' };
  }
  try {
    const profile = await deps.fetchProfile(identity.userId);
    const principal = verifiedNotificationPrincipal(verifiedNotificationMembership(identity, profile));
    if (!principal) return { ok: false, reason: 'unauthorized' };
    const row = await deps.fetchNotification(principal.userId, notificationId);
    if (!canAcknowledgeNotificationForPrincipal(principal, row, notificationId)) {
      return { ok: false, reason: 'not_found' };
    }
    // markRead must be atomic and scoped by BOTH user ID and notification ID.
    const updated = await deps.markRead(principal.userId, notificationId);
    return updated === true ? { ok: true } : { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

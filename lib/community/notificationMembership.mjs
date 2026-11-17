// Pure, fail-closed gate for connecting a verified Auth identity to a trusted
// server-read membership record. Never accept membership data from a browser.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function verifiedNotificationMembership(identity, profile) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity) ||
      identity.verifiedByAuthServer !== true || typeof identity.userId !== 'string' ||
      !UUID.test(identity.userId)) return null;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) ||
      profile.verifiedByTrustedServer !== true || typeof profile.user_id !== 'string' ||
      profile.user_id.toLowerCase() !== identity.userId.toLowerCase()) return null;
  if (profile.withdrawn_at != null || profile.membership_status !== 'active') return null;
  // The profile's editable plan/beta_member/is_admin fields are NOT proof of
  // payment or elevated privileges. This gate proves only active membership.
  return Object.freeze({ userId: identity.userId.toLowerCase(), accountStatus: 'active',
    verifiedByAuthServer: true, isAnonymous: false, withdrawn: false, blocked: false });
}

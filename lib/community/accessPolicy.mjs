// Shared, pure policy model. Server-side database RLS remains authoritative.
// 'guest' includes signed-out visitors; 'free' and 'paid' require verified sessions.
export const AUDIENCES = Object.freeze({
  public: 'public',
  members: 'members',
  paid: 'paid',
});
export const REPLY_POLICIES = Object.freeze({
  paid: 'paid',
  disabled: 'disabled',
});
export const ACCESS_LEVELS = Object.freeze({ guest: 0, free: 1, paid: 2 });
export function canReadAudience(audience, accessLevel) {
  const minimum = { public: 0, members: 1, paid: 2 }[audience];
  const actual = ACCESS_LEVELS[accessLevel];
  return Number.isInteger(minimum) && Number.isInteger(actual) && actual >= minimum;
}
export function canReply({ audience, replyPolicy = 'paid', locked = false }, accessLevel) {
  return !locked && canReadAudience(audience, accessLevel) &&
    replyPolicy === 'paid' && accessLevel === 'paid';
}
export function isPublicAudience(audience) { return audience === AUDIENCES.public; }
// Never infer a paid role from editable user metadata or an unverified profile.
// The API/RLS must verify membership status and expiry against trusted server data.

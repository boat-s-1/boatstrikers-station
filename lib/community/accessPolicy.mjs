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
  const required = { public: 0, members: 1, paid: 2 };
  if (!Object.hasOwn(required, audience) || !Object.hasOwn(ACCESS_LEVELS, accessLevel)) return false;
  const minimum = required[audience];
  const actual = ACCESS_LEVELS[accessLevel];
  return Number.isInteger(minimum) && Number.isInteger(actual) && actual >= minimum;
}
export function canReply(thread, accessLevel) {
  if (!thread || typeof thread !== 'object') return false;
  const { audience, locked = false } = thread;
  // Database rows use reply_policy; client models may use replyPolicy.
  // If both are supplied they must agree; missing policies deny replies.
  if (thread.reply_policy !== undefined && thread.replyPolicy !== undefined &&
      thread.reply_policy !== thread.replyPolicy) return false;
  const replyPolicy = thread.reply_policy ?? thread.replyPolicy;
  return locked === false && canReadAudience(audience, accessLevel) &&
    replyPolicy === 'paid' && accessLevel === 'paid';
}
export function isPublicAudience(audience) { return audience === AUDIENCES.public; }
// Never infer a paid role from editable user metadata or an unverified profile.
// The API/RLS must verify membership status and expiry against trusted server data.

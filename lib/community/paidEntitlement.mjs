// This is a defensive eligibility gate, NOT a billing integration.
// Only a verified server-side billing entitlement may unlock paid features.
// Never accept the member profile's plan, beta_member, or client metadata as proof.
export function hasVerifiedPaidEntitlement(entitlement, now = new Date()) {
  if (!entitlement || typeof entitlement !== 'object' || Array.isArray(entitlement)) return false;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
  if (entitlement.source !== 'verified-billing-server') return false;
  if (entitlement.status !== 'active') return false;
  if (entitlement.verified !== true) return false;
  if (typeof entitlement.expiresAt !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z$/.test(entitlement.expiresAt)) return false;
  const expiry = Date.parse(entitlement.expiresAt);
  if (!Number.isFinite(expiry)) return false;
  // Date.parse can normalize invalid calendar dates (e.g. February 30).
  // Compare a canonical UTC round-trip to reject those silently adjusted dates.
  const canonical = entitlement.expiresAt.replace(/(?:\.([0-9]{1,3}))?Z$/, (_, fraction) => `.${(fraction ?? '').padEnd(3, '0')}Z`);
  return new Date(expiry).toISOString() === canonical && expiry > now.getTime();
}

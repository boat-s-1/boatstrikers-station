// Parse only an Authorization: Bearer header supplied to a future server API.
// This parser does not validate JWT signatures; use Supabase Auth getUser(token).
export function extractNotificationBearerToken(header) {
  if (typeof header !== 'string' || header.length > 8200) return null;
  const match = /^Bearer ([A-Za-z0-9_.-]{1,8192})$/i.exec(header);
  return match ? match[1] : null;
}

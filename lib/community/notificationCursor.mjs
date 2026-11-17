// Opaque, bounded pagination cursor for the notification inbox.
// This is a pure serialization helper, NOT an authorization token.
// The server must derive recipient identity from its verified session.
const MAX_CURSOR_LENGTH = 256;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export function encodeNotificationCursor(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const timestamp = item.created_at;
  const id = item.id;
  if (typeof timestamp !== 'string' || !ISO_UTC.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp ||
      typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  return `${timestamp}|${id}`;
}

export function decodeNotificationCursor(cursor) {
  if (typeof cursor !== 'string' || cursor.length > MAX_CURSOR_LENGTH) return null;
  const index = cursor.indexOf('|');
  if (index < 0 || cursor.indexOf('|', index + 1) !== -1) return null;
  const timestamp = cursor.slice(0, index);
  const id = cursor.slice(index + 1);
  if (typeof timestamp !== 'string' || !ISO_UTC.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp ||
      !ID_PATTERN.test(id)) return null;
  return { created_at: timestamp, id };
}

export function isBeforeNotificationCursor(item, cursor) {
  if (!item || !cursor) return false;
  const key = encodeNotificationCursor(item);
  if (!key) return false;
  const normalized = decodeNotificationCursor(`${cursor.created_at}|${cursor.id}`);
  if (!normalized) return false;
  return item.created_at < normalized.created_at ||
    (item.created_at === normalized.created_at && item.id < normalized.id);
}

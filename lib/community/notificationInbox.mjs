// Pure inbox presentation/ownership helpers. The API and RLS must independently
// enforce authorization; these helpers do not query, mutate or send notifications.
const TYPES = new Set(['thread_reply', 'prediction_published', 'favorite_racer_update', 'service_notice']);
const MAX_PAGE_SIZE = 50;

export function normalizeInboxPageSize(value, fallback = 20) {
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, MAX_PAGE_SIZE);
}

export function visibleInboxItems(items, userId, { limit = 20 } = {}) {
  if (!Array.isArray(items) || typeof userId !== 'string' || !userId.trim()) return [];
  const max = normalizeInboxPageSize(limit);
  return items.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (item.recipient_user_id !== userId || item.deleted_at != null) return false;
    if (!TYPES.has(item.type) || typeof item.id !== 'string' || !item.id) return false;
    if (typeof item.created_at !== 'string' || !Number.isFinite(Date.parse(item.created_at))) return false;
    if (item.read_at != null && (typeof item.read_at !== 'string' || !Number.isFinite(Date.parse(item.read_at)))) return false;
    // Private content must not be surfaced unless the server explicitly checked
    // current audience/entitlement/visibility at retrieval time.
    if (item.type === 'thread_reply' && item.can_recipient_read_thread !== true) return false;
    if (item.type === 'prediction_published' && item.can_recipient_read_prediction !== true) return false;
    if (item.authorized_by_server !== true) return false;
    return true;
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, max).map((item) => ({
    id: item.id,
    type: item.type,
    created_at: item.created_at,
    read_at: item.read_at ?? null,
    // Never forward arbitrary DB fields (tokens, internal flags, recipient IDs,
    // private source rows) to the presentation layer.
  }));
}

export function canMarkInboxItemRead(item, userId) {
  return !!item && typeof item === 'object' && !Array.isArray(item) &&
    typeof userId === 'string' && !!userId.trim() &&
    item.recipient_user_id === userId && typeof item.id === 'string' && !!item.id &&
    item.deleted_at == null && item.authorized_by_server === true;
}

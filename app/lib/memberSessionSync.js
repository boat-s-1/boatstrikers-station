const SYNC_TTL_MS = 40 * 60 * 1000;
const STORAGE_KEY = "boatstrikers:member-session-sync:v2";
let tail = Promise.resolve();
let latest = null;
let generation = 0;
let memoryState = null;

function readState() {
  try { return memoryState || JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)); }
  catch { return memoryState; }
}
function saveState(state) {
  memoryState = state;
  try {
    if (state) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* In-memory dedupe still works when storage is disabled. */ }
}
async function fingerprint(token) {
  // Never persist another copy of the bearer token. Without Web Crypto only
  // dedupe within this document; a reload must safely resynchronize.
  if (!globalThis.crypto?.subtle) return null;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
function enqueue(key, operation) {
  if (latest?.key === key) return latest.promise;
  const promise = tail.then(operation);
  const entry = { key, promise };
  latest = entry;
  tail = promise.catch(() => {});
  promise.then(() => { if (latest === entry) latest = null; },
    () => { if (latest === entry) latest = null; });
  return promise;
}
async function request(method, token, source) {
  const response = await fetch("/api/members/session", {
    method, cache: "no-store",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Member-Sync-Source": source },
  });
  if (!response.ok) {
    throw new Error(`member session ${method} failed (${response.status})`);
  }
  return { skipped: false, response };
}
export function syncMemberSession(session, { force = false, source = "consumer" } = {}) {
  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId) return clearMemberSession();
  const version = generation;
  return enqueue(token, async () => {
    // A queued old session must never recreate a cookie after logout.
    if (version !== generation) return { skipped: true, reason: "superseded" };
    const hash = await fingerprint(token);
    const state = readState();
    const now = Date.now();
    if (!force && state?.userId === userId &&
        (hash ? state.hash === hash : state.token === token) &&
        now >= state.syncedAt && now < state.validUntil) {
      return { skipped: true, reason: "fresh" };
    }
    const result = await request("POST", token, source);
    if (version === generation) {
      const syncedAt = Date.now();
      const validUntil = Math.min(syncedAt + SYNC_TTL_MS,
        Number.isFinite(session.expires_at) ? session.expires_at * 1000 : Infinity);
      const next = { userId, hash, syncedAt, validUntil };
      saveState(next);
      if (!hash) memoryState = { ...next, token }; // memory only
    }
    return result;
  });
}
export function clearMemberSession() {
  if (latest?.key === "logout") return latest.promise;
  generation += 1;
  saveState(null);
  // Serialize cookie mutations: POST(old) -> DELETE -> POST(new).
  return enqueue("logout", () => request("DELETE", null, "SIGNED_OUT"));
}
export const MEMBER_SESSION_SYNC_TTL_MS = SYNC_TTL_MS;

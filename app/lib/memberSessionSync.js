const SYNC_TTL_MS = 40 * 60 * 1000;
const STORAGE_KEY = "boatstrikers:member-session-sync:v1";

let inFlightPromise = null;
let clearInFlightPromise = null;
let generation = 0;

function readSyncState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !Number.isFinite(parsed?.syncedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSyncState(userId) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ userId, syncedAt: Date.now() }),
    );
  } catch {
    // sessionStorage may be unavailable in restricted browser modes.
  }
}

function clearSyncState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures; server-side cookie deletion is authoritative.
  }
}

function isFresh(userId) {
  const state = readSyncState();
  const age = state ? Date.now() - state.syncedAt : Number.POSITIVE_INFINITY;
  return Boolean(state?.userId === userId && age >= 0 && age < SYNC_TTL_MS);
}

export function syncMemberSession(session, { force = false } = {}) {
  const accessToken = session?.access_token;
  const userId = session?.user?.id;

  if (!accessToken || !userId) {
    return clearMemberSession();
  }

  if (!force && isFresh(userId)) {
    return Promise.resolve({ skipped: true, reason: "fresh" });
  }

  // All callers in the same tab share the same POST while it is in flight.
  if (inFlightPromise) return inFlightPromise;

  const requestGeneration = generation;
  inFlightPromise = fetch("/api/members/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `member session sync failed (${response.status})`);
      }

      if (requestGeneration === generation) writeSyncState(userId);
      return { skipped: false, response };
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

export function clearMemberSession() {
  generation += 1;
  clearSyncState();

  // getSession() and INITIAL_SESSION/SIGNED_OUT can arrive together. Share a
  // single clear operation so an unauthenticated mount does not double-call it.
  if (clearInFlightPromise) return clearInFlightPromise;

  const pendingSync = inFlightPromise;
  const deleteCookie = () =>
    fetch("/api/members/session", { method: "DELETE", cache: "no-store" });

  clearInFlightPromise = (async () => {
    const firstDelete = deleteCookie();

    if (!pendingSync) return firstDelete;

    // If a POST was already in flight when logout occurred, it can finish after
    // the first DELETE and recreate the cookie. Delete once more after it settles.
    await Promise.allSettled([firstDelete, pendingSync]);
    return deleteCookie();
  })().finally(() => {
    clearInFlightPromise = null;
  });

  return clearInFlightPromise;
}

export const MEMBER_SESSION_SYNC_TTL_MS = SYNC_TTL_MS;

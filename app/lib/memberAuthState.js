const SERVER_SNAPSHOT = Object.freeze({ status: "loading", user: null, accessToken: "" });

let snapshot = SERVER_SNAPSHOT;
let signOutHandler = null;
const listeners = new Set();

function emit(nextSnapshot) {
  snapshot = Object.freeze(nextSnapshot);
  listeners.forEach((listener) => listener());
}

export function getMemberAuthSnapshot() {
  return snapshot;
}

export function getServerMemberAuthSnapshot() {
  return SERVER_SNAPSHOT;
}

export function subscribeMemberAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishMemberAuthLoading() {
  emit({ status: "loading", user: null, accessToken: "" });
}

export function publishMemberAuthSession(session) {
  const user = session?.user;
  if (!user?.id) {
    publishMemberAuthSignedOut();
    return;
  }

  const metadata = user.user_metadata || {};
  const displayNameCandidates = [metadata.display_name, metadata.full_name, metadata.name];
  const displayName = displayNameCandidates.find(
    (value) => typeof value === "string" && value.trim(),
  );
  emit({
    status: "signed_in",
    accessToken: typeof session?.access_token === "string" ? session.access_token : "",
    user: {
      id: user.id,
      email: typeof user.email === "string" ? user.email : "",
      displayName: displayName?.trim() || "BoatStrikers メンバー",
    },
  });
}

export function publishMemberAuthSignedOut() {
  emit({ status: "signed_out", user: null, accessToken: "" });
}

export function registerMemberSignOut(handler) {
  signOutHandler = handler;
  return () => {
    if (signOutHandler === handler) signOutHandler = null;
  };
}

export async function requestMemberSignOut() {
  if (!signOutHandler) throw new Error("ログアウトの準備ができていません。");
  return signOutHandler();
}

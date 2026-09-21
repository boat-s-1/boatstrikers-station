import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [header, bridge, authStore, memberPage] = await Promise.all([
  readFile(new URL("../app/PublicSiteHeader.js", import.meta.url), "utf8"),
  readFile(new URL("../app/components/MemberSessionBridge.js", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/memberAuthState.js", import.meta.url), "utf8"),
  readFile(new URL("../app/members/page.js", import.meta.url), "utf8"),
]);

test("header consumes the shared auth state without adding session requests", () => {
  assert.match(header, /useSyncExternalStore/);
  assert.match(header, /subscribeMemberAuth/);
  assert.doesNotMatch(header, /createClient\(/);
  assert.doesNotMatch(header, /\/api\/members\/session/);
});

test("the root bridge remains the single auth publisher and logout owner", () => {
  assert.match(bridge, /publishMemberAuthSession/);
  assert.match(bridge, /publishMemberAuthSignedOut/);
  assert.match(bridge, /registerMemberSignOut/);
  assert.equal((bridge.match(/onAuthStateChange/g) || []).length, 1);
  assert.equal((bridge.match(/createClient\(/g) || []).length, 1);
});

test("auth store fails closed and exposes no access or refresh token", () => {
  assert.match(authStore, /status: "signed_out"/);
  assert.doesNotMatch(authStore, /access_token|refresh_token/);
});

test("drawer login and signup links select the requested members mode", () => {
  assert.match(header, /\/members\?mode=login/);
  assert.match(header, /\/members\?mode=signup/);
  assert.match(memberPage, /requestedMode === "login" \|\| requestedMode === "signup"/);
});

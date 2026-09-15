# Member session POST audit (2026-09-14)

Audited main at 9a8191d, including prior change 6c22112 (2026-09-14 05:25 JST).

## Findings and scope

Before 6c22112, MemberSessionBridge posted on both getSession() and every auth event, without dedupe. INITIAL_SESSION duplicates initialization; repeated SIGNED_IN events (including refocus) also triggered POST. MagazineSwipeViewer independently posted on mount. This explains a mechanism for redundant requests, but the reported 2,254 requests and same-second bursts have NOT been correlated to live Vercel deployment logs. Do not claim all of those requests have this cause.

Current main already had a shared helper used ONLY by the bridge. Magazine bypassed it. The helper keyed freshness only by user for 40 minutes (therefore suppressing changed tokens); shared an in-flight Promise even for a different user/token; and cleared with potentially two DELETEs. Storage failure also disabled successful-call dedupe.

## Complete direct/indirect call inventory

| File | Role before this change |
|---|---|
| app/lib/memberSessionSync.js | Direct POST and DELETE; called by bridge |
| app/components/MemberSessionBridge.js | getSession + auth callbacks -> shared helper |
| app/layout.js | Mounts bridge once in root layout |
| app/library/components/MagazineSwipeViewer.js | Independent direct POST in syncMembership/useEffect |
| app/library/ichika-seminar/[issue]/page.js | Mounts magazine viewer |
| app/library/hatsune-seminar/[issue]/page.js | Mounts magazine viewer |
| app/library/kiina-seminar/[issue]/page.js | Mounts magazine viewer |
| app/api/members/session/route.js | Endpoint, not another caller |

Repository-wide endpoint/helper-name searches found no additional callers. After this change only the helper contains the endpoint fetch.

## All eight Supabase onAuthStateChange registrations

| File | Effect / session API impact |
|---|---|
| app/components/MemberSessionBridge.js | Only subscriber invoking session sync |
| app/components/MemberEmailConfirmationHelper.js | Local UI state; zero direct session POST |
| app/members/page.js | Member profile loading; zero direct session POST |
| app/members/discord/page.js | Discord data loading; zero direct session POST |
| app/members/ichika-consult/page.js | Consultation data loading; zero direct session POST |
| app/members/ichika-hidden-escape/page.js | Session/profile UI state; zero direct session POST |
| app/members/ichika-escape-surge/page.js | Session/profile UI state; zero direct session POST |
| app/library/stadium/[place]/StadiumPremiumMemberArea.js | Stadium API loading; zero direct session POST |

All use stable memoized Supabase dependencies and unsubscribe on cleanup. Root bridge is mounted once. Magazine callback depends only on memoized supabase, not slide/page state: no evidence of a render-loop POST. React development Strict Mode can replay mounting effects; it does not by itself explain production bursts. Firebase onAuthStateChanged under app/bsc2 is separate.

Components create separate Supabase clients; no provider/singleton migration was made because it would broaden authentication behavior changes. Other callbacks can repeat profile/other API requests. members/page awaits Supabase work inside an auth callback, and the stadium callback invokes getSession: these are separate callback-lock concerns, not direct session POST loops.

## Changes and safety

- Bridge: remove redundant getSession initialization; rely on Supabase INITIAL_SESSION and explicit relevant events. Keep callback synchronous, unsubscribe cleanup and logout handling.
- Helper: dedupe exact access token, serialize cookie mutations, invalidate queued old work at logout, retry on later calls after failure. Successful state uses SHA-256 token fingerprint and expiry bounded by both 40 minutes and token expires_at. No bearer token is newly persisted. Storage-disabled clients retain memory dedupe; Web Crypto unavailable clients safely resync after reload.
- Magazine: await the shared helper before using cookie-authenticated premium images. Keep separate entitlement query, so membership plan results are not cached in the sync helper.
- Route: retain getUser and database entitlement checks on every received POST. Add private/no-store to successful cookie responses and bounded source/outcome/duration logs. No bearer/user data is logged.
- Tests: concurrent requests, reload, token/account change, logout ordering, stale queued work, POST/DELETE failures, storage failures and TTL renewal.

A server-side cookie-equality shortcut was intentionally not added: matching a cookie does not establish current token validity or paid entitlement. A process-local cache would not dedupe distributed Vercel invocations, and server-side dedupe cannot reduce invocation count after a request arrives.

## Expected behavior (same tab/document)

| Scenario | POST count after change |
|---|---|
| INITIAL_SESSION + simultaneous magazine/init calls, unsynced token | 1 |
| SIGNED_IN repeated / foreground return with same fresh token | 0 |
| Page navigation or reload with retained fresh storage | 0 |
| TOKEN_REFRESHED with a changed access token | 1 per distinct token |
| Same token event after 40 minute freshness expires | 1 |
| Logout | 0 POST, 1 serialized DELETE for concurrent clear calls |
| New login after logout | 1 |
| Different user/token during pending sync | Serialized new POST, not old Promise reuse |

Forty simultaneous same-token requests become one (97.5% reduction for that synthetic burst). This is NOT a prediction of 97.5% daily reduction. Daily impact depends on deployment version, active tabs, token refresh, magazine usage and other sources.

## Verification and remaining limits

`node --test tests/member-session-sync.test.mjs`: 9 passing tests. These exercise the real shared helper with simulated fetch/storage/time, not a logged-in browser. No live credentials or paid test account were used. Real login, navigation, reload, mobile background return, refresh and premium-image access still require deployment/browser verification.

Dedupe/serialization is per tab, not cross-tab. Cookies are shared but sessionStorage is not: separate tabs may each sync, and cross-tab logout/login races remain possible. Cookie removal independent of storage can require force sync; a failed request retries on the next event/consumer call, without a retry storm or timer. A pending network request delays queued cookie operations. Existing multiple-client/other-endpoint behavior is outside this patch.

Build check: `npm run build` compiled successfully (Next 16.3.5), then failed during existing `/admin/discord-replies` prerender because NEXT_PUBLIC_SUPABASE_URL is unavailable locally (`supabaseUrl is required`); `/bsc2` pages also reported prerender errors. Full build is therefore NOT verified. The repository has no dependency lockfile, so locally resolved `latest` versions may differ from production. No dependency manifest or lockfile change is included.

## Vercel follow-up

Compare equal time windows on the old/new deployment commit, separating POST from DELETE. Track path, method, per-second burst count, response status (401/500), duration, region, deployment, request ID, and invocation totals. New application logs include source (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, magazine, etc.), outcome and durationMs. Source is untrusted diagnostic input, allowlisted, never used for authorization. `unknown` identifies legacy/uninstrumented callers, not necessarily abuse. Do not log Authorization or cookie values. Check premium-image 401/403 and entitlement failures as well as POST reduction. Verify mobile/background and multi-tab behavior before asserting the incident is resolved.

Reference: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

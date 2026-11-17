import crypto from "node:crypto";

// Authentication of the BLOG daily cycle (PHASE 2). A dedicated secret, BLOG_AI_CRON_SECRET, only: no fallback to the
// shared CRON_SECRET, so the BLOG schedule (planned as pg_cron + pg_net with the value in Vault) can be rotated or
// revoked without touching TRINITY / NEWS / DATA LAB. Unset (or blank) means every call is refused.
const digest = value => crypto.createHash("sha256").update(String(value)).digest();

export function blogCronAuthorized(request, env = process.env) {
  const secret = typeof env.BLOG_AI_CRON_SECRET === "string" && env.BLOG_AI_CRON_SECRET.trim() ? env.BLOG_AI_CRON_SECRET : "";
  if (!secret) return false;
  const header = request?.headers?.get?.("authorization") || "";
  return crypto.timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

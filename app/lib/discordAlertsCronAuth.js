// Discord の cron 5本（discord-alerts・discord-race-threads・discord-community-setup・
// discord-membership-sync・discord-community-poll）の認証。Discord 専用の DISCORD_ALERTS_CRON_SECRET を使えるようにする。
//   ・DISCORD_ALERTS_CRON_SECRET が設定されていれば、その値の Bearer だけを受け付ける（CRON_SECRET では通らない）
//   ・未設定（空文字・空白だけ）のときは、従来どおり CRON_SECRET の Bearer を受け付ける
//   ・どちらも無ければ常に拒否する
// Discord 以外の cron（TRINITY・NEWS・BLOG など）は CRON_SECRET のままで、この処理を使わない。
// 秘密値はログに出さない。比較は長さに依らない時間で行う（SHA-256 にしてから timingSafeEqual）。

import crypto from "node:crypto";

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();

// 値は加工せずにそのまま使う（従来の CRON_SECRET の照合と同じ）。空文字・空白だけの値は「未設定」とみなす
const configured = (value) => (typeof value === "string" && value.trim() ? value : "");

export function discordAlertsCronSecret(env = process.env) {
  const dedicated = configured(env.DISCORD_ALERTS_CRON_SECRET);
  if (dedicated) return { secret: dedicated, source: "DISCORD_ALERTS_CRON_SECRET" };
  const shared = configured(env.CRON_SECRET);
  if (shared) return { secret: shared, source: "CRON_SECRET" };
  return { secret: "", source: "none" };
}

export function isDiscordAlertsCronAuthorized(request, env = process.env) {
  const { secret } = discordAlertsCronSecret(env);
  if (!secret) return false;
  const header = request?.headers?.get?.("authorization") || "";
  return crypto.timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

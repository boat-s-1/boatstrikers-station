// APIの内部呼び出し（Cron・Supabaseの定期実行）を確認する共通処理。
// 既存のCronルート（cron/exhibition-alerts など）と同じ判定：
//   Authorization: Bearer <CRON_SECRET>、または x-supabase-cron-token のSHA-256が既知の値と一致。
import crypto from "node:crypto";

export const SUPABASE_CRON_TOKEN_SHA256 = "8ba9be2c4bdca06f432f838869131995057bc2f482b8ac0bbf1fba9f4ad133aa";

function header(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

export function hasInternalCronCredential(headers, env = process.env) {
  const secret = env.CRON_SECRET;
  if (secret && header(headers, "authorization") === `Bearer ${secret}`) return true;
  const token = header(headers, "x-supabase-cron-token");
  if (!token) return false;
  const digest = crypto.createHash("sha256").update(token).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(SUPABASE_CRON_TOKEN_SHA256));
}

// 管理者Cookie、または内部呼び出しの認証情報があれば許可する。
export async function isAdminOrInternalRequest(request, { isAdminAuthenticated, env = process.env }) {
  if (hasInternalCronCredential(request?.headers, env)) return true;
  return Boolean(await Promise.resolve().then(() => isAdminAuthenticated()).catch(() => false));
}

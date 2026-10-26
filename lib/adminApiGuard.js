// 管理者 API（書き込み系）の共通の入口チェック。
// 認証は既存の管理画面ログイン（bs_admin_sync Cookie / isAdminAuthenticated）をそのまま使う。
// ここで弾いた要求は、DB にも外部サイトにも一切触れない。

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "../app/admin/sync/_lib/adminAuth.js";
import { checkSameOrigin } from "./adminApiInput.js";

export { checkSameOrigin, intInRange, jstToday, validDateInRange } from "./adminApiInput.js";

// 管理画面以外のログイン（ラジオブログ・スケジュール・会員管理）や Bearer を持つ要求は「ログイン済みだが権限なし」として 403
const OTHER_CREDENTIAL_COOKIES = ["radio_blog_admin", "bs_schedule_admin", "bs_members_admin"];

export function adminJson(status, body, headers = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function adminError(status, error, extra = {}) {
  return adminJson(status, { ok: false, error, ...extra });
}

// 例外の詳細はサーバーのログにだけ残し、応答には照合用の ID だけを返す
export function adminServerError(tag, error) {
  const errorId = crypto.randomBytes(4).toString("hex");
  console.error(`[${tag}] ${errorId}`, error);
  return adminError(500, "処理に失敗しました。", { errorId });
}

// 戻り値：問題があれば応答（401 / 403）、通ってよければ null
export async function guardAdminWrite(request) {
  const authenticated = await isAdminAuthenticated().catch(() => false); // 設定不備でも開けない
  if (!authenticated) {
    const store = await cookies();
    const otherCredential = OTHER_CREDENTIAL_COOKIES.some((name) => store.get(name)?.value) || Boolean(request.headers.get("authorization"));
    return otherCredential ? adminError(403, "管理者権限が必要です。") : adminError(401, "ログインが必要です。");
  }
  if (!checkSameOrigin(request).ok) return adminError(403, "この操作は管理画面から行ってください。");
  return null;
}

export async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

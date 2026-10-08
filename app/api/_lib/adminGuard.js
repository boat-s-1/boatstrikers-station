import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../admin/sync/_lib/adminAuth";
import { isAdminOrInternalRequest } from "../../../lib/security/requestAuth.mjs";

// 管理画面用API：管理者Cookie、またはCron等の内部呼び出し（CRON_SECRET / Supabaseトークン）のみ許可。
// 許可しない場合は 401 応答を返す。許可する場合は null。
export async function rejectUnlessAdminOrInternal(request) {
  if (await isAdminOrInternalRequest(request, { isAdminAuthenticated })) return null;
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

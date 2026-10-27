// 管理画面の「今すぐ判定」（アラート評価 RPC）の共通処理。
// 認証・同一オリジン確認のあと、DB ロックで同時実行と連打を防いでから RPC を1回だけ呼ぶ。
// Cron（/api/cron/*）は別の route から同じ RPC を直接呼ぶため、このロックは Cron には効かない。
// 評価関数は一意キー＋ON CONFLICT で行が重複せず、notified も書き換えないので、重なっても結果は同じ（負荷が増えるだけ）。

import { NextResponse } from "next/server";
import { adminError, adminServerError, guardAdminWrite } from "./adminApiGuard.js";
import { acquireAdminJobLock, releaseAdminJobLock } from "./adminJobLock.js";

const LOCK_TTL_SECONDS = 120;
const COOLDOWN_SECONDS = 30;

export async function runAdminAlertEvaluation(request, { getClient, rpc, job, tag }) {
  const denied = await guardAdminWrite(request);
  if (denied) return denied;

  let client;
  let lock;
  try {
    client = getClient();
    lock = await acquireAdminJobLock(client, job, { ttlSeconds: LOCK_TTL_SECONDS });
    if (!lock.ok) {
      if (lock.reason === "error") throw lock.error;
      return adminError(409, "判定を実行中か、直前に実行したばかりです。しばらくしてから実行してください。");
    }
    const { data, error } = await client.rpc(rpc);
    if (error) throw error;
    await releaseAdminJobLock(client, lock, { cooldownSeconds: COOLDOWN_SECONDS });
    return NextResponse.json({ ok: true, inserted: Number(data || 0) });
  } catch (error) {
    if (lock?.ok) await releaseAdminJobLock(client, lock).catch(() => {});
    return adminServerError(tag, error);
  }
}

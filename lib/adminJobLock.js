// 管理者 API の重い処理（再集計・展示の再取得）の多重起動防止。
// DB に bs_admin_try_lock / bs_admin_release_lock（supabase/proposals/ の提案マイグレーション）があれば、
// 複数のサーバーレスインスタンスをまたいで1つだけが実行できる。
// 未適用の間は、同じインスタンス内の実行中フラグだけで防ぐ（呼び出し側は DB の実行履歴による間隔チェックも併用する）。

import crypto from "node:crypto";

const running = new Map(); // job → 期限（ms）。インスタンス内の予備の防止

function missingFunction(error) {
  // PostgREST：関数が無い（PGRST202）／ Postgres：undefined_function（42883）
  return error && (error.code === "PGRST202" || error.code === "42883");
}

// 戻り値：{ ok: true, job, holder, mode: "db" | "memory" } または { ok: false, reason: "locked" | "error" }
export async function acquireAdminJobLock(db, job, { ttlSeconds }) {
  const holder = crypto.randomUUID();
  const { data, error } = await db.rpc("bs_admin_try_lock", { p_job: job, p_holder: holder, p_ttl_seconds: ttlSeconds });
  if (!error) return data === true ? { ok: true, job, holder, mode: "db" } : { ok: false, reason: "locked" };
  if (!missingFunction(error)) return { ok: false, reason: "error", error };

  const until = running.get(job);
  if (until && until > Date.now()) return { ok: false, reason: "locked" };
  running.set(job, Date.now() + ttlSeconds * 1000);
  return { ok: true, job, holder, mode: "memory" };
}

// cooldownSeconds：終わった後も次の実行をこの秒数だけ待たせる（DB ロックのときだけ有効）
export async function releaseAdminJobLock(db, lock, { cooldownSeconds = 0 } = {}) {
  if (!lock?.ok) return;
  if (lock.mode === "memory") {
    running.delete(lock.job);
    return;
  }
  const { error } = await db.rpc("bs_admin_release_lock", { p_job: lock.job, p_holder: lock.holder, p_cooldown_seconds: cooldownSeconds });
  if (error) console.error(`[admin-job-lock] release failed ${lock.job}`, error); // 期限（TTL）で自然に外れる
}

export function resetAdminJobLocksForTest() {
  running.clear();
}

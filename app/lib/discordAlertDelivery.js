// Discord アラート配信の「送ってよいか」と「1回だけ送る」を決める共通処理。
// 配信記録は bs_discord_notification_deliveries（一意キー：alert_type, alert_id, channel_key）。
// 列を増やさずに、試行回数と処理中の印を error 列に入れる：
//   claim:<token>:<試行回数>   … 送信中（他の実行は CLAIM_TTL_MS の間は手を出さない）
//   attempt=<試行回数>; <内容> … 送信失敗（MAX_ATTEMPTS 回で打ち切り）
//   それ以外の文字列            … 変更前の形式の失敗（1回失敗として扱う）
// sent_at が入っていれば送信済みで、二度と送らない。

import crypto from "node:crypto";

export const MAX_ATTEMPTS = 3;
export const CLAIM_TTL_MS = 120_000; // 配信 route の maxDuration（30秒）より十分長く
export const NO_CLOSING_TIME_WINDOW_MS = 15 * 60_000;

const TABLE = "bs_discord_notification_deliveries";

export function jstDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// 締切（JST）の時刻。締切が無ければ null
export function closingAt(alert) {
  if (!alert?.race_date || !alert?.closing_time) return null;
  const time = String(alert.closing_time).slice(0, 8);
  const at = new Date(`${alert.race_date}T${time.length === 5 ? `${time}:00` : time}+09:00`);
  return Number.isFinite(at.getTime()) ? at : null;
}

// 送ってよいアラートか：当日分で、締切前。締切が分からないものは検出から15分以内だけ
export function isDeliverable(alert, now = new Date()) {
  if (!alert || alert.race_date !== jstDate(now)) return false;
  const closing = closingAt(alert);
  if (closing) return closing.getTime() > now.getTime();
  const detected = new Date(alert.detected_at || alert.last_detected_at || 0).getTime();
  return Number.isFinite(detected) && detected > 0 && now.getTime() - detected <= NO_CLOSING_TIME_WINDOW_MS;
}

export function parseDeliveryState(row, now = new Date()) {
  if (!row) return { status: "new", attempts: 0 };
  if (row.sent_at) return { status: "sent", attempts: 0 };
  const error = String(row.error || "");
  const claim = /^claim:([^:]+):(\d+)$/.exec(error);
  if (claim) {
    const attempts = Number(claim[2]);
    const age = now.getTime() - new Date(row.updated_at).getTime();
    return age < CLAIM_TTL_MS ? { status: "claimed", attempts } : { status: "failed", attempts }; // 期限切れの処理中は失敗1回とみなす
  }
  const failed = /^attempt=(\d+);/.exec(error);
  if (failed) return { status: "failed", attempts: Number(failed[1]) };
  return { status: "failed", attempts: error ? 1 : 0 };
}

// 配信の権利を取る。取れたら { id, claim, attempt }、取れなければ { skip: 理由 }
export async function claimDelivery(admin, { alertType, alertId, channelKey, now = new Date(), token = crypto.randomUUID() }) {
  const nowIso = now.toISOString();
  const firstClaim = `claim:${token}:1`;
  const { data: inserted, error: insertError } = await admin
    .from(TABLE)
    .upsert(
      { alert_type: alertType, alert_id: alertId, channel_key: channelKey, error: firstClaim, updated_at: nowIso },
      { onConflict: "alert_type,alert_id,channel_key", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw insertError;
  if (inserted?.length) return { id: inserted[0].id, claim: firstClaim, attempt: 1 };

  const { data: row, error: readError } = await admin
    .from(TABLE)
    .select("id,sent_at,error,updated_at")
    .eq("alert_type", alertType)
    .eq("alert_id", alertId)
    .eq("channel_key", channelKey)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return { skip: "missing" };

  const state = parseDeliveryState(row, now);
  if (state.status === "sent") return { skip: "sent" };
  if (state.status === "claimed") return { skip: "in_progress" };
  if (state.attempts >= MAX_ATTEMPTS) return { skip: "exhausted" };

  const attempt = state.attempts + 1;
  const claim = `claim:${token}:${attempt}`;
  // 読んだときの updated_at のままの場合だけ取る（同時に動いた別の実行とは片方だけが成功する）
  const { data: updated, error: updateError } = await admin
    .from(TABLE)
    .update({ error: claim, updated_at: nowIso })
    .eq("id", row.id)
    .is("sent_at", null)
    .eq("updated_at", row.updated_at)
    .select("id");
  if (updateError) throw updateError;
  if (!updated?.length) return { skip: "in_progress" };
  return { id: row.id, claim, attempt };
}

async function finishClaim(admin, claimed, patch) {
  const { error } = await admin
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", claimed.id)
    .eq("error", claimed.claim);
  if (error) throw error;
}

// 1つの (アラート, 通知先) を高々1回だけ送る。send は Discord のメッセージ（id を含む）か null を返す
export async function deliverOnce(admin, { alertType, alertId, channelKey, send, now = new Date(), token }) {
  const claimed = await claimDelivery(admin, { alertType, alertId, channelKey, now, token });
  if (claimed.skip) return { skipped: true, reason: claimed.skip };
  let message;
  try {
    message = await send();
  } catch (error) {
    const text = String(error?.message || error).slice(0, 900);
    await finishClaim(admin, claimed, { error: `attempt=${claimed.attempt}; ${text}` });
    return { sent: false, error: text, attempt: claimed.attempt };
  }
  await finishClaim(admin, claimed, { sent_at: new Date().toISOString(), discord_message_id: message?.id || null, error: null });
  return { sent: true, attempt: claimed.attempt };
}

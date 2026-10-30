// Discord アラート配信の「送ってよいか」と「高々1回だけ送る」を決める共通処理。
// 配信記録は bs_discord_notification_deliveries（一意キー：alert_type, alert_id, channel_key）。
// 列を増やさずに、状態を error 列に入れる：
//   claim:<token>:<試行回数>   … 送信中。他の実行は手を出さない。
//                                 CLAIM_TTL_MS を過ぎても残っていれば「送れたか分からない」とみなし、二度と送らない
//   attempt=<試行回数>; <内容> … Discord が拒否した（HTTP 429・5xx）。MAX_ATTEMPTS 回まで再送する
//   final=<理由>; <内容>        … 送らない／再送しない（締切切れ・恒久的な拒否・結果不明）
//   それ以外の文字列            … 変更前の形式の失敗（1回失敗として扱う）
// sent_at が入っていれば送信済みで、二度と送らない。
// 方針：重複送信より取りこぼしを選ぶ（届いたか分からないものは再送しない）。

import crypto from "node:crypto";

export const MAX_ATTEMPTS = 3;
export const CLAIM_TTL_MS = 120_000; // 配信 route の maxDuration（30秒）より十分長く
export const NO_CLOSING_TIME_WINDOW_MS = 15 * 60_000;
export const SEND_MARGIN_MS = 30_000; // 締切の30秒前を過ぎたら送らない（届くまでの遅れを見込む）

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

// 送ってよいアラートか：当日分で、締切の SEND_MARGIN_MS 前まで。締切が分からないものは検出から15分以内だけ
export function isDeliverable(alert, now = new Date()) {
  if (!alert || alert.race_date !== jstDate(now)) return false;
  const closing = closingAt(alert);
  if (closing) return closing.getTime() - now.getTime() > SEND_MARGIN_MS;
  const detected = new Date(alert.detected_at || alert.last_detected_at || 0).getTime();
  return Number.isFinite(detected) && detected > 0 && now.getTime() - detected <= NO_CLOSING_TIME_WINDOW_MS;
}

// 送信の失敗を分類する。
//   retry   … Discord が受け取りを拒否した（429・5xx）。作られていないので再送してよい
//   final   … 恒久的な拒否（400・401・403・404 など）。再送しても通らない
//   unknown … 応答が無い（通信断・タイムアウト）。届いた可能性があるので再送しない
export function classifySendError(error) {
  const status = Number(error?.status) || Number(/failed: (\d{3})/.exec(String(error?.message || ""))?.[1]) || null;
  if (!status) return "unknown";
  if (status === 429 || status >= 500) return "retry";
  return "final";
}

export function parseDeliveryState(row, now = new Date()) {
  if (!row) return { status: "new", attempts: 0 };
  if (row.sent_at) return { status: "sent", attempts: 0 };
  const error = String(row.error || "");
  if (error.startsWith("final=")) return { status: "final", attempts: 0 };
  const claim = /^claim:([^:]+):(\d+)$/.exec(error);
  if (claim) {
    const age = now.getTime() - new Date(row.updated_at).getTime();
    // 期限切れの送信中は、送信中に打ち切られたか記録に失敗したもの。届いた可能性があるので再送しない
    return age < CLAIM_TTL_MS ? { status: "claimed", attempts: Number(claim[2]) } : { status: "unknown", attempts: Number(claim[2]) };
  }
  const failed = /^attempt=(\d+);/.exec(error);
  if (failed) return { status: "failed", attempts: Number(failed[1]) };
  return { status: "failed", attempts: error ? 1 : 0 };
}

// これ以上送ることのない (alert_id, channel_key) の集合（送信済み・確定・結果不明・再送上限）。
// 予想の計算などを省くための先読みで、取得に失敗したら空集合を返す（その場合も claim で重複は防がれる）
export async function finishedDeliveryKeys(admin, alertType, alertIds, now = new Date()) {
  const keys = new Set();
  if (!alertIds?.length) return keys;
  try {
    const { data, error } = await admin
      .from(TABLE)
      .select("alert_id,channel_key,sent_at,error,updated_at")
      .eq("alert_type", alertType)
      .in("alert_id", alertIds);
    if (error) return keys;
    for (const row of data || []) {
      const state = parseDeliveryState(row, now);
      const done = ["sent", "final", "unknown"].includes(state.status) || (state.status === "failed" && state.attempts >= MAX_ATTEMPTS);
      if (done) keys.add(`${row.alert_id}:${row.channel_key}`);
    }
  } catch {
    // 先読みに失敗しても配信は続ける
  }
  return keys;
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
  if (state.status === "final") return { skip: "final" };
  if (state.status === "claimed") return { skip: "in_progress" };
  if (state.status === "unknown") return { skip: "unknown_outcome" };
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

// 自分の印が残っている行だけを書き換える。書けなければ false（印が残り、期限後は「結果不明」として再送されない）
async function finishClaim(admin, claimed, patch) {
  try {
    const { error } = await admin
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", claimed.id)
      .eq("error", claimed.claim);
    return !error;
  } catch {
    return false;
  }
}

// 1つの (アラート, 通知先) を高々1回だけ送る。
//   send          … Discord のメッセージ（id を含む）か null を返す
//   stillDeliverable … 権利を取った直後（送る直前）にもう一度確かめる。false なら送らない
// 例外は投げない（1件の失敗で残りの配信を止めない）
export async function deliverOnce(admin, { alertType, alertId, channelKey, send, stillDeliverable = () => true, now = new Date(), token }) {
  let claimed;
  try {
    claimed = await claimDelivery(admin, { alertType, alertId, channelKey, now, token });
  } catch (error) {
    // 権利が取れていないので送っていない。回数にも数えず、次の実行で取り直す
    return { sent: false, error: `claim_failed: ${String(error?.message || error).slice(0, 300)}` };
  }
  if (claimed.skip) return { skipped: true, reason: claimed.skip };

  if (!stillDeliverable()) {
    await finishClaim(admin, claimed, { error: "final=expired; 送信直前に締切を過ぎた" });
    return { skipped: true, reason: "expired" };
  }

  let message;
  try {
    message = await send();
  } catch (error) {
    const text = String(error?.message || error).slice(0, 900);
    const kind = classifySendError(error);
    const marker = kind === "retry" ? `attempt=${claimed.attempt}` : kind === "final" ? "final=rejected" : "final=unknown";
    const recorded = await finishClaim(admin, claimed, { error: `${marker}; ${text}` });
    return { sent: false, error: text, attempt: claimed.attempt, kind, recorded };
  }
  if (!message?.id) {
    // Discord が応答したものの投稿IDが無い場合、送信の成否は確定できない。
    // 二重投稿を防ぐため再送せず、成功にも数えない。
    const recorded = await finishClaim(admin, claimed, { error: "final=unknown; Discord response missing message id" });
    return { sent: false, error: "Discord response missing message id", kind: "unknown", recorded };
  }
  const recorded = await finishClaim(admin, claimed, { sent_at: new Date().toISOString(), discord_message_id: message.id, error: null });
  return { sent: true, attempt: claimed.attempt, recorded };
}

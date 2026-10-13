// NEWS の「○R の結果を更新」記事を作ってよいかの判定（純粋関数）。
// bs_race_events.result_available は締切前のレースにも true が入ることがあるため、単独では使わない。
// 締切時刻・3連単と払戻・確定着順・確定状態（bs_race_results）がすべて揃い、互いに矛盾しない場合だけ生成を許可する。
// 判定に必要なデータが欠けている・食い違う場合は、生成しない（fail closed）。

export const RESULT_GUARD_MARGIN_MINUTES = 10; // 締切からこの時間が過ぎるまでは生成しない

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function sameKey(row, key) {
  return (
    row &&
    String(row.race_date || "").slice(0, 10) === key.race_date &&
    Number(row.course_code) === Number(key.course_code) &&
    Number(row.race_no) === Number(key.race_no)
  );
}

export function normalizeTrifecta(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (!/^[1-6]{3}$/.test(digits)) return "";
  if (new Set(digits).size !== 3) return "";
  return digits;
}

// レース日（JST）と締切時刻から、締切の UTC ミリ秒を求める。
export function closingTimeMs(raceDate, closingTime) {
  const date = String(raceDate || "").slice(0, 10);
  const time = String(closingTime || "").match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, Number(time[1]), Number(time[2])) - JST_OFFSET_MS;
}

function positiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// key: { race_date, course_code, race_no }
// event: bs_race_events の行、result: bs_race_results の行、entries: 同じレースの bs_race_entries（boat_no・arrival_order）
export function checkRaceResultConfirmed({ key, event, result, entries, now = Date.now(), marginMinutes = RESULT_GUARD_MARGIN_MINUTES }) {
  const reasons = [];
  const validKey =
    key &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(key.race_date || "")) &&
    Number(key.course_code) >= 1 && Number(key.course_code) <= 24 &&
    Number(key.race_no) >= 1 && Number(key.race_no) <= 12;
  if (!validKey) return { ok: false, reasons: ["レース日・場・R番号が不正"] };

  // 1. 日付・場・R番号の一致
  if (!event) reasons.push("レース情報（bs_race_events）がない");
  else if (!sameKey(event, key)) reasons.push("レース情報の日付・場・R番号が一致しない");
  if (!result) reasons.push("確定結果（bs_race_results）がない");
  else if (!sameKey(result, key)) reasons.push("確定結果の日付・場・R番号が一致しない");
  const rows = Array.isArray(entries) ? entries : null;
  if (!rows || !rows.length) reasons.push("出走データ（bs_race_entries）がない");
  else if (rows.some((row) => !sameKey(row, key))) reasons.push("出走データの日付・場・R番号が一致しない");
  if (reasons.length) return { ok: false, reasons };

  // 2. 中止・不成立
  if (String(event.race_cancel_code || "").trim()) reasons.push(`中止・不成立（${event.race_cancel_code}）`);

  // 3. 締切時刻を過ぎている
  const closing = closingTimeMs(key.race_date, event.closing_time);
  if (closing == null) reasons.push("締切時刻がない");
  else if (now < closing + marginMinutes * 60000) reasons.push("締切から十分な時間が経っていない（締切前を含む）");

  // 4. 3連単の組番と払戻
  const eventTrifecta = normalizeTrifecta(event.trifecta);
  const eventPayout = positiveInteger(event.trifecta_payout);
  if (!eventTrifecta) reasons.push("3連単の組番がない・不正");
  if (!eventPayout) reasons.push("3連単の払戻がない・不正");

  // 5. 公式の確定状態と、結果テーブルとの一致
  if (result.result_status !== "confirmed") reasons.push(`確定状態でない（result_status=${result.result_status ?? "なし"}）`);
  if (result.race_status != null && result.race_status !== "finished") reasons.push(`レースが終了状態でない（race_status=${result.race_status}）`);
  const resultTrifecta = normalizeTrifecta(result.winning_trifecta || result.trifecta_result);
  if (!resultTrifecta) reasons.push("確定結果の3連単がない");
  else if (eventTrifecta && resultTrifecta !== eventTrifecta) reasons.push("3連単の組番が確定結果と一致しない");
  const resultPayout = positiveInteger(result.trifecta_payout);
  if (!resultPayout) reasons.push("確定結果の払戻がない");
  else if (eventPayout && resultPayout !== eventPayout) reasons.push("払戻が確定結果と一致しない");

  // 6. 確定着順（1〜3着が1艇ずつあり、3連単と一致する）
  const byOrder = new Map();
  for (const row of rows) {
    const order = Number(row.arrival_order);
    if (!Number.isInteger(order) || order < 1 || order > 6) continue;
    if (!byOrder.has(order)) byOrder.set(order, []);
    byOrder.get(order).push(Number(row.boat_no));
  }
  const top3 = [1, 2, 3].map((order) => byOrder.get(order) || []);
  if (top3.some((boats) => boats.length === 0)) reasons.push("1〜3着の確定着順がない");
  else if (top3.some((boats) => boats.length !== 1)) reasons.push("同着など、着順が一意でない");
  else if (eventTrifecta && top3.map((boats) => boats[0]).join("") !== eventTrifecta) reasons.push("着順が3連単と一致しない");

  return { ok: reasons.length === 0, reasons, trifecta: eventTrifecta, payout: eventPayout };
}

function keyOf(row) {
  return `${String(row.race_date).slice(0, 10)}:${Number(row.course_code)}:${Number(row.race_no)}`;
}

export function resultSourceKey(key) {
  return `bs:result:${key.race_date}:${Number(key.course_code)}:${Number(key.race_no)}`;
}

// 1場ぶんの候補から、確定条件を満たすレースだけを残す（記事にするのは呼び出し側が選ぶ1レース）。
// existingKeys：すでに作成済みの結果記事の source_key。重複は除く。
export function confirmedRacesForArticles({ races, events, results, entries, existingKeys, now = Date.now() }) {
  const eventByKey = new Map((events || []).map((row) => [keyOf(row), row]));
  const resultByKey = new Map((results || []).map((row) => [keyOf(row), row]));
  const entriesByKey = new Map();
  for (const row of entries || []) {
    const k = keyOf(row);
    if (!entriesByKey.has(k)) entriesByKey.set(k, []);
    entriesByKey.get(k).push(row);
  }
  const confirmed = [];
  const rejected = [];
  for (const key of races) {
    const k = keyOf(key);
    if (existingKeys.has(resultSourceKey(key))) {
      rejected.push({ key, reasons: ["同じレースの結果記事が作成済み"] });
      continue;
    }
    const check = checkRaceResultConfirmed({ key, event: eventByKey.get(k), result: resultByKey.get(k), entries: entriesByKey.get(k), now });
    if (check.ok) confirmed.push({ key, event: eventByKey.get(k), trifecta: check.trifecta, payout: check.payout });
    else rejected.push({ key, reasons: check.reasons });
  }
  return { confirmed, rejected };
}

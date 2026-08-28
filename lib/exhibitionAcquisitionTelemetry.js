// This module accepts a server-owned client; it never constructs or exposes credentials.
export const REASON_LABELS = {
  ready: '取得成功（保存・通知は別判定）', not_published: '展示公開待ち',
  timeout: '通信タイムアウト', network: '通信失敗', http: '取得先HTTPエラー',
  date_mismatch: '対象日不一致・当日限定', identity_mismatch: '開催日・場・レース・艇の照合不一致',
  identity_missing: '照合情報不足', incomplete_boats: '6艇未揃い・艇番重複',
  incomplete_values: '展示値の不足・範囲外', layout: '展示表の構造変更・解析不可',
  unsupported: '公式アダプター未対応', invalid_request: 'レース指定不正',
  unavailable: 'データ取得不可・理由未確定', unknown: '未分類の取得エラー',
};
const GROUPS = {
  timeout: ['timeout','upstream_timeout','AbortError','TimeoutError'],
  network: ['fetch failed','fetch_failed','upstream_fetch_failed','ECONNRESET','ENOTFOUND','ECONNREFUSED'],
  http: ['http_error','upstream_http_error'],
  date_mismatch: ['reference_date_mismatch','current_day_only','tsu_current_day_only'],
  identity_mismatch: ['source_venue_mismatch','reference_identity_mismatch','original_race_mismatch','source_identity_mismatch','source_race_mismatch','boat_identity_mismatch','original_boat_identity_invalid','reference_boat_identity_invalid','roster_or_exhibition_mismatch'],
  identity_missing: ['reference_identity_missing','source_identity_missing'],
  incomplete_boats: ['six_unique_boats_required'],
  incomplete_values: ['measurements_incomplete_or_invalid','required_measurements_incomplete'],
  layout: ['timing_layout_changed','timing_table_ambiguous','timing_row_changed','original_row_changed','reference_row_changed','parse_failed','section_not_found','empty_body','body_too_large'],
  unsupported: ['official_adapter_not_verified'], invalid_request: ['invalid_race'],
  unavailable: ['official_original_tenji_not_available','original_data_unavailable','detail_not_available'],
  not_published: ['not_published'],
};
const SOURCE_KEYS = ['boaters','tsu','amagasaki','official','verifiedOfficial'];
export function acquisitionReason(result) {
  if (result?.ok === true) return 'ready';
  for (const value of [result?.error, result?.reason, result?.name]) {
    if (typeof value !== 'string') continue;
    if (/^http_[45]\d\d$/.test(value)) return 'http';
    for (const [code, values] of Object.entries(GROUPS)) if (values.includes(value)) return code;
  }
  if (Number(result?.status) >= 400 && Number(result?.status) <= 599) return 'http';
  return 'unknown';
}
function safeAttempt(key, result) {
  let code = acquisitionReason(result);
  // Legacy adapters report the aggregate error, but retain per-URL transport evidence.
  const attempts = Array.isArray(result?.attempts) ? result.attempts : [];
  if (code === 'unavailable' && attempts.length && attempts.every(a => ['timeout','network','http'].includes(acquisitionReason(a)))) code = acquisitionReason(attempts.at(-1));
  const boats = Array.isArray(result?.rows) ? new Set(result.rows.map(r => Number(r.boatNo)).filter(n => Number.isInteger(n) && n >= 1 && n <= 6)).size : null;
  const http = Number(result?.status);
  return { key, code, boats, http: Number.isInteger(http) && http >= 100 && http <= 599 ? http : null };
}
export function acquisitionRecord(race, consumer, result, startedAt, checkedAt) {
  const sourceKind = ['official','boaters'].includes(result?.sourceKind) ? result.sourceKind : 'unknown';
  const sources = SOURCE_KEYS.filter(k => result?.diagnostics?.[k]).map(k => safeAttempt(k, result.diagnostics[k]));
  return { race_date: race.raceDate, course_code: Number(race.courseCode), race_no: Number(race.raceNo), consumer,
    started_at: startedAt, checked_at: checkedAt, reason_code: acquisitionReason(result), source_kind: sourceKind, source_results: sources };
}
export async function trackExhibitionFetch(client, consumer, race, fetcher, options = {}, logger = console) {
  const startedAt = new Date().toISOString();
  async function record(result) {
    try {
      const payload = acquisitionRecord(race, consumer, result, startedAt, new Date().toISOString());
      const response = await client.rpc('bs_record_exhibition_acquisition', { p_record: payload }).abortSignal(AbortSignal.timeout(2000));
      if (response.error) logger.warn('exhibition_acquisition_record_failed');
    } catch { logger.warn('exhibition_acquisition_record_failed'); }
  }
  let result;
  try { result = await fetcher(race, options); }
  catch (error) { await record({ ok: false, error: error?.message, name: error?.name }); throw error; }
  await record(result);
  return result;
}

// Only the values returned here may be rendered. Never expose raw worker summaries.
export const HEARTBEAT_STALE_MINUTES = 30;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function date(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
function stamp(value) { const n = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(n) ? new Date(n).toISOString() : null; }
function count(value) { return (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null; }
export function summarizePcSync(runtime, selectedDate, now = new Date()) {
  const heartbeat = stamp(runtime?.heartbeat_at);
  const age = heartbeat ? (+now - Date.parse(heartbeat)) / 60000 : null;
  const worker = !runtime || age === null || age < -5 ? 'unknown' : age >= HEARTBEAT_STALE_MINUTES ? 'stale' : runtime.state === 'running' ? 'running' : ['failed', 'error'].includes(runtime.last_status) ? 'error' : 'responding';
  const steps = Array.isArray(runtime?.last_summary?.steps) ? runtime.last_summary.steps : [];
  const step = [...steps].reverse().find(s => s?.step === 'pc_kyotei_exhibition');
  const targetDate = date(step?.target_date);
  const checkedAt = stamp(step?.sync_checked_at);
  const sourceRows = count(step?.source_rows), validRows = count(step?.valid_rows);
  let exhibition = 'unknown';
  if (!step) exhibition = 'waiting';
  else if (targetDate !== selectedDate) exhibition = 'date_unchecked';
  else if (['failed', 'error'].includes(step.status) || Number(step.returncode) > 0) exhibition = 'error';
  else if (sourceRows === 0) exhibition = 'zero';
  else if (sourceRows > 0 && validRows === 0) exhibition = 'invalid';
  else if (step.status === 'success' && validRows > 0) exhibition = 'received';
  else if (['waiting_exhibition', 'pending', 'running'].includes(step.status)) exhibition = 'waiting';
  const inputs = ['brd_c3', 'brd_c4'].map(key => {
    const input = step?.pc_kyotei_diagnostics?.[key];
    const compact = typeof input?.latest_yyyymmdd === 'string' ? input.latest_yyyymmdd : '';
    const latestDate = /^\d{8}$/.test(compact) ? date(`${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}`) : null;
    return { key, latestDate, rows: targetDate === selectedDate ? count(input?.target_date_rows) : null };
  });
  return { worker, heartbeat, ageMinutes: age !== null && age >= 0 ? Math.floor(age) : null,
    lastSuccess: stamp(runtime?.last_success_at), exhibition, targetDate, checkedAt,
    sourceRows: targetDate === selectedDate ? sourceRows : null, validRows: targetDate === selectedDate ? validRows : null, inputs };
}

export const WORKER_LABELS = { unknown: '応答時刻不明', stale: '応答更新なし・停止の疑い', running: '同期処理中', error: '直近の同期処理でエラー', responding: '同期プログラムの応答あり' };
export const EXHIBITION_LABELS = { unknown: '展示処理の状態不明', waiting: '展示データの同期待ち', date_unchecked: '選択日の確認結果なし', error: '展示同期エラー', zero: '対象日データ0件', invalid: 'データあり・有効値0件', received: '対象日の有効データあり' };

export function summarizeVenueAttempts(attempts, dateValue, courseCode) {
  const records = (Array.isArray(attempts) ? attempts : []).filter(r => r.race_date === dateValue && Number(r.course_code) === Number(courseCode));
  records.sort((a,b) => Date.parse(b.started_at || b.checked_at) - Date.parse(a.started_at || a.checked_at) || Date.parse(b.checked_at) - Date.parse(a.checked_at));
  // Keep one latest result per race. A different consumer's later success clears an older failure.
  const latestByRace = new Map();
  for (const record of records) if (!latestByRace.has(Number(record.race_no))) latestByRace.set(Number(record.race_no), record);
  return { latest: records[0] || null, races: [...latestByRace.values()].sort((a,b) => Number(a.race_no) - Number(b.race_no)) };
}

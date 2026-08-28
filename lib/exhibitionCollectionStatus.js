import { VENUES } from './exhibitionStatusCatalog.js';

export const ORIGINAL_METRICS = [
  ['lap', '一周', 'official_lap', 'lap_time'],
  ['turn', 'まわり足', 'official_turn', 'turn_time'],
  ['straight', '直線', 'official_straight', 'straight_time'],
  ['half', '半周', 'official_half_lap', 'half_lap_time'],
];

export function validMeasurement(value) {
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) > 0;
}

export function collectionSource(value) {
  const source = String(value || '').toLowerCase();
  if (/pc[-_ ]?ky[o]?utei|pc[-_ ]?kyotei/.test(source)) return 'PC-KYOTEI';
  if (source.includes('boaters')) return 'BOATERS';
  if (source.includes('api')) return 'API';
  if (source.includes('official') || source === '公式') return '公式';
  return '不明';
}

function timestamp(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function metricValue(row, metric) {
  const official = validMeasurement(row[metric[2]]);
  if (!official && !validMeasurement(row[metric[3]])) return null;
  return {
    source: collectionSource(official ? row.official_exhibition_source : (row.data_source || row.exhibition_source)),
    // Generic row/API updates are not proof that original measurements were updated.
    time: timestamp(official ? row.official_exhibition_synced_at : row.exhibition_synced_at),
  };
}

export function normalizeCollectionDate(value, fallback) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : fallback;
}

export function buildCollectionStatus({ date, events = [], entries = [] }) {
  return VENUES.map(({ code, name }) => {
    const races = new Map();
    for (const row of entries) {
      const race = Number(row.race_no), boat = Number(row.boat_no);
      if (row.race_date !== date || Number(row.course_code) !== code || !Number.isInteger(race) || race < 1 || race > 12 || !Number.isInteger(boat) || boat < 1 || boat > 6) continue;
      if (!races.has(race)) races.set(race, []);
      races.get(race).push(row);
    }
    const completed = [], partial = [], sources = new Set(), times = [];
    for (const [race, rows] of [...races].sort((a, b) => a[0] - b[0])) {
      const uniqueSix = rows.length === 6 && new Set(rows.map(row => Number(row.boat_no))).size === 6;
      const readyMetrics = ORIGINAL_METRICS.filter(metric => uniqueSix && rows.every(row => metricValue(row, metric)));
      const values = rows.flatMap(row => ORIGINAL_METRICS.map(metric => metricValue(row, metric)).filter(Boolean));
      if (!values.length) continue;
      for (const value of values) {
        sources.add(value.source);
        if (value.time !== null) times.push(value.time);
      }
      if (readyMetrics.length) completed.push({ race, metrics: readyMetrics.map(metric => metric[1]) });
      else partial.push(race);
    }
    const scheduled = events.some(row => row.race_date === date && Number(row.course_code) === code);
    return { code, name, completed, partial, sources: [...sources].sort(), latest: times.length ? new Date(Math.max(...times)).toISOString() : null,
      state: completed.length ? '更新あり' : partial.length ? '一部取得' : scheduled ? '未取得' : '開催登録なし' };
  });
}

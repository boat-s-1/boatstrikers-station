import { selectExhibitionField } from './exhibitionDisplay.js';

const FIELD_PAIRS = {
  exhibition: ['official_exhibition_time', 'exhibition_time'],
  lap: ['official_lap', 'lap_time'],
  straight: ['official_straight', 'straight_time'],
};

const REQUIRED = {
  kiina: ['exhibition', 'straight'],
  ichika: ['exhibition', 'lap'],
  hatsune: ['exhibition', 'lap'],
};

function isPcKyotei(value) {
  return /pc[-_ ]?ky[o]?utei|pc[-_ ]?kyotei/i.test(String(value || ''));
}

export function summarizePersistedPcFallback(rows, consumer = 'kiina') {
  const sorted = Array.isArray(rows) ? [...rows].sort((a, b) => Number(a.boat_no) - Number(b.boat_no)) : [];
  const uniqueSix = sorted.length === 6
    && new Set(sorted.map((row) => Number(row.boat_no))).size === 6
    && sorted.every((row, index) => Number(row.boat_no) === index + 1);
  const required = REQUIRED[consumer] || REQUIRED.kiina;
  if (!uniqueSix) return { ok: false, sourceKind: 'pc_kyotei', rows: sorted.length, metrics: [], pcFields: 0, error: 'saved_roster_incomplete' };

  const chosen = [];
  for (const row of sorted) {
    for (const metric of required) {
      const field = selectExhibitionField(row, ...FIELD_PAIRS[metric]);
      if (!field) return { ok: false, sourceKind: 'pc_kyotei', rows: 6, metrics: required, pcFields: chosen.filter((item) => isPcKyotei(item.source)).length, error: 'required_measurements_incomplete' };
      chosen.push(field);
    }
  }
  const pcFields = chosen.filter((field) => isPcKyotei(field.source)).length;
  if (!pcFields) return { ok: false, sourceKind: 'official', rows: 6, metrics: required, pcFields: 0, error: 'pc_kyotei_values_not_available' };
  const officialFields = chosen.filter((field) => /official|公式/i.test(String(field.source || ''))).length;
  return {
    ok: true,
    source: 'PC-KYOTEI',
    sourceKind: officialFields ? 'mixed' : 'pc_kyotei',
    rows: 6,
    metrics: required,
    pcFields,
    error: null,
  };
}

export async function loadPersistedPcFallback(client, race, consumer = 'kiina') {
  const fields = 'boat_no,official_exhibition_time,exhibition_time,official_lap,lap_time,official_straight,straight_time,official_exhibition_source,official_exhibition_synced_at,exhibition_source,exhibition_synced_at,data_source,exhibition_field_meta';
  const { data, error } = await client.from('bs_race_entries').select(fields)
    .eq('race_date', race.race_date).eq('course_code', race.course_code).eq('race_no', race.race_no)
    .order('boat_no', { ascending: true });
  if (error) return { ok: false, sourceKind: 'pc_kyotei', rows: 0, metrics: [], pcFields: 0, error: 'pc_kyotei_fallback_read_failed' };
  return summarizePersistedPcFallback(data || [], consumer);
}

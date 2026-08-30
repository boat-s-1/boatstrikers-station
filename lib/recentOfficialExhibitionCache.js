import 'server-only';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Reuse a recently persisted official exhibition snapshot before calling the
 * upstream collector again. This lets multiple theory-specific cron routes
 * share the same exhibition fetch when they target the same race.
 */
export async function getRecentOfficialExhibitionCache(
  supabase,
  race,
  { maxAgeMs = 180_000, requireLap = true } = {},
) {
  const { data, error } = await supabase
    .from('bs_race_entries')
    .select(
      'boat_no,official_exhibition_time,official_exhibition_st,official_exhibition_symbol,official_exhibition_course,official_lap,official_half_lap,official_turn,official_straight,official_exhibition_source,official_exhibition_synced_at',
    )
    .eq('race_date', race.race_date)
    .eq('course_code', race.course_code)
    .eq('race_no', race.race_no)
    .order('boat_no', { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 6) {
    return { ok: false, reason: 'incomplete_rows' };
  }

  const now = Date.now();
  const timestamps = data.map((row) => toMs(row.official_exhibition_synced_at));
  if (timestamps.some((ms) => ms === null)) {
    return { ok: false, reason: 'missing_synced_at' };
  }

  const oldestMs = Math.min(...timestamps);
  const ageMs = Math.max(0, now - oldestMs);
  if (ageMs > maxAgeMs) {
    return { ok: false, reason: 'stale', ageMs };
  }

  const rows = data.map((row) => ({
    boatNo: Number(row.boat_no),
    exhibitionTime: numberOrNull(row.official_exhibition_time),
    exhibitionSt: numberOrNull(row.official_exhibition_st),
    exhibitionSymbol: row.official_exhibition_symbol ?? null,
    exhibitionCourse: numberOrNull(row.official_exhibition_course),
    lapTime: numberOrNull(row.official_lap),
    halfLapTime: numberOrNull(row.official_half_lap),
    turnTime: numberOrNull(row.official_turn),
    straightTime: numberOrNull(row.official_straight),
  }));

  if (rows.some((row) => row.exhibitionTime === null)) {
    return { ok: false, reason: 'exhibition_not_ready', ageMs };
  }
  if (requireLap && rows.some((row) => row.lapTime === null)) {
    return { ok: false, reason: 'lap_not_ready', ageMs };
  }

  return {
    ok: true,
    reused: true,
    source: data[0]?.official_exhibition_source || 'shared_db_cache',
    sourceKind: 'database_cache',
    fallbackUsed: false,
    rows,
    ageMs,
    syncedAt: new Date(oldestMs).toISOString(),
  };
}

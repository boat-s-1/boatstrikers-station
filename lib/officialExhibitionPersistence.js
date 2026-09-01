const present = value => value !== null && value !== undefined && value !== '';
const number = value => {
  if (!present(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildOfficialEntryUpdate(row, source, syncedAt) {
  const update = {
    official_exhibition_source: source?.source || 'venue_official',
    official_exhibition_synced_at: syncedAt,
  };
  const fields = [
    ['exhibitionTime', 'official_exhibition_time'],
    ['lapTime', 'official_lap'],
    ['halfLapTime', 'official_half_lap'],
    ['turnTime', 'official_turn'],
    ['straightTime', 'official_straight'],
    ['exhibitionSt', 'official_exhibition_st'],
    ['exhibitionCourse', 'official_exhibition_course'],
  ];
  for (const [input, column] of fields) {
    const value = number(row?.[input]);
    if (value !== null) update[column] = value;
  }
  if (row?.exhibitionSymbol !== undefined) update.official_exhibition_symbol = row.exhibitionSymbol || null;
  return update;
}

export function validateOfficialRowsAgainstRoster(source, storedEntries) {
  const rows = Array.isArray(source?.rows) ? source.rows : [];
  const stored = Array.isArray(storedEntries) ? storedEntries : [];
  const boats = rows.map(row => Number(row?.boatNo));
  if (!source?.ok || rows.length !== 6 || new Set(boats).size !== 6 || boats.some(boat => boat < 1 || boat > 6)) {
    return { ok: false, error: 'six_unique_boats_required' };
  }
  if (stored.length !== 6 || new Set(stored.map(row => Number(row?.boat_no))).size !== 6) {
    return { ok: false, error: 'saved_roster_incomplete' };
  }
  for (const row of rows) {
    const current = stored.find(entry => Number(entry.boat_no) === Number(row.boatNo));
    if (!current) return { ok: false, error: 'saved_roster_incomplete' };
    const officialRacer = String(row.racerNo || '').trim();
    if (officialRacer && officialRacer !== String(current.racer_registration_no || '').trim()) {
      return { ok: false, error: 'saved_roster_mismatch', boatNo: Number(row.boatNo) };
    }
  }
  return { ok: true };
}

export async function persistOfficialExhibition(client, race, source, options = {}) {
  const syncedAt = options.syncedAt || new Date().toISOString();
  const base = client.from('bs_race_entries').select('boat_no,racer_registration_no')
    .eq('race_date', race.race_date).eq('course_code', race.course_code).eq('race_no', race.race_no)
    .order('boat_no', { ascending: true });
  const { data: storedEntries, error: rosterError } = await base;
  if (rosterError) throw rosterError;
  const roster = validateOfficialRowsAgainstRoster(source, storedEntries);
  if (!roster.ok) throw new Error(roster.error);

  for (const row of source.rows) {
    const update = buildOfficialEntryUpdate(row, source, syncedAt);
    let query = client.from('bs_race_entries').update(update)
      .eq('race_date', race.race_date).eq('course_code', race.course_code).eq('race_no', race.race_no)
      .eq('boat_no', Number(row.boatNo));
    if (row.racerNo) query = query.eq('racer_registration_no', String(row.racerNo));
    const { data, error } = await query.select('boat_no').maybeSingle();
    if (error) throw error;
    if (!data || Number(data.boat_no) !== Number(row.boatNo)) throw new Error('entry_update_identity_mismatch');
  }
  return { saved: 6, syncedAt, source: source.source || 'venue_official', rosterVerified: true };
}

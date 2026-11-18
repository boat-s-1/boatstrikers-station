// Maps parsed RACEDTL columns into identity-only candidate rows. Offline only.
// The official schedule and six-boat roster must still be checked independently.
const validDate = value => /^\d{8}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}T00:00:00Z`)) &&
  new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}T00:00:00Z`).toISOString().slice(0,10) ===
    `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}`;
export function mapBrdbProgramRoster(records, targetDate) {
  if (!validDate(targetDate) || !Array.isArray(records) || records.length === 0) {
    return { status: 'HOLD_INVALID_INPUT' };
  }
  const earliestStart = new Date(`${targetDate.slice(0,4)}-${targetDate.slice(4,6)}-${targetDate.slice(6)}T00:00:00Z`);
  earliestStart.setUTCDate(earliestStart.getUTCDate() - 10);
  const lowerBound = earliestStart.toISOString().slice(0,10).replaceAll('-', '');
  const rows = [];
  const seen = new Set();
  for (const source of records) {
    const date = String(source?.OPDT ?? '').trim();
    const start = String(source?.SOPDT ?? '').trim();
    const course = Number(source?.RCOURSECD);
    const race = Number(source?.RNO);
    const boat = Number(source?.TEINO);
    const registration = String(source?.ENTNO ?? '').trim();
    if (date !== targetDate || !validDate(start) || start < lowerBound || start > targetDate ||
        !Number.isInteger(course) || course < 1 || course > 24 ||
        !Number.isInteger(race) || race < 1 || race > 12 ||
        !Number.isInteger(boat) || boat < 1 || boat > 6 ||
        !/^0?\d{4}$/.test(registration) || /^0+$/.test(registration)) {
      return { status: 'HOLD_INVALID_ROW' };
    }
    const key = `${course}/${race}/${boat}`;
    if (seen.has(key)) return { status: 'HOLD_DUPLICATE_BOAT' };
    seen.add(key);
    rows.push({ race_date: `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6)}`,
      course_code: course, race_no: race, boat_no: boat,
      racer_registration_no: registration.replace(/^0/, '') });
  }
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.course_code}/${row.race_no}`;
    const registrations = groups.get(key) ?? new Set();
    registrations.add(row.racer_registration_no);
    groups.set(key, registrations);
  }
  if ([...groups.values()].some(set => set.size !== 6) || rows.length !== groups.size * 6) {
    return { status: 'HOLD_INCOMPLETE_ROSTER' };
  }
  return { status: 'CANDIDATE_ONLY', rows };
}

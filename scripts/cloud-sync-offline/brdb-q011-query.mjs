// Offline query construction only. This module never sends requests to BRDB.
// Q011: bound RACEDTL by both meeting start and target race date.
function meetingStartBound(targetDate) {
  if (typeof targetDate !== 'string' || !/^\d{8}$/.test(targetDate)) {
    throw new TypeError('targetDate must be YYYYMMDD');
  }
  const year = Number(targetDate.slice(0, 4));
  const month = Number(targetDate.slice(4, 6));
  const day = Number(targetDate.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError('invalid targetDate');
  }
  date.setUTCDate(date.getUTCDate() - 10);
  const start = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
  return start;
}

export function buildBrdbRaceDetailQuery(targetDate) {
  const start = meetingStartBound(targetDate);
  return `SELECT * FROM RACEDTL WHERE SOPDT >= '${start}' AND OPDT = '${targetDate}' ORDER BY RCOURSECD, RNO, TEINO`;
}

// Team-Nave's 2026-11-19 response recommends the same bounded conditions for RACEMST.
export function buildBrdbRaceMasterQuery(targetDate) {
  const start = meetingStartBound(targetDate);
  return `SELECT * FROM RACEMST WHERE SOPDT >= '${start}' AND OPDT = '${targetDate}' ORDER BY RCOURSECD, RNO`;
}

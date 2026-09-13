const RECOVERY_SUPPORTED = new Set([1,2,4,5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]);

function key(row) {
  return `${row.race_date}/${Number(row.course_code)}/${Number(row.race_no)}`;
}

export function selectExhibitionCollectionTargets(events, attempts, minutesUntil, limit = 8) {
  const latest = new Map();
  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    const current = latest.get(key(attempt));
    if (!current || Date.parse(attempt.checked_at || 0) > Date.parse(current.checked_at || 0)) latest.set(key(attempt), attempt);
  }
  const candidates = (Array.isArray(events) ? events : [])
    .map((race) => ({ ...race, remaining: minutesUntil(race.race_date, race.closing_time) }))
    .filter((race) => race.remaining !== null && Number.isFinite(race.remaining));

  const live = candidates
    .filter((race) => race.remaining <= 18 && race.remaining >= 2)
    .sort((a, b) => a.remaining - b.remaining)
    .map((race) => ({ ...race, collectionPhase: 'live' }));
  const room = Math.max(0, limit - live.length);
  if (!room) return live.slice(0, limit);

  const recovery = candidates
    .filter((race) => race.remaining < 2 && race.remaining >= -12 && RECOVERY_SUPPORTED.has(Number(race.course_code)))
    .filter((race) => latest.get(key(race))?.reason_code !== 'ready')
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, room)
    .map((race) => ({ ...race, collectionPhase: 'recovery' }));
  return [...live.slice(0, limit), ...recovery].slice(0, limit);
}

// Offline release gate: evaluate when all six exhibition rows reached storage.
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const explicitZone = value => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
const jstDate = ms => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function assessExhibitionDeadline({ event, entries, now }) {
  const raceDate = event?.race_date;
  const closingTime = event?.closing_time;
  const nowMs = Date.parse(now);
  const closingMs = datePattern.test(raceDate ?? "") && timePattern.test(closingTime ?? "")
    ? Date.parse(`${raceDate}T${closingTime}+09:00`) : NaN;
  if (!explicitZone(now) || !Number.isFinite(nowMs) || !Number.isFinite(closingMs) ||
      jstDate(closingMs) !== raceDate || !Number.isInteger(event?.course_code) ||
      !Number.isInteger(event?.race_no) || !Array.isArray(entries) || entries.length !== 6) {
    return { status: "INVALID" };
  }
  const boats = new Set();
  const timestamps = [];
  for (const row of entries) {
    if (row?.race_date !== raceDate || row.course_code !== event.course_code ||
        row.race_no !== event.race_no || !Number.isInteger(row.boat_no) ||
        row.boat_no < 1 || row.boat_no > 6 || boats.has(row.boat_no)) {
      return { status: "INVALID" };
    }
    boats.add(row.boat_no);
    // A general row sync must never stand in for an actual exhibition value.
    if (row.exhibition_time == null || row.exhibition_time === "" ||
        row.exhibition_synced_at == null) continue;
    const exhibitionTime = Number(row.exhibition_time);
    if (!Number.isFinite(exhibitionTime) || exhibitionTime <= 0) return { status: "INVALID" };
    const syncedMs = Date.parse(row.exhibition_synced_at);
    if (!explicitZone(row.exhibition_synced_at) || !Number.isFinite(syncedMs) ||
        syncedMs > nowMs || jstDate(syncedMs) !== raceDate) return { status: "INVALID" };
    timestamps.push(syncedMs);
  }
  const cutoffMs = closingMs - 10 * 60 * 1000;
  if (timestamps.length < 6) {
    return { status: nowMs <= cutoffMs ? "PENDING" : "MISSED", cutoffAt: new Date(cutoffMs).toISOString() };
  }
  const completedMs = Math.max(...timestamps);
  return { status: completedMs <= cutoffMs ? "ON_TIME" : "LATE",
    cutoffAt: new Date(cutoffMs).toISOString(), completedAt: new Date(completedMs).toISOString() };
}

// Separate site evidence from DB storage evidence. The caller must supply an
// observed public-page timestamp and six values parsed from that response.
export function assessExhibitionSiteDeadline({ event, entries, now, siteVisibleAt, visibleEntries }) {
  const stored = assessExhibitionDeadline({ event, entries, now });
  if (stored.status === "INVALID") return { status: "INVALID" };
  if (stored.status === "PENDING" || stored.status === "MISSED") {
    return { status: stored.status, cutoffAt: stored.cutoffAt };
  }
  if (siteVisibleAt == null || visibleEntries == null) {
    return { status: "SITE_UNVERIFIED", cutoffAt: stored.cutoffAt,
      storedAt: stored.completedAt };
  }
  const visibleMs = Date.parse(siteVisibleAt);
  const nowMs = Date.parse(now);
  const storedMs = Date.parse(stored.completedAt);
  const storedBoats = new Map(entries.map(row => [row.boat_no, row]));
  const storedRegistrations = entries.map(row => Number(row.racer_registration_no));
  if (!explicitZone(siteVisibleAt) || !Number.isFinite(visibleMs) ||
      visibleMs < storedMs || visibleMs > nowMs ||
      jstDate(visibleMs) !== event.race_date || !Array.isArray(visibleEntries) ||
      storedRegistrations.some(number => !Number.isSafeInteger(number) || number <= 0) ||
      new Set(storedRegistrations).size !== 6 ||
      visibleEntries.length !== 6 || new Set(visibleEntries.map(row => row?.boat_no)).size !== 6 ||
      visibleEntries.some(row => !Number.isInteger(row?.boat_no) || row.boat_no < 1 ||
        row.boat_no > 6 || !Number.isFinite(Number(row.exhibition_time)) ||
        Number(row.exhibition_time) <= 0 ||
        !Number.isSafeInteger(Number(row.racer_registration_no)) ||
        Number(row.racer_registration_no) <= 0 ||
        Number(row.racer_registration_no) !==
          Number(storedBoats.get(row.boat_no)?.racer_registration_no) ||
        Number(storedBoats.get(row.boat_no)?.exhibition_time) !==
          Number(row.exhibition_time))) {
    return { status: "INVALID" };
  }
  return { status: visibleMs <= Date.parse(stored.cutoffAt) ? "SITE_ON_TIME" : "SITE_LATE",
    cutoffAt: stored.cutoffAt, storedAt: stored.completedAt,
    siteVisibleAt: new Date(visibleMs).toISOString() };
}

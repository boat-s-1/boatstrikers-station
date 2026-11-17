// Synthetic race rows shaped like the production tables (column names and value formats as surveyed on 2026-11-03).
// Never real race data.
export const FEMALE = [3001, 3002, 3003, 3004, 3005, 3006];
export const MALE = [4001, 4002, 4003, 4004, 4005, 4006];

export function genderRows() {
  return [...FEMALE.map(id => ({ racer_id: id, racer_gender: "F" })), ...MALE.map(id => ({ racer_id: id, racer_gender: "M" }))];
}

// One race. trifecta "1-2-3" (or "123"); courses: boat → actual course (default boat n in course n).
export function race({ date = "2026-10-01", cc = 1, rno = 1, trifecta = "1-2-3", payout = 1500, technique = "逃げ　　　",
  courses = null, racers = MALE, status = "finished", event = {}, winning = undefined, firstBoat = undefined, entryOverrides = {} } = {}) {
  const result = { race_date: date, course_code: cc, race_no: rno, result_status: status, trifecta_result: trifecta,
    winning_trifecta: winning === undefined ? trifecta : winning, first_boat: firstBoat === undefined ? null : firstBoat,
    trifecta_payout: payout, winning_technique: technique, winning_method: technique };
  const ev = { race_date: date, course_code: cc, race_no: rno, race_status: "scheduled", race_cancel_code: null, trifecta: null, trifecta_payout: null, ...event };
  const order = String(trifecta).replace(/-/g, "");
  const entries = [1, 2, 3, 4, 5, 6].map(boat => ({ race_date: date, course_code: cc, race_no: rno, boat_no: boat,
    racer_registration_no: String(racers[boat - 1]).padStart(boat % 2 ? 5 : 4, "0"), // both "03001" and "3002" forms
    actual_course: courses ? courses[boat - 1] : boat, arrival_order: order[0] === String(boat) ? 1 : null, gender_code: null,
    ...(entryOverrides[boat] || {}) }));
  return { result, event: ev, entries };
}

export function rowsOf(races, genders = genderRows()) {
  return { results: races.map(r => r.result).filter(Boolean), events: races.map(r => r.event).filter(Boolean), entries: races.flatMap(r => r.entries), genders };
}

// n clean races on consecutive race numbers/days for one stadium; every k-th race wins from boat 5 by まくり.
export function cleanRaces({ n, cc = 1, from = "2026-09-01", every5 = 0, women = false, highEvery = 0 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + Math.floor(i / 12) * 86400000).toISOString().slice(0, 10);
    const five = every5 && i % every5 === 0;
    out.push(race({ date: day, cc, rno: (i % 12) + 1, trifecta: five ? "5-1-2" : "1-2-3", technique: five ? "まくり" : "逃げ　　　",
      payout: highEvery && i % highEvery === 0 ? 25000 : 1500, racers: women ? FEMALE : MALE }));
  }
  return out;
}

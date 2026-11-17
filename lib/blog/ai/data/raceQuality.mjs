// Race-level data quality gate for BLOG research articles (PHASE 1).
//
// Every race is checked on its own before any number is counted. A race that fails a check the metric needs is
// excluded with a reason code; nothing is guessed or filled in. The rules come from a read-only survey of the
// production tables on 2026-11-03 (docs/blog/PHASE1-AUTONOMOUS.md, section 2):
//   - bs_race_results: the result of record (trifecta, payout, technique). trifecta_result is stored both as "1-2-3"
//     and "123", and "000" for a few rows; the technique is padded with full-width spaces, sometimes blank.
//   - bs_race_events: cancellation codes and a second copy of trifecta/payout used for cross-checking. race_status is
//     not reliable ("scheduled" rows carry results), so it is not used to decide anything.
//   - bs_race_entries: the six boats, their actual entry course (進入) and registration numbers. Registration
//     numbers appear both as "4794" and "04794".
//   - racer_gender_master: gender by registration number (integer racer_id, "F"/"M").
//   - bs_race_result_entries is NOT used: it has not been updated since 2026-10-16 and finish_position is empty.

export const KNOWN_TECHNIQUES = ["逃げ", "差し", "まくり", "まくり差し", "抜き", "恵まれ"];
// Techniques that tell where the winner started: 逃げ is only from the 1st course; 差し/まくり/まくり差し never are.
const FROM_COURSE_1 = new Set(["逃げ"]);
const NEVER_FROM_COURSE_1 = new Set(["差し", "まくり", "まくり差し"]);
const CONFIRMED_RESULT_STATUS = new Set(["finished", "confirmed"]);

export const EXCLUSION_REASONS = {
  result_missing: "確定結果がない",
  result_unconfirmed: "結果の状態が確定ではない",
  cancelled: "中止・順延の記録がある",
  invalid_trifecta: "3連単の着順が読めない（000 など）",
  trifecta_conflict: "3連単の着順が表どうしで一致しない",
  first_boat_conflict: "1着艇の記録が3連単と一致しない",
  arrival_conflict: "出走表の着順が3連単と一致しない",
  entries_incomplete: "出走6艇がそろっていない",
  course_missing: "進入コースがそろっていない",
  technique_missing: "決まり手がない",
  technique_course_conflict: "決まり手と1着艇の進入コースが矛盾する",
  payout_missing: "3連単の払戻金がない",
  payout_conflict: "払戻金が表どうしで一致しない",
  gender_unknown: "性別マスタにない選手がいる",
  gender_conflict: "性別マスタと出走表の性別コードが一致しない",
};

// "1-2-3" or "123" → "1-2-3"; anything else (including "000" and repeated boats) → null.
export function normalizeTrifecta(value) {
  const digits = String(value ?? "").replace(/[-\s]/g, "");
  if (!/^[1-6]{3}$/.test(digits)) return null;
  if (new Set(digits).size !== 3) return null;
  return digits.split("").join("-");
}

// Full-width/half-width padding removed; only the six official techniques are accepted.
export function normalizeTechnique(value) {
  const text = String(value ?? "").replace(/[\s　]/g, "");
  return KNOWN_TECHNIQUES.includes(text) ? text : null;
}

// "04794", " 4794 " and 4794 are the same racer. Non-numeric values are unusable.
export function normalizeRegistrationNo(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  const stripped = text.replace(/^0+/, "");
  return stripped || null;
}

export const raceKey = r => `${r.race_date}|${Number(r.course_code)}|${Number(r.race_no)}`;

// genders: Map(normalized registration no → "F" | "M") built from racer_gender_master.
export function genderMap(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const reg = normalizeRegistrationNo(row.racer_id);
    if (reg && (row.racer_gender === "F" || row.racer_gender === "M")) map.set(reg, row.racer_gender);
  }
  return map;
}

// One race → { key, fields, problems }. problems: reason codes per field group, so a metric can ignore
// problems in fields it does not need (a missing payout does not stop an inside-escape count).
export function assessRace({ result, event = null, entries = [], genders = new Map() }) {
  const problems = { result: [], course: [], payout: [], gender: [] };
  const fields = { first_boat: null, trifecta: null, technique: null, winner_course: null, payout: null, all_female: null };
  if (!result) { problems.result.push("result_missing"); return { key: event ? raceKey(event) : null, fields, problems }; }
  const key = raceKey(result);

  if (!CONFIRMED_RESULT_STATUS.has(String(result.result_status ?? ""))) problems.result.push("result_unconfirmed");
  if (event && (event.race_cancel_code || event.race_status === "cancelled")) problems.result.push("cancelled");

  const trifecta = normalizeTrifecta(result.trifecta_result);
  if (!trifecta) problems.result.push("invalid_trifecta");
  else {
    const others = [result.winning_trifecta, event?.trifecta].filter(v => v !== null && v !== undefined && v !== "");
    if (others.some(v => normalizeTrifecta(v) !== trifecta)) problems.result.push("trifecta_conflict");
    fields.trifecta = trifecta;
    fields.first_boat = Number(trifecta[0]);
    if (result.first_boat !== null && result.first_boat !== undefined && Number(result.first_boat) !== fields.first_boat) problems.result.push("first_boat_conflict");
  }

  // Entries: exactly the six boats 1–6, once each.
  const boats = new Map();
  for (const e of entries) boats.set(Number(e.boat_no), e);
  const complete = entries.length === 6 && [1, 2, 3, 4, 5, 6].every(b => boats.has(b));
  if (!complete) { problems.course.push("entries_incomplete"); problems.gender.push("entries_incomplete"); }
  else if (fields.first_boat) {
    const winner = boats.get(fields.first_boat);
    if (winner.arrival_order !== null && winner.arrival_order !== undefined && Number(winner.arrival_order) !== 1) problems.result.push("arrival_conflict");
  }

  // Course: every boat's actual course known and distinct, so "the 1st course" means one boat.
  if (complete) {
    const courses = [...boats.values()].map(e => Number(e.actual_course));
    if (courses.some(c => !Number.isInteger(c) || c < 1 || c > 6) || new Set(courses).size !== 6) problems.course.push("course_missing");
    else if (fields.first_boat) fields.winner_course = Number(boats.get(fields.first_boat).actual_course);
  }
  fields.technique = normalizeTechnique(result.winning_technique ?? result.winning_method);
  if (!fields.technique) problems.course.push("technique_missing");
  else if (fields.winner_course) {
    if (FROM_COURSE_1.has(fields.technique) && fields.winner_course !== 1) problems.course.push("technique_course_conflict");
    if (NEVER_FROM_COURSE_1.has(fields.technique) && fields.winner_course === 1) problems.course.push("technique_course_conflict");
  }

  // Payout: a positive amount; when the event table also has one, both must agree.
  const payout = Number(result.trifecta_payout);
  if (!Number.isInteger(payout) || payout <= 0) problems.payout.push("payout_missing");
  else {
    if (event?.trifecta_payout !== null && event?.trifecta_payout !== undefined && Number(event.trifecta_payout) !== payout) problems.payout.push("payout_conflict");
    fields.payout = payout;
  }

  // Gender: every entrant must be in the master; a gender code on the entry must agree with it.
  if (complete) {
    let female = 0;
    for (const e of boats.values()) {
      const reg = normalizeRegistrationNo(e.racer_registration_no);
      const gender = reg ? genders.get(reg) : undefined;
      if (!gender) { if (!problems.gender.includes("gender_unknown")) problems.gender.push("gender_unknown"); continue; }
      const code = e.gender_code === null || e.gender_code === undefined ? null : String(e.gender_code);
      if ((code === "1" && gender !== "M") || (code === "2" && gender !== "F")) { if (!problems.gender.includes("gender_conflict")) problems.gender.push("gender_conflict"); }
      if (gender === "F") female++;
    }
    if (!problems.gender.length) fields.all_female = female === 6;
  }
  return { key, fields, problems };
}

// The field groups a metric needs; a race is usable for it only when all of them are clean.
export function usableFor(assessment, needs) {
  return needs.every(group => !(assessment.problems[group] || []).length);
}

export function exclusionReasons(assessment, needs) {
  return [...new Set(needs.flatMap(group => assessment.problems[group] || []))];
}

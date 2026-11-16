// Pure parser for the gated PR #298 atomic OpenAPI path. No network or DB calls.
// The existing live SQL function's result mapping is the compatibility contract.
const numeric = (v) => v === null || v === undefined || v === "" ? null
  : Number.isFinite(Number(v)) ? Number(v) : null;
const firstPayout = (result, kind, field) =>
  result?.payouts?.[kind]?.[0]?.[field] ?? null;
const validId = (value, min, max) =>
  Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
export function buildAtomicResultPayload(apiJson, expectedDate) {
  const stadiums = apiJson?.programs?.stadiums;
  if (!stadiums || typeof stadiums !== "object" || Array.isArray(stadiums)) {
    throw new Error("invalid OpenAPI program stadiums");
  }
  const results = [], entries = [];
  for (const [stadiumKey, stadium] of Object.entries(stadiums)) {
    const course = Number(stadium?.stadium_number ?? stadiumKey);
    if (!validId(course, 1, 24)) throw new Error("invalid result course");
    const races = stadium?.races ?? {};
    if (typeof races !== "object" || Array.isArray(races)) throw new Error("invalid result races");
    for (const [raceKey, race] of Object.entries(races)) {
      const raceNo = Number(race?.race_number ?? raceKey);
      if (!validId(raceNo, 1, 12) || race?.date !== expectedDate) {
        throw new Error("invalid result race identity/date");
      }
      const result = race?.result;
      if (result === null || result === undefined) continue;
      if (typeof result !== "object" || Array.isArray(result)) {
        throw new Error("invalid result payload");
      }
      const racers = result.racers ?? {};
      if (typeof racers !== "object" || Array.isArray(racers)) {
        throw new Error("invalid result racers");
      }
      const seen = new Set();
      const racersByBoat = [];
      for (const [boatKey, racer] of Object.entries(racers)) {
        const boatNo = Number(racer?.entry_number ?? boatKey);
        if (!validId(boatNo, 1, 6) || seen.has(boatNo)) {
          throw new Error("invalid/duplicate result boat");
        }
        seen.add(boatNo);
        racersByBoat.push({boatNo, racer});
        entries.push({
          race_date: expectedDate, course_code: course, race_no: raceNo, boat_no: boatNo,
          arrival_order: validId(racer?.place_number, 1, 6) ? Number(racer.place_number) : null,
          finish_place: racer?.place_number_source ?? null,
          actual_course: numeric(racer?.course_number),
          actual_st: numeric(racer?.start_timing),
          result_note: result?.remarks ?? null,
        });
      }
      const placing = (place) => racersByBoat.find(({racer}) => String(racer?.place_number) === place)?.boatNo ?? null;
      results.push({
        race_date: expectedDate, course_code: course, race_no: raceNo,
        winning_method: result?.technique_number_source ?? null,
        technique_code: result?.technique_number == null ? null : String(result.technique_number),
        trifecta_result: firstPayout(result, "trifecta", "combination"),
        trifecta_payout: firstPayout(result, "trifecta", "amount"),
        exacta: firstPayout(result, "exacta", "combination"),
        exacta_payout: firstPayout(result, "exacta", "amount"),
        quinella: firstPayout(result, "quinella", "combination"),
        quinella_payout: firstPayout(result, "quinella", "amount"),
        trio: firstPayout(result, "trio", "combination"),
        trio_payout: firstPayout(result, "trio", "amount"),
        first_boat: placing("1"), second_boat: placing("2"), third_boat: placing("3"),
      });
    }
  }
  return {results, entries};
}

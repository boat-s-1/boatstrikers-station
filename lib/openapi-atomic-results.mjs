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
    if (!/^(?:[1-9]|1[0-9]|2[0-4])$/.test(stadiumKey) || course !== Number(stadiumKey) || !validId(course, 1, 24)) throw new Error("invalid result course");
    const races = stadium?.races ?? {};
    if (typeof races !== "object" || Array.isArray(races)) throw new Error("invalid result races");
    for (const [raceKey, race] of Object.entries(races)) {
      const raceNo = Number(race?.race_number ?? raceKey);
      if (!/^(?:[1-9]|1[0-2])$/.test(raceKey) || raceNo !== Number(raceKey) || !validId(raceNo, 1, 12) || race?.date !== expectedDate) {
        throw new Error("invalid result race identity/date");
      }
      const result = race?.result;
      if (result === null || result === undefined) continue;
      if (typeof result !== "object" || Array.isArray(result)) {
        throw new Error("invalid result payload");
      }
      const programBoats = race?.racers;
      if (!programBoats || typeof programBoats !== "object" || Array.isArray(programBoats) || Object.keys(programBoats).length !== 6) {
        throw new Error("result race missing six program boats");
      }
      const racers = result.racers ?? {};
      if (!racers || typeof racers !== "object" || Array.isArray(racers)) {
        throw new Error("invalid result racers");
      }
      // Validate identity even for pre-settlement result objects; malformed
      // payloads must not be silently ignored by the settlement no-op.
      for (const [boatKey, racer] of Object.entries(racers)) {
        const boatNo = Number(racer?.entry_number ?? boatKey);
        if (!/^[1-6]$/.test(boatKey) || boatNo !== Number(boatKey) ||
            !Object.prototype.hasOwnProperty.call(programBoats, boatKey) ||
            !validId(boatNo, 1, 6)) {
          throw new Error("invalid/duplicate result boat");
        }
      }
      // A result object can exist before settlement. Do not create a blank
      // bs_race_results row that would look like a completed race.
      const payout = firstPayout(result, "trifecta", "combination");
      const hasPlacings = Object.values(racers).some((racer) =>
        racer && typeof racer === "object" &&
        Number.isInteger(Number(racer.place_number)) &&
        Number(racer.place_number) >= 1 && Number(racer.place_number) <= 6);
      if (!payout && !hasPlacings) continue;
      if (!Object.keys(racers).length) {
        throw new Error("settled result missing racer details");
      }
      const seen = new Set();
      const racersByBoat = [];
      for (const [boatKey, racer] of Object.entries(racers)) {
        const boatNo = Number(racer?.entry_number ?? boatKey);
        if (!/^[1-6]$/.test(boatKey) || boatNo !== Number(boatKey) || !Object.prototype.hasOwnProperty.call(programBoats,boatKey) || !validId(boatNo, 1, 6) || seen.has(boatNo)) {
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
      // A malformed duplicate placing would make first/second/third boat
      // nondeterministic; reject it before any atomic database write.
      const seenPlaces = new Set();
      for (const {racer} of racersByBoat) {
        const place = Number(racer?.place_number);
        if (racer?.place_number !== null && racer?.place_number !== undefined &&
            racer?.place_number !== "" && Number.isInteger(place) &&
            place >= 1 && place <= 6) {
          if (seenPlaces.has(place)) throw new Error("duplicate result placing");
          seenPlaces.add(place);
        }
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

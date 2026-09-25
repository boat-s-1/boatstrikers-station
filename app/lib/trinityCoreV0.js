const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalized(value, min, max, fallback = 0.5) {
  const n = finite(value);
  if (n === null || max <= min) return fallback;
  return clamp((n - min) / (max - min), 0, 1);
}

function lowerIsBetter(value, values, fallback = 0.5) {
  const n = finite(value);
  const valid = values.map(finite).filter((v) => v !== null);
  if (n === null || !valid.length) return fallback;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return 0.5;
  return clamp((max - n) / (max - min), 0, 1);
}

function isFemale(entry) {
  if (Number(entry.sex_code) === 2) return true;
  const value = `${entry.gender || ""} ${entry.gender_code || ""}`.toLowerCase();
  return value.includes("女") || value.includes("female") || /(^|\s)(2|f)(\s|$)/.test(value);
}

function basePower(entry) {
  const national = normalized(entry.national_win_rate, 2.5, 8.0);
  const local = normalized(entry.local_win_rate, 2.5, 8.0);
  const motor = normalized(entry.motor_2_rate ?? entry.motor_top2_rate, 20, 55);
  const boat = normalized(entry.boat_2_rate ?? entry.race_boat_top2_rate, 20, 55);
  const averageSt = finite(entry.average_st);
  const start = averageSt === null ? 0.5 : clamp((0.24 - averageSt) / 0.16, 0, 1);
  const boatNo = Number(entry.boat_no ?? entry.teiban);
  const lane = boatNo === 1 ? 1 : clamp(0.76 - (boatNo - 2) * 0.10, 0.2, 0.76);
  return national * 0.28 + local * 0.18 + motor * 0.18 + boat * 0.08 + start * 0.18 + lane * 0.10;
}

function exhibitionPower(entry, entries) {
  const times = entries.map((e) => e.exhibition_time);
  const starts = entries.map((e) => Math.abs(finite(e.exhibition_st) ?? 0.20));
  const laps = entries.map((e) => e.official_lap ?? e.lap_time);
  const turns = entries.map((e) => e.official_turn ?? e.turn_time);
  const straights = entries.map((e) => e.official_straight ?? e.straight_time);
  const mark = String(entry.exhibition_fl || "").toUpperCase();
  const flyingPenalty = mark.includes("F") ? 0.08 : 0;
  return clamp(
    lowerIsBetter(entry.exhibition_time, times) * 0.30 +
      lowerIsBetter(Math.abs(finite(entry.exhibition_st) ?? 0.20), starts) * 0.24 +
      lowerIsBetter(entry.official_lap ?? entry.lap_time, laps) * 0.18 +
      lowerIsBetter(entry.official_turn ?? entry.turn_time, turns) * 0.18 +
      lowerIsBetter(entry.official_straight ?? entry.straight_time, straights) * 0.10 -
      flyingPenalty,
    0,
    1
  );
}

function softmax(rows, key, temperature = 4.4) {
  const weights = rows.map((row) => ({ ...row, weight: Math.exp((finite(row[key]) ?? 0) * temperature) }));
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  return weights.map((row) => ({ ...row, probability: total > 0 ? row.weight / total : 0 }));
}

function specialistScores(entry, commonPower, womenRace) {
  const boatNo = Number(entry.boat_no ?? entry.teiban);
  const national = normalized(entry.national_win_rate, 2.5, 8.0);
  const local = normalized(entry.local_win_rate, 2.5, 8.0);
  const motor = normalized(entry.motor_2_rate ?? entry.motor_top2_rate, 20, 55);
  const averageSt = finite(entry.average_st);
  const start = averageSt === null ? 0.5 : clamp((0.24 - averageSt) / 0.16, 0, 1);

  // v0 keeps the existing specialists' identities explicit. These are hypotheses to backtest, not learned weights.
  const ichika = clamp(commonPower + (boatNo === 1 ? 0.18 : -0.035 * Math.max(0, boatNo - 1)), 0, 1);
  const hatsune = clamp(commonPower + (womenRace ? 0.05 : 0) + national * 0.025 + start * 0.025, 0, 1);
  const kiina = clamp(commonPower + (boatNo === 5 ? 0.16 : 0) + motor * 0.035 + local * 0.02 - (boatNo === 1 ? 0.04 : 0), 0, 1);
  return { ichika, hatsune, kiina };
}

function commentFor(character, ranked, womenRace) {
  const top = ranked[0];
  if (!top) return "評価データが不足しています。";
  if (character === "ichika") return top.boat_no === 1 ? `1号艇のイン優位を最上位に評価。` : `イン固定ではなく${top.boat_no}号艇の総合力を警戒。`;
  if (character === "hatsune") return womenRace ? `女子戦として${top.boat_no}号艇を最上位評価。` : `女子戦対象外のため参考評価。`;
  return top.boat_no === 5 ? `5号艇の穴条件を強く評価。` : `5号艇固定ではなく${top.boat_no}号艇を上位評価。`;
}

export function buildTrinityCoreV0({ event = {}, entries = [], timing = "previous_day" }) {
  if (!Array.isArray(entries) || entries.length !== 6) {
    return { ok: false, reason: "requires_six_entries", engine_version: "trinity-core-v0" };
  }

  const normalizedEntries = entries.map((entry) => ({ ...entry, boat_no: Number(entry.boat_no ?? entry.teiban) }));
  const womenRace = normalizedEntries.every(isFemale);
  const hasExhibition = normalizedEntries.some((entry) => [entry.exhibition_time, entry.exhibition_st, entry.official_lap, entry.lap_time].some((v) => finite(v) !== null));
  const useExhibition = timing === "after_exhibition" && hasExhibition;

  const scored = normalizedEntries.map((entry) => {
    const base = basePower(entry);
    const exhibition = useExhibition ? exhibitionPower(entry, normalizedEntries) : null;
    const common = useExhibition ? base * 0.64 + exhibition * 0.36 : base;
    const specialists = specialistScores(entry, common, womenRace);
    return { boat_no: entry.boat_no, racer_name: entry.racer_name || entry.shimei || "", base, exhibition, common, ...specialists };
  });

  const specialistRankings = {};
  for (const character of ["ichika", "hatsune", "kiina"]) {
    specialistRankings[character] = softmax(scored, character)
      .sort((a, b) => b.probability - a.probability)
      .map((row) => ({ boat_no: row.boat_no, racer_name: row.racer_name, probability: row.probability, score: row[character] }));
  }

  const combined = scored.map((row) => {
    const weights = womenRace ? { ichika: 0.30, hatsune: 0.40, kiina: 0.30 } : { ichika: 0.40, hatsune: 0.25, kiina: 0.35 };
    const trinityScore = row.ichika * weights.ichika + row.hatsune * weights.hatsune + row.kiina * weights.kiina;
    return { ...row, trinityScore, weights };
  });

  const trinityRanking = softmax(combined, "trinityScore")
    .sort((a, b) => b.probability - a.probability)
    .map((row, index) => ({ rank: index + 1, boat_no: row.boat_no, racer_name: row.racer_name, probability: row.probability, score: row.trinityScore }));

  return {
    ok: true,
    engine_version: "trinity-core-v0",
    timing: useExhibition ? "after_exhibition" : "previous_day",
    race: { race_date: event.race_date ?? null, course_code: event.course_code ?? null, race_no: event.race_no ?? null },
    women_race: womenRace,
    specialists: {
      ichika: { ranking: specialistRankings.ichika, comment: commentFor("ichika", specialistRankings.ichika, womenRace) },
      hatsune: { ranking: specialistRankings.hatsune, comment: commentFor("hatsune", specialistRankings.hatsune, womenRace) },
      kiina: { ranking: specialistRankings.kiina, comment: commentFor("kiina", specialistRankings.kiina, womenRace) },
    },
    trinity: { ranking: trinityRanking, top_boat: trinityRanking[0]?.boat_no ?? null, top_probability: trinityRanking[0]?.probability ?? null },
    notes: ["v0 is deterministic and read-only", "specialist and combination weights are hypotheses for backtesting", "no database writes", "no betting tickets are generated yet"],
  };
}

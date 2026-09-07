import "server-only";
import { buildPhase2Predictions } from "./phase2PredictionEngine";

const MODEL_VERSION = "daily-ranker-v1";

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalized(value, min, max, fallback = 0.5) {
  const n = finite(value);
  if (n === null || max <= min) return fallback;
  return clamp((n - min) / (max - min), 0, 1);
}

function isFemale(entry) {
  if (Number(entry.sex_code) === 2) return true;
  const value = `${entry.gender || ""} ${entry.gender_code || ""}`.toLowerCase();
  return value.includes("女") || value.includes("female") || /(^|\s)(2|f)(\s|$)/.test(value);
}

function mapEntry(row) {
  return {
    ...row,
    boat_no: Number(row.boat_no ?? row.teiban),
    racer_name: String(row.racer_name ?? row.shimei ?? "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim(),
    national_win_rate: finite(row.national_win_rate),
    local_win_rate: finite(row.local_win_rate),
    motor_2_rate: finite(row.motor_top2_rate ?? row.motor_2_rate),
    boat_2_rate: finite(row.race_boat_top2_rate ?? row.boat_2_rate),
    average_st: finite(row.average_st),
  };
}

function entryPower(entry) {
  const national = normalized(entry.national_win_rate, 2.5, 8.0);
  const local = normalized(entry.local_win_rate, 2.5, 8.0);
  const motor = normalized(entry.motor_2_rate, 20, 55);
  const boat = normalized(entry.boat_2_rate, 20, 55);
  const stRaw = finite(entry.average_st);
  const start = stRaw === null ? 0.5 : clamp((0.24 - stRaw) / 0.16, 0, 1);
  const lane = Number(entry.boat_no) === 1 ? 1 : clamp(0.76 - (Number(entry.boat_no) - 2) * 0.10, 0.2, 0.76);
  return national * 0.28 + local * 0.18 + motor * 0.18 + boat * 0.08 + start * 0.18 + lane * 0.10;
}

function boatWinProbability(entries, boatNo) {
  const temperature = 4.4;
  const weights = entries.map((entry) => {
    const power = entryPower(entry);
    const laneExtra = Number(entry.boat_no) === 1 ? 0.14 : 0;
    return { boatNo: Number(entry.boat_no), weight: Math.exp((power + laneExtra) * temperature) };
  });
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  const target = weights.find((row) => row.boatNo === Number(boatNo));
  return total > 0 && target ? target.weight / total : 0;
}

function raceKey(courseCode, raceNo) {
  return `${Number(courseCode)}:${Number(raceNo)}`;
}

function pick(rows, limit) {
  return [...rows].sort((a, b) => b.score - a.score).slice(0, limit);
}

function makeRows(races, rankingDate, dataTiming) {
  const all = races.map((race) => {
    const { previousPrediction } = buildPhase2Predictions({ event: race.event, entries: race.entries });
    const escapeProbability = clamp(Number(previousPrediction?.score || 0) / 100, 0, 1);
    const boat5Probability = boatWinProbability(race.entries, 5);
    return {
      ...race,
      escapeProbability,
      riskyProbability: 1 - escapeProbability,
      boat5Probability,
      isWomenRace: race.entries.length === 6 && race.entries.every(isFemale),
    };
  });

  const definitions = [
    { type: "ichika_escape_best10", character: "ichika", rows: pick(all.map((x) => ({ ...x, score: x.escapeProbability })), 10), probability: (x) => x.escapeProbability, label: "イン逃げ期待" },
    { type: "hatsune_dominant_best3", character: "hatsune", rows: pick(all.filter((x) => x.isWomenRace).map((x) => ({ ...x, score: x.escapeProbability })), 3), probability: (x) => x.escapeProbability, label: "女子戦イン優勢" },
    { type: "hatsune_risky_best3", character: "hatsune", rows: pick(all.filter((x) => x.isWomenRace).map((x) => ({ ...x, score: x.riskyProbability })), 3), probability: (x) => x.riskyProbability, label: "女子戦イン不安" },
    { type: "kiina_boat5_best5", character: "kiina", rows: pick(all.map((x) => ({ ...x, score: x.boat5Probability })), 5), probability: (x) => x.boat5Probability, label: "5号艇1着期待" },
  ];

  const result = [];
  for (const definition of definitions) {
    definition.rows.forEach((race, index) => {
      const probability = clamp(definition.probability(race), 0, 1);
      result.push({
        ranking_date: rankingDate,
        character_code: definition.character,
        ranking_type: definition.type,
        rank_no: index + 1,
        course_code: Number(race.event.course_code),
        race_no: Number(race.event.race_no),
        probability,
        model_version: MODEL_VERSION,
        summary: `${definition.label} ${(probability * 100).toFixed(1)}%`,
        metrics: {
          raw_ranking_score: probability,
          tiebreak_common_first_probability: race.escapeProbability,
          boat5_first_probability: race.boat5Probability,
          women_race: race.isWomenRace,
          generator: MODEL_VERSION,
        },
        data_timing: dataTiming,
      });
    });
  }
  return result;
}

async function persistRows(supabase, rows) {
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existing, error: findError } = await supabase
      .from("ai_v2_daily_rankings")
      .select("id,course_code,race_no,selected_for_home,selected_for_social,social_comment")
      .eq("ranking_date", row.ranking_date)
      .eq("data_timing", row.data_timing)
      .eq("ranking_type", row.ranking_type)
      .eq("rank_no", row.rank_no)
      .maybeSingle();
    if (findError) throw findError;

    const now = new Date().toISOString();
    if (existing?.id) {
      const sameRace = Number(existing.course_code) === row.course_code && Number(existing.race_no) === row.race_no;
      const patch = {
        ...row,
        updated_at: now,
        ...(sameRace ? {} : { selected_for_home: false, selected_for_social: false, social_comment: null }),
      };
      const { error } = await supabase.from("ai_v2_daily_rankings").update(patch).eq("id", existing.id);
      if (error) throw error;
      updated += 1;
    } else {
      const { error } = await supabase.from("ai_v2_daily_rankings").insert({
        ...row,
        selected_for_home: false,
        selected_for_social: false,
        social_comment: null,
        updated_at: now,
      });
      if (error) throw error;
      inserted += 1;
    }
  }

  return { inserted, updated, total: rows.length };
}

export async function generateAiDailyRankings(supabase, rankingDate, dataTiming = "previous_day") {
  const [eventsResult, entriesResult] = await Promise.all([
    supabase
      .from("bs_race_events")
      .select("*")
      .eq("race_date", rankingDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true }),
    supabase
      .from("bs_race_entries")
      .select("*")
      .eq("race_date", rankingDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true })
      .order("boat_no", { ascending: true }),
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (entriesResult.error) throw entriesResult.error;

  const entriesByRace = new Map();
  for (const raw of entriesResult.data || []) {
    const entry = mapEntry(raw);
    const key = raceKey(entry.course_code, entry.race_no);
    if (!entriesByRace.has(key)) entriesByRace.set(key, []);
    entriesByRace.get(key).push(entry);
  }

  const races = (eventsResult.data || [])
    .map((event) => ({ event, entries: entriesByRace.get(raceKey(event.course_code, event.race_no)) || [] }))
    .filter((race) => race.entries.length === 6);

  if (!races.length) {
    return { ok: false, reason: "no_complete_races", races: 0, rows: 0, inserted: 0, updated: 0 };
  }

  const rows = makeRows(races, rankingDate, dataTiming);
  const persisted = await persistRows(supabase, rows);
  return { ok: rows.length > 0, races: races.length, womenRaces: races.filter((r) => r.entries.every(isFemale)).length, rows: rows.length, ...persisted, modelVersion: MODEL_VERSION };
}

import { randomUUID } from 'node:crypto';

export const V3_CANDIDATE_01_THRESHOLD = 0.11148521803720483;
export const TRINITY_FEATURE_VERSION = 'trinity-safe-v1';
const num = value => value == null || value === '' ? null : Number(value);
const normalize = (value, limit) => {
  const n = num(value);
  return n == null || !Number.isFinite(n) ? null : n > limit ? n / 100 : n;
};
const time = value => Date.parse(value);
export const closingAt = event => {
  const match = String(event?.closing_time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match || !event?.race_date) return NaN;
  return time(`${event.race_date}T${match[1].padStart(2, '0')}:${match[2]}:00+09:00`);
};

export function captureTrinityEntries(rows, timing, capturedAt) {
  if (!['previous_day', 'after_exhibition'].includes(timing) || rows?.length !== 6 ||
    [...rows].sort((a, b) => a.boat_no - b.boat_no).some((r, i) =>
      Number(r.boat_no) !== i + 1 || !r.racer_registration_no || !r.racer_name ||
      r.average_st == null || r.national_win_rate == null || r.local_win_rate == null ||
      (r.motor_2_rate ?? r.motor_top2_rate) == null ||
      (r.boat_2_rate ?? r.race_boat_top2_rate) == null ||
      (r.sex_code == null && r.gender == null && r.gender_code == null) ||
      !r.created_at || !r.updated_at || time(r.created_at) > time(capturedAt) ||
      time(r.updated_at) > time(capturedAt))) {
    throw new Error('Six complete, contemporaneous entries are required');
  }
  return [...rows].sort((a, b) => a.boat_no - b.boat_no).map(r => ({
    boat_no: Number(r.boat_no), racer_registration_no: String(r.racer_registration_no),
    racer_name: r.racer_name, sex_code: r.sex_code ?? null,
    gender: r.gender ?? null, gender_code: r.gender_code ?? null,
    national_win_rate: normalize(r.national_win_rate, 20),
    local_win_rate: normalize(r.local_win_rate, 20),
    motor_2_rate: normalize(r.motor_2_rate ?? r.motor_top2_rate, 100),
    boat_2_rate: normalize(r.boat_2_rate ?? r.race_boat_top2_rate, 100),
    average_st: num(r.average_st),
    ...(timing === 'after_exhibition' ? {
      exhibition_time: num(r.official_exhibition_time ?? r.exhibition_time),
      exhibition_st: num(r.official_exhibition_st ?? r.exhibition_st),
      official_lap: num(r.official_lap ?? r.lap_time),
      official_turn: num(r.official_turn ?? r.turn_time),
      official_straight: num(r.official_straight ?? r.straight_time),
      lap_time: num(r.official_lap ?? r.lap_time),
      turn_time: num(r.official_turn ?? r.turn_time),
      straight_time: num(r.official_straight ?? r.straight_time),
      exhibition_course: num(r.official_exhibition_course ?? r.exhibition_course),
      exhibition_fl: r.exhibition_fl ?? null,
    } : {}),
  }));
}

export function buildTrinityPredictionSnapshot({ event, entries, prediction, selection,
  timing, generatedAt, sourceCapturedAt, engineVersion, strategyTag, oddsSnapshot = null }) {
  if (!prediction?.ok || prediction.timing !== timing ||
    !Number.isFinite(time(generatedAt)) || !Number.isFinite(time(sourceCapturedAt)) ||
    time(sourceCapturedAt) > time(generatedAt) || time(generatedAt) >= closingAt(event) ||
    entries?.length !== 6 || entries.some((e, i) => e.boat_no !== i + 1) ||
    (timing === 'previous_day' && entries.some(e => Object.keys(e).some(k =>
      /^(exhibition_|lap_time|turn_time|straight_time|official_)/.test(k))))) {
    throw new Error('A complete pre-closing prediction with explicit timing is required');
  }
  if (oddsSnapshot && (time(oddsSnapshot.captured_at) > time(sourceCapturedAt) ||
    oddsSnapshot.race_date !== event.race_date ||
    Number(oddsSnapshot.course_code) !== Number(event.course_code) ||
    Number(oddsSnapshot.race_no) !== Number(event.race_no))) {
    throw new Error('Odds snapshot does not precede this race prediction');
  }
  const tickets = selection.selected_tickets;
  const top = prediction.trinity.top_combination;
  const rawOdds = oddsSnapshot?.odds?.[top?.combination] ??
    oddsSnapshot?.odds?.[top?.combination?.replaceAll('-', '')];
  const topOdds = Number(rawOdds);
  const market = Number.isFinite(topOdds) && topOdds > 1 ? 1 / topOdds : null;
  return {
    prediction_id: randomUUID(), generated_at: generatedAt,
    source_captured_at: sourceCapturedAt, race_date: event.race_date,
    course_code: Number(event.course_code), race_no: Number(event.race_no),
    timing, engine_version: engineVersion, feature_version: TRINITY_FEATURE_VERSION,
    source_version: 'bs_race_entries_as_of_capture_v1',
    boat_features: entries, ichika_scores: prediction.specialists.ichika.ranking,
    hatsune_scores: prediction.specialists.hatsune.ranking,
    kiina_scores: prediction.specialists.kiina.ranking,
    trinity_scores: prediction.trinity.ranking,
    first_probabilities: prediction.trinity.first_place_probabilities,
    second_probabilities: prediction.trinity.second_place_scores,
    third_probabilities: prediction.trinity.third_place_scores,
    top_combination: top?.combination ?? null,
    top_combination_probability: top?.probability ?? null,
    selected_tickets: tickets, ticket_count: tickets.length,
    investment_yen: tickets.reduce((sum, t) => sum + Number(t.stake_yen ?? 100), 0),
    recommendation: tickets.length ? 'BUY' : 'PASS',
    strategy_tag: strategyTag, selection_reason: selection.reason,
    women_race: prediction.women_race,
    odds_snapshot_id: oddsSnapshot?.id ?? null,
    odds_captured_at: oddsSnapshot?.captured_at ?? null,
    market_implied_probability: market,
    trinity_probability: top?.probability ?? null,
    edge: market == null ? null : top.probability - market,
    expected_value: market == null ? null : top.probability * topOdds,
  };
}

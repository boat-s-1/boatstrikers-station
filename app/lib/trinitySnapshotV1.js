const FEATURES = ['national_win_rate', 'local_win_rate', 'motor_2_rate',
  'boat_2_rate', 'average_st'];

// Construct the prediction-time evidence before settlement. The caller must
// supply entries from a contemporaneous capture, not today's historical rows.
export function buildTrinityPredictionSnapshot({ predictionId, generatedAt,
  sourceCapturedAt, source, event, entries, prediction, oddsSnapshot = null,
  featureVersion = 'trinity-snapshot-v1' }) {
  const generated = Date.parse(generatedAt);
  const captured = Date.parse(sourceCapturedAt);
  const closingTime = event?.closing_time;
  const closes = closingTime && event.race_date ?
    Date.parse(`${event.race_date}T${closingTime}+09:00`) : NaN;
  if (!predictionId || !source || !Number.isFinite(generated) ||
    !Number.isFinite(captured) || !Number.isFinite(closes) ||
    captured > generated || generated >= closes) {
    throw new Error('Snapshot needs a real pre-closing capture and generation time');
  }
  if (!prediction?.ok || !['previous_day', 'after_exhibition'].includes(prediction.timing)) {
    throw new Error('A complete prediction and explicit timing are required');
  }
  if (!Array.isArray(entries) || entries.length !== 6 ||
    new Set(entries.map(e => Number(e.boat_no))).size !== 6 ||
    entries.some(e => ![1, 2, 3, 4, 5, 6].includes(Number(e.boat_no)))) {
    throw new Error('Six distinct boat entries are required');
  }
  for (const e of entries) {
    if (FEATURES.some(name => !Object.hasOwn(e, name)) ||
      (e.sex_code == null && e.gender == null && e.gender_code == null)) {
      throw new Error('Full pre-prediction feature and gender provenance is required');
    }
  }
  if (oddsSnapshot && (Date.parse(oddsSnapshot.captured_at) > generated ||
    oddsSnapshot.race_date !== event.race_date ||
    Number(oddsSnapshot.course_code) !== Number(event.course_code) ||
    Number(oddsSnapshot.race_no) !== Number(event.race_no))) {
    throw new Error('Odds must be captured before prediction for the same race');
  }
  const boatFeatures = [...entries].sort((a, b) => a.boat_no - b.boat_no).map(e => ({
    boat_no: Number(e.boat_no), national_win_rate: e.national_win_rate,
    local_win_rate: e.local_win_rate, motor_2_rate: e.motor_2_rate,
    boat_2_rate: e.boat_2_rate, average_st: e.average_st,
    sex_code: e.sex_code ?? null, gender: e.gender ?? null,
    gender_code: e.gender_code ?? null,
    ...(prediction.timing === 'after_exhibition' ? {
      exhibition_time: e.exhibition_time ?? null,
      exhibition_st: e.exhibition_st ?? null, lap_time: e.lap_time ?? null,
      turn_time: e.turn_time ?? null, straight_time: e.straight_time ?? null,
    } : {}),
  }));
  return {
    prediction_id: predictionId, generated_at: generatedAt,
    source_captured_at: sourceCapturedAt, race_date: event.race_date,
    course_code: Number(event.course_code), race_no: Number(event.race_no),
    timing: prediction.timing, feature_version: featureVersion,
    model_version: prediction.engine_version, source,
    boat_features: boatFeatures,
    ichika_scores: prediction.specialists.ichika.ranking,
    hatsune_scores: prediction.specialists.hatsune.ranking,
    kiina_scores: prediction.specialists.kiina.ranking,
    trinity_probabilities: prediction.trinity.first_place_probabilities,
    selected_tickets: prediction.trinity.selected_tickets,
    recommendation: prediction.trinity.selected_tickets.length ? 'buy' : 'pass',
    odds_snapshot_id: oddsSnapshot?.id ?? null,
  };
}

export async function insertTrinityPredictionSnapshot(supabase, snapshot) {
  // Plain insert only: an existing prediction_id fails rather than overwrites.
  const { data, error } = await supabase.from('trinity_prediction_snapshots')
    .insert(snapshot).select('id').single();
  if (error) throw error;
  return data.id;
}

// Experimental selection layer. Confidence must be frozen on a separate
// training set before this function is evaluated on later races.
export function selectTrinityV3(prediction, { minConfidence } = {}) {
  if (!prediction?.ok || !prediction.trinity?.selected_tickets?.length) {
    return { recommendation: 'pass', reason: 'v2_pass', selected_tickets: [] };
  }
  if (!Number.isFinite(minConfidence)) {
    throw new Error('minConfidence must be fitted on training data');
  }
  const top = prediction.trinity.top_combination;
  const kiinaTop = prediction.specialists.kiina.ranking[0]?.boat_no;
  const kiinaLed = Number(top?.first) === 5 ||
    (kiinaTop === 5 && top.combination.includes('5'));
  const firstPlace = prediction.trinity.first_place_probabilities;
  const firstBoat = Object.entries(firstPlace)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const ichikaLed = !prediction.women_race && !kiinaLed && Number(firstBoat) === 1;
  const confidence = Number(top?.probability || 0);
  if (!ichikaLed || confidence < minConfidence) {
    return { recommendation: 'pass', reason: !ichikaLed ? 'not_ichika_led' : 'low_confidence', selected_tickets: [] };
  }
  return { recommendation: 'candidate', reason: 'ichika_confidence',
    selected_tickets: prediction.trinity.selected_tickets,
    confidence, min_confidence: minConfidence };
}

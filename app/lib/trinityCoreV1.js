import { buildTrinityCoreV0 } from './trinityCoreV0.js';

function margin(ranking = []) {
  if (ranking.length < 2) return 0;
  return Number(ranking[0]?.probability || 0) - Number(ranking[1]?.probability || 0);
}

function top(ranking = []) {
  return ranking[0]?.boat_no ?? null;
}

export function buildTrinityCoreV1({ event = {}, entries = [], timing = 'previous_day', routing = {} }) {
  const base = buildTrinityCoreV0({ event, entries, timing });
  if (!base.ok) return { ...base, engine_version: 'trinity-core-v1' };

  const config = {
    agreementMargin: Number(routing.agreementMargin ?? 0.08),
    specialistMargin: Number(routing.specialistMargin ?? 0.12),
    kiinaBoat5Margin: Number(routing.kiinaBoat5Margin ?? 0.10),
    ...routing,
  };

  const i = base.specialists.ichika.ranking;
  const h = base.specialists.hatsune.ranking;
  const k = base.specialists.kiina.ranking;
  const iTop = top(i), hTop = top(h), kTop = top(k);
  const iMargin = margin(i), hMargin = margin(h), kMargin = margin(k);

  let route = 'ichika_default';
  let selected = 'ichika';
  let ranking = i;
  let confidence = iMargin;

  // v1 does not average specialists. It routes to the specialist whose domain condition is active.
  if (base.women_race && hMargin >= config.specialistMargin) {
    route = 'hatsune_women'; selected = 'hatsune'; ranking = h; confidence = hMargin;
  }
  if (kTop === 5 && kMargin >= config.kiinaBoat5Margin) {
    route = 'kiina_boat5'; selected = 'kiina'; ranking = k; confidence = kMargin;
  }

  const activeTops = base.women_race ? [iTop, hTop, kTop] : [iTop, kTop];
  const agreementCount = activeTops.filter((boat) => boat === ranking[0]?.boat_no).length;
  const strongAgreement = agreementCount >= 2 && confidence >= config.agreementMargin;
  const shouldPass = confidence < config.agreementMargin && agreementCount < 2;

  return {
    ...base,
    engine_version: 'trinity-core-v1',
    trinity_v0_reference: base.trinity,
    trinity: {
      strategy: 'specialist_router',
      route,
      selected_specialist: selected,
      ranking,
      top_boat: ranking[0]?.boat_no ?? null,
      top_probability: ranking[0]?.probability ?? null,
      confidence_margin: confidence,
      agreement_count: agreementCount,
      strong_agreement: strongAgreement,
      recommendation: shouldPass ? 'pass' : 'candidate',
    },
    routing_config: config,
    notes: [
      'v1 routes to a specialist instead of averaging all three specialists',
      'thresholds are hypotheses and must be selected on TRAIN only',
      'VALIDATION selects among frozen candidate configurations',
      'TEST remains untouched until the routing rule is frozen',
    ],
  };
}

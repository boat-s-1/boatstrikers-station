import { buildTrinityCoreV0 } from './trinityCoreV0.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function normalizeMap(map) {
  const sum = Object.values(map).reduce((a, b) => a + b, 0);
  if (!sum) return map;
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v / sum]));
}

function rankingMap(ranking = []) {
  return Object.fromEntries(ranking.map((r) => [Number(r.boat_no), Number(r.probability || 0)]));
}

function conditionalProb(map, excluded) {
  const filtered = Object.fromEntries(Object.entries(map).filter(([boat]) => !excluded.has(Number(boat))));
  return normalizeMap(filtered);
}

export function buildTrinityCoreV2({ event = {}, entries = [], timing = 'previous_day', ticketConfig = {} }) {
  const base = buildTrinityCoreV0({ event, entries, timing });
  if (!base.ok) return { ...base, engine_version: 'trinity-core-v2' };

  const cfg = {
    maxTickets: Number(ticketConfig.maxTickets ?? 5),
    minTicketProbability: Number(ticketConfig.minTicketProbability ?? 0.018),
    minTopTicketProbability: Number(ticketConfig.minTopTicketProbability ?? 0.035),
    maxProbabilityMass: Number(ticketConfig.maxProbabilityMass ?? 0.34),
    kiinaPlaceBoost: Number(ticketConfig.kiinaPlaceBoost ?? 0.22),
    hatsunePlaceBoost: Number(ticketConfig.hatsunePlaceBoost ?? 0.12),
    ...ticketConfig,
  };

  const ichika = rankingMap(base.specialists.ichika.ranking);
  const hatsune = rankingMap(base.specialists.hatsune.ranking);
  const kiina = rankingMap(base.specialists.kiina.ranking);

  // 1st place deliberately remains Ichika-led after v0/v1 tests showed dilution hurt top-pick accuracy.
  const first = normalizeMap(Object.fromEntries([1,2,3,4,5,6].map((b) => [b, ichika[b] || 0])));

  // Place scores blend common strength with domain specialists. Hatsune contributes more in women's races;
  // Kiina primarily boosts boat 5 as a 2nd/3rd-place or upset component rather than replacing the first-place anchor.
  const secondRaw = {};
  const thirdRaw = {};
  for (const b of [1,2,3,4,5,6]) {
    const hWeight = base.women_race ? cfg.hatsunePlaceBoost : 0.04;
    const kBoost = b === 5 ? cfg.kiinaPlaceBoost : 0;
    secondRaw[b] = (ichika[b] || 0) * (0.70 - hWeight) + (hatsune[b] || 0) * hWeight + (kiina[b] || 0) * 0.10 + kBoost;
    thirdRaw[b] = (ichika[b] || 0) * (0.55 - hWeight) + (hatsune[b] || 0) * hWeight + (kiina[b] || 0) * 0.20 + kBoost * 1.15;
  }
  const second = normalizeMap(secondRaw);
  const third = normalizeMap(thirdRaw);

  const combinations = [];
  for (const a of [1,2,3,4,5,6]) {
    const secondConditional = conditionalProb(second, new Set([a]));
    for (const b of [1,2,3,4,5,6]) {
      if (b === a) continue;
      const thirdConditional = conditionalProb(third, new Set([a,b]));
      for (const c of [1,2,3,4,5,6]) {
        if (c === a || c === b) continue;
        const probability = (first[a] || 0) * (secondConditional[b] || 0) * (thirdConditional[c] || 0);
        combinations.push({ combination: `${a}-${b}-${c}`, first: a, second: b, third: c, probability });
      }
    }
  }
  combinations.sort((a,b) => b.probability - a.probability);

  const topProbability = combinations[0]?.probability || 0;
  const candidate = topProbability >= cfg.minTopTicketProbability;
  const tickets = [];
  let mass = 0;
  if (candidate) {
    for (const combo of combinations) {
      if (tickets.length >= cfg.maxTickets) break;
      if (combo.probability < cfg.minTicketProbability) break;
      if (tickets.length > 0 && mass + combo.probability > cfg.maxProbabilityMass) break;
      tickets.push({ ...combo, stake_yen: 100 });
      mass += combo.probability;
    }
  }

  return {
    ...base,
    engine_version: 'trinity-core-v2',
    trinity: {
      strategy: 'ichika_anchor_place_specialists',
      first_place_probabilities: first,
      second_place_scores: second,
      third_place_scores: third,
      combinations,
      top_combination: combinations[0] || null,
      selected_tickets: tickets,
      ticket_count: tickets.length,
      investment_yen: tickets.length * 100,
      selected_probability_mass: Number(mass.toFixed(6)),
      recommendation: tickets.length ? 'candidate' : 'pass',
    },
    ticket_config: cfg,
    notes: [
      'v2 generates all 120 ordered trifecta combinations internally',
      'first-place probability is Ichika-led; Hatsune and Kiina mainly adjust place ordering',
      'ticket thresholds are hypotheses for TRAIN/VALIDATION selection and are not claims of profitability',
      'no odds or race results are used to generate tickets',
      'no database writes',
    ],
  };
}

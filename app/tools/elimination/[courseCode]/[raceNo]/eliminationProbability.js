const POSITION_PRIORS = {
  first: [0, 0.5487, 0.1344, 0.1268, 0.0999, 0.0596, 0.0305],
  second: [0, 0.1699, 0.2496, 0.2168, 0.1621, 0.1222, 0.0794],
  third: [0, 0.0898, 0.1878, 0.1978, 0.1937, 0.1782, 0.1528],
};

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boatNo(entry) {
  return Number(entry?.boat_no ?? entry?.teiban ?? entry?.boatNo);
}

function valueOf(entry, keys) {
  for (const key of keys) {
    const value = finite(entry?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function zScores(entries, keys, invert = false) {
  const rows = entries
    .map((entry) => ({ boat: boatNo(entry), value: valueOf(entry, keys) }))
    .filter((row) => row.boat >= 1 && row.boat <= 6 && row.value !== null);
  if (!rows.length) return {};
  const mean = rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  const variance = rows.reduce((sum, row) => sum + (row.value - mean) ** 2, 0) / rows.length;
  const sd = Math.sqrt(variance);
  if (!sd) return Object.fromEntries(rows.map((row) => [row.boat, 0]));
  return Object.fromEntries(rows.map((row) => [row.boat, (invert ? mean - row.value : row.value - mean) / sd]));
}

function featureMaps(entries) {
  return {
    win: zScores(entries, ["national_win_rate", "win_rate", "racer_win_rate"]),
    local: zScores(entries, ["local_win_rate", "local_rate"]),
    motor: zScores(entries, ["motor_2_rate", "motor_top2_rate", "motor_2ren_rate", "motor_rate"]),
    exhibition: zScores(entries, ["exhibition_time", "official_exhibition_time", "tenji_time"], true),
    exhibitionSt: zScores(entries, ["exhibition_st", "official_exhibition_st", "api_exhibition_st"], true),
  };
}

const COEFFICIENTS = {
  pre: {
    first: { lane: 1.0, win: 0.35, local: 0.15, motor: 0.10, exhibition: 0, exhibitionSt: 0 },
    second: { lane: 0.95, win: 0.26, local: 0.10, motor: 0.08, exhibition: 0, exhibitionSt: 0 },
    third: { lane: 0.95, win: 0.16, local: 0.08, motor: 0.05, exhibition: 0, exhibitionSt: 0 },
  },
  live: {
    first: { lane: 0.95, win: 0.40, local: 0.15, motor: 0.10, exhibition: 0.25, exhibitionSt: 0.10 },
    second: { lane: 0.95, win: 0.28, local: 0.10, motor: 0.08, exhibition: 0.18, exhibitionSt: 0.06 },
    third: { lane: 0.95, win: 0.18, local: 0.08, motor: 0.05, exhibition: 0.12, exhibitionSt: 0.04 },
  },
};

function positionWeights(entries, position, mode, maps) {
  const coefficients = COEFFICIENTS[mode][position];
  const priors = POSITION_PRIORS[position];
  const out = {};
  for (const entry of entries) {
    const boat = boatNo(entry);
    if (!(boat >= 1 && boat <= 6)) continue;
    const prior = Math.max(priors[boat] || 0.001, 0.001);
    const score =
      coefficients.lane * Math.log(prior) +
      coefficients.win * (maps.win[boat] || 0) +
      coefficients.local * (maps.local[boat] || 0) +
      coefficients.motor * (maps.motor[boat] || 0) +
      coefficients.exhibition * (maps.exhibition[boat] || 0) +
      coefficients.exhibitionSt * (maps.exhibitionSt[boat] || 0);
    out[boat] = Math.exp(score);
  }
  return out;
}

export function buildTrifectaProbabilities(entries, { live = false } = {}) {
  if (!Array.isArray(entries) || entries.length < 6) return {};
  const maps = featureMaps(entries);
  const mode = live ? "live" : "pre";
  const w1 = positionWeights(entries, "first", mode, maps);
  const w2 = positionWeights(entries, "second", mode, maps);
  const w3 = positionWeights(entries, "third", mode, maps);
  const boats = [1, 2, 3, 4, 5, 6];
  const sum1 = boats.reduce((sum, boat) => sum + (w1[boat] || 0), 0);
  const sum2 = boats.reduce((sum, boat) => sum + (w2[boat] || 0), 0);
  const sum3 = boats.reduce((sum, boat) => sum + (w3[boat] || 0), 0);
  if (!sum1 || !sum2 || !sum3) return {};

  const probabilities = {};
  for (const first of boats) {
    for (const second of boats) {
      if (second === first) continue;
      for (const third of boats) {
        if (third === first || third === second) continue;
        const p1 = w1[first] / sum1;
        const p2 = w2[second] / Math.max(sum2 - w2[first], 1e-12);
        const p3 = w3[third] / Math.max(sum3 - w3[first] - w3[second], 1e-12);
        probabilities[`${first}-${second}-${third}`] = p1 * p2 * p3;
      }
    }
  }
  return probabilities;
}

export function probabilityFor(probabilities, bet) {
  const value = Number(probabilities?.[bet.join("-")]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

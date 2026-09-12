const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  const valid = values.map(finite).filter((v) => v !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function normalized(value, min, max, fallback = 0.5) {
  const n = finite(value);
  if (n === null || max <= min) return fallback;
  return clamp((n - min) / (max - min), 0, 1);
}

function grade(score) {
  if (score >= 88) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function dangerLabel(score) {
  const danger = 100 - score;
  if (danger <= 15) return "低";
  if (danger <= 28) return "やや低";
  if (danger <= 42) return "中";
  if (danger <= 58) return "やや高";
  return "高";
}

function entryBasePower(entry) {
  const national = normalized(entry.national_win_rate, 2.5, 8.0);
  const local = normalized(entry.local_win_rate, 2.5, 8.0);
  const motor = normalized(entry.motor_2_rate, 20, 55);
  const boat = normalized(entry.boat_2_rate, 20, 55);
  const averageSt = finite(entry.average_st);
  const st = averageSt === null ? 0.5 : clamp((0.24 - averageSt) / 0.16, 0, 1);
  const course = Number(entry.boat_no) === 1 ? 1 : clamp(0.76 - (Number(entry.boat_no) - 2) * 0.10, 0.2, 0.76);

  return (
    national * 0.28 +
    local * 0.18 +
    motor * 0.18 +
    boat * 0.08 +
    st * 0.18 +
    course * 0.10
  );
}

function exhibitionPower(entry, entries) {
  const times = entries.map((e) => finite(e.exhibition_time)).filter((v) => v !== null);
  const starts = entries.map((e) => finite(e.exhibition_st)).filter((v) => v !== null);
  const laps = entries.map((e) => finite(e.official_lap ?? e.lap_time)).filter((v) => v !== null);
  const turns = entries.map((e) => finite(e.official_turn ?? e.turn_time)).filter((v) => v !== null);
  const straights = entries.map((e) => finite(e.official_straight ?? e.straight_time)).filter((v) => v !== null);

  const lowerIsBetter = (value, values, fallback = 0.5) => {
    const n = finite(value);
    if (n === null || !values.length) return fallback;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 0.5;
    return clamp((max - n) / (max - min), 0, 1);
  };

  const mark = String(entry.exhibition_fl || "").toUpperCase();
  const flyingPenalty = mark.includes("F") ? 0.08 : 0;

  return clamp(
    lowerIsBetter(entry.exhibition_time, times) * 0.30 +
      lowerIsBetter(Math.abs(finite(entry.exhibition_st) ?? 0.20), starts.map(Math.abs)) * 0.24 +
      lowerIsBetter(entry.official_lap ?? entry.lap_time, laps) * 0.18 +
      lowerIsBetter(entry.official_turn ?? entry.turn_time, turns) * 0.18 +
      lowerIsBetter(entry.official_straight ?? entry.straight_time, straights) * 0.10 -
      flyingPenalty,
    0,
    1
  );
}

function marksFromPower(entries, powerMap) {
  return [...entries]
    .sort((a, b) => (powerMap.get(Number(b.boat_no)) ?? 0) - (powerMap.get(Number(a.boat_no)) ?? 0))
    .slice(0, 3)
    .map((entry, index) => ({
      mark: ["◎", "○", "▲"][index],
      boat_no: Number(entry.boat_no),
      racer_name: entry.racer_name || "",
    }));
}

function targetBetCount(score) {
  const value = finite(score) ?? 60;
  if (value >= 88) return 4;
  if (value >= 80) return 5;
  if (value >= 72) return 6;
  if (value >= 64) return 7;
  return 8;
}

function confidenceLabel(index) {
  if (index === 0) return "本線";
  if (index <= 2) return "対抗";
  return "押さえ";
}

function buildBets(score, marks) {
  const marked = marks
    .map((m) => Number(m?.boat_no))
    .filter((boatNo, index, values) => boatNo >= 1 && boatNo <= 6 && values.indexOf(boatNo) === index);
  const rankedBoats = [...marked, ...[1, 2, 3, 4, 5, 6].filter((boatNo) => !marked.includes(boatNo))];
  const [first = 1, second = 2, third = 3, fourth = 4, fifth = 5] = rankedBoats;
  const target = targetBetCount(score);
  const candidates = [];
  const seen = new Set();

  const add = (a, b, c) => {
    if (![a, b, c].every((boatNo) => Number.isInteger(boatNo) && boatNo >= 1 && boatNo <= 6)) return;
    if (a === b || a === c || b === c) return;
    const bet = `${a}-${b}-${c}`;
    if (seen.has(bet)) return;
    seen.add(bet);
    candidates.push(bet);
  };

  // 最低4点は「本命頭 × 対抗2着」の3着流し。
  // 例: 本命1・対抗2なら 1-2-3456 の4点になる。
  rankedBoats
    .filter((boatNo) => boatNo !== first && boatNo !== second)
    .forEach((thirdBoat) => add(first, second, thirdBoat));

  // 5〜8点目はAI評価順に相手替わりを追加する。
  add(first, third, second);
  add(first, third, fourth);
  add(first, fourth, second);
  add(second, first, third);
  add(first, fourth, third);
  add(first, fifth, second);
  add(third, first, second);

  return candidates.slice(0, target).map((bet, index) => ({
    bet,
    confidence: confidenceLabel(index),
  }));
}

function buildComment({ score, marks, factors, isLive, delta }) {
  const head = marks[0]?.boat_no ?? 1;
  const rival = marks[1]?.boat_no ?? 2;
  let text = `${head}号艇を中心評価。${rival}号艇が相手筆頭です。`;

  if (head === 1 && score >= 78) text = `1号艇のイン優位が大きく、逃げ中心の組み立てです。${rival}号艇を相手筆頭に評価します。`;
  else if (head !== 1) text = `1号艇の信頼度は控えめ。${head}号艇の総合力を最上位に評価しました。`;

  if (isLive) {
    if (delta >= 4) text += " 展示内容が良く、前日版から評価を上げています。";
    else if (delta <= -4) text += " 展示気配に不安があり、前日版から評価を下げています。";
    else text += " 展示後も大きな評価変更はありません。";
  } else if (factors.motor >= 0.62) {
    text += " モーター成績もプラス材料です。";
  }

  return text;
}

export function buildPhase2Predictions({ event, entries = [] }) {
  if (!Array.isArray(entries) || entries.length < 2) {
    return { previousPrediction: null, livePrediction: null };
  }

  const basePowerMap = new Map(entries.map((entry) => [Number(entry.boat_no), entryBasePower(entry)]));
  const marks = marksFromPower(entries, basePowerMap);
  const lane1 = entries.find((entry) => Number(entry.boat_no) === 1) ?? entries[0];
  const lane1Power = basePowerMap.get(Number(lane1.boat_no)) ?? 0.5;
  const rivals = entries.filter((e) => Number(e.boat_no) !== Number(lane1.boat_no));
  const rivalAverage = average(rivals.map((e) => basePowerMap.get(Number(e.boat_no)))) ?? 0.5;

  const national = normalized(lane1.national_win_rate, 2.5, 8.0);
  const local = normalized(lane1.local_win_rate, 2.5, 8.0);
  const motor = normalized(lane1.motor_2_rate, 20, 55);
  const stRaw = finite(lane1.average_st);
  const start = stRaw === null ? 0.5 : clamp((0.24 - stRaw) / 0.16, 0, 1);
  const wind = finite(event?.wind_speed);
  const weatherPenalty = wind === null ? 0 : clamp((wind - 3) * 1.6, 0, 10);

  const previousScore = Math.round(clamp(52 + (lane1Power - rivalAverage) * 48 + national * 10 + local * 5 - weatherPenalty, 35, 94));
  const previousFactors = {
    national: Math.round(national * 100),
    local: Math.round(local * 100),
    motor: Math.round(motor * 100),
    start: Math.round(start * 100),
  };
  const previousBets = buildBets(previousScore, marks);

  const previousPrediction = {
    timing: "previous_day",
    score: previousScore,
    rank: grade(previousScore),
    main_boat: marks[0]?.boat_no ?? 1,
    danger_level: dangerLabel(previousScore),
    danger_score: 100 - previousScore,
    marks,
    bet_json: previousBets,
    bet_count: previousBets.length,
    bet_count_rule: "variable_4_to_8",
    factors: previousFactors,
    comment_text: buildComment({ score: previousScore, marks, factors: { motor }, isLive: false, delta: 0 }),
    generated_at: new Date().toISOString(),
    engine_version: "phase2-v14",
    source: "phase2_fallback",
  };

  const hasExhibition = entries.some((entry) => [entry.exhibition_time, entry.exhibition_st, entry.official_lap, entry.lap_time].some((v) => finite(v) !== null));
  if (!hasExhibition) return { previousPrediction, livePrediction: null };

  const livePowerMap = new Map(
    entries.map((entry) => {
      const base = basePowerMap.get(Number(entry.boat_no)) ?? 0.5;
      const exhibition = exhibitionPower(entry, entries);
      return [Number(entry.boat_no), base * 0.64 + exhibition * 0.36];
    })
  );
  const liveMarks = marksFromPower(entries, livePowerMap);
  const lane1Exhibition = exhibitionPower(lane1, entries);
  const rivalExhibition = average(rivals.map((entry) => exhibitionPower(entry, entries))) ?? 0.5;
  const delta = Math.round(clamp((lane1Exhibition - rivalExhibition) * 22, -12, 12));
  const liveScore = Math.round(clamp(previousScore + delta, 30, 96));
  const liveBets = buildBets(liveScore, liveMarks);

  const livePrediction = {
    timing: "after_exhibition",
    score: liveScore,
    score_before: previousScore,
    score_delta: liveScore - previousScore,
    rank: grade(liveScore),
    main_boat: liveMarks[0]?.boat_no ?? 1,
    danger_level: dangerLabel(liveScore),
    danger_score: 100 - liveScore,
    marks: liveMarks,
    bet_json: liveBets,
    bet_count: liveBets.length,
    bet_count_rule: "variable_4_to_8",
    factors: {
      ...previousFactors,
      exhibition: Math.round(lane1Exhibition * 100),
    },
    comment_text: buildComment({ score: liveScore, marks: liveMarks, factors: { motor }, isLive: true, delta }),
    generated_at: new Date().toISOString(),
    engine_version: "phase2-v14",
    source: "phase2_fallback",
  };

  return { previousPrediction, livePrediction };
}

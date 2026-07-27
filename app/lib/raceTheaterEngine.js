const BOAT_COLORS = {
  1: { main: "#ffffff", edge: "#d5dbe0", text: "#111111" },
  2: { main: "#303840", edge: "#111820", text: "#ffffff" },
  3: { main: "#e74b43", edge: "#9f2924", text: "#ffffff" },
  4: { main: "#3c91df", edge: "#1967aa", text: "#ffffff" },
  5: { main: "#f0d748", edge: "#bca525", text: "#222222" },
  6: { main: "#58b56a", edge: "#2e7f3d", text: "#ffffff" },
};

const toNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const normalizeName = (value) =>
  String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const easeInOut = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const lerp = (a, b, t) => a + (b - a) * t;

function cubicBezier(p0, p1, p2, p3, t) {
  const oneMinusT = 1 - t;
  const x =
    oneMinusT ** 3 * p0.x +
    3 * oneMinusT ** 2 * t * p1.x +
    3 * oneMinusT * t ** 2 * p2.x +
    t ** 3 * p3.x;
  const y =
    oneMinusT ** 3 * p0.y +
    3 * oneMinusT ** 2 * t * p1.y +
    3 * oneMinusT * t ** 2 * p2.y +
    t ** 3 * p3.y;

  return { x, y };
}

function angleBetween(a, b) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function rankMap(entries, key, ascending = false) {
  const sorted = entries
    .filter((row) => toNumber(row[key]) !== null)
    .sort((a, b) => {
      const av = toNumber(a[key], ascending ? 999 : -999);
      const bv = toNumber(b[key], ascending ? 999 : -999);
      return ascending ? av - bv : bv - av;
    });

  return new Map(
    sorted.map((row, index) => [Number(row.boat_no), index + 1])
  );
}

function rankScore(rank) {
  if (!rank) return 50;
  return ((7 - rank) / 6) * 100;
}

function normalizeProbability(value) {
  const number = toNumber(value, null);
  if (number === null) return null;
  return number <= 1 ? number * 100 : number;
}

function buildBoatAbility(entries) {
  const nationalRank = rankMap(entries, "national_win_rate");
  const localRank = rankMap(entries, "local_win_rate");
  const motorRank = rankMap(entries, "motor_2_rate");
  const boatRank = rankMap(entries, "boat_2_rate");
  const exhibitionRank = rankMap(entries, "exhibition_time", true);
  const stRank = rankMap(entries, "exhibition_st", true);
  const turnRank = rankMap(entries, "turn_time", true);
  const straightRank = rankMap(entries, "straight_time", true);

  return entries
    .map((entry) => {
      const boatNo = Number(entry.boat_no || entry.teiban);
      const national = nationalRank.get(boatNo) || null;
      const local = localRank.get(boatNo) || null;
      const motor = motorRank.get(boatNo) || null;
      const boat = boatRank.get(boatNo) || null;
      const exhibition = exhibitionRank.get(boatNo) || null;
      const st = stRank.get(boatNo) || null;
      const turn = turnRank.get(boatNo) || null;
      const straight = straightRank.get(boatNo) || null;

      const exhibitionAvailable =
        toNumber(entry.exhibition_time) !== null ||
        toNumber(entry.exhibition_st) !== null;

      const course = Number(
        entry.exhibition_course || entry.actual_course || entry.course || boatNo
      );
      const courseBonus = course === 1 ? 13 : course === 2 ? 7 : course === 3 ? 4 : course === 4 ? 2 : 0;

      const baseAbility =
        rankScore(national) * 0.23 +
        rankScore(local) * 0.14 +
        rankScore(motor) * 0.19 +
        rankScore(boat) * 0.08 +
        rankScore(turn) * 0.08 +
        rankScore(straight) * 0.08 +
        (exhibitionAvailable
          ? rankScore(exhibition) * 0.13 + rankScore(st) * 0.07
          : 10) +
        courseBonus;

      const ability = clamp(baseAbility);
      const exhibitionSt = toNumber(entry.exhibition_st, null);
      const averageSt = toNumber(entry.average_st, null);
      const predictedSt = clamp(
        exhibitionSt !== null
          ? exhibitionSt * 0.62 + (averageSt ?? 0.16) * 0.38
          : averageSt ?? 0.16,
        0.01,
        0.35
      );
      const startPower = clamp(108 - predictedSt * 245 + ability * 0.2);
      const turnPower = clamp(rankScore(turn) * 0.56 + ability * 0.44);
      const stretchPower = clamp(rankScore(straight) * 0.58 + startPower * 0.42);

      return {
        boatNo,
        racerName: normalizeName(entry.racer_name),
        racerClass: entry.racer_class || entry.class || "-",
        ability: Math.round(ability),
        startPower: Math.round(startPower),
        turnPower: Math.round(turnPower),
        stretchPower: Math.round(stretchPower),
        predictedSt: Number(predictedSt.toFixed(2)),
        exhibitionTime: toNumber(entry.exhibition_time, null),
        exhibitionSt,
        motorRate: toNumber(entry.motor_2_rate, null),
        localRate: toNumber(entry.local_win_rate, null),
        course,
      };
    })
    .filter((boat) => Number.isInteger(boat.boatNo) && boat.boatNo >= 1 && boat.boatNo <= 6)
    .sort((a, b) => a.boatNo - b.boatNo);
}

function decideAttackBoat(boats) {
  return (
    boats
      .filter((boat) => boat.course !== 1)
      .map((boat) => {
        let attack =
          boat.ability * 0.34 +
          boat.startPower * 0.29 +
          boat.turnPower * 0.22 +
          boat.stretchPower * 0.15;

        if (boat.course === 2) attack += 5;
        if (boat.course === 3) attack += 8;
        if (boat.course === 4) attack += 5;
        if (boat.course >= 5) attack -= 2;

        return { ...boat, attack };
      })
      .sort((a, b) => b.attack - a.attack)[0] || null
  );
}

function normalizeFourProbabilities(values) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const rounded = values.map((value) => Math.round((Math.max(0, value) / total) * 100));
  const difference = 100 - rounded.reduce((sum, value) => sum + value, 0);
  rounded[0] += difference;
  return rounded;
}

function getManeuverForBoat(boat, scenario, attackBoatNo) {
  if (boat.course === 1) return scenario === "escape" ? "escape" : "resist";
  if (boat.boatNo === attackBoatNo) return scenario;
  if (boat.course === 2) return "sashi";
  if (boat.course === 3 || boat.course === 4) return "makuriSashi";
  return "follow";
}

function buildEvidence({ boatOne, attackBoat, escape, windSpeed, waveHeight }) {
  const evidence = [];

  if (boatOne) {
    evidence.push(`1号艇の予測ST ${boatOne.predictedSt.toFixed(2)}`);
    evidence.push(`1号艇の旋回指数 ${boatOne.turnPower}`);
  }
  if (attackBoat) {
    evidence.push(`${attackBoat.boatNo}号艇の攻撃指数 ${Math.round(attackBoat.attack)}`);
  }
  if (windSpeed > 0) evidence.push(`風速 ${windSpeed}m`);
  if (waveHeight > 0) evidence.push(`波高 ${waveHeight}cm`);
  evidence.push(`逃げ期待度 ${Math.round(escape)}%`);

  return evidence.slice(0, 5);
}

export function buildRaceTheaterModel({
  entries = [],
  event = null,
  previousPrediction = null,
  livePrediction = null,
}) {
  const boats = buildBoatAbility(entries);
  const boatOne = boats.find((boat) => boat.course === 1) || boats.find((boat) => boat.boatNo === 1);
  const attackBoat = decideAttackBoat(boats);
  const prediction = livePrediction || previousPrediction;
  const aiEscape = normalizeProbability(
    prediction?.escapeProbability ?? prediction?.escape_probability ?? prediction?.score
  );

  const windSpeed = toNumber(event?.wind_speed, 0);
  const waveHeight = toNumber(event?.wave_height, 0);

  let escape =
    aiEscape ??
    ((boatOne?.ability || 50) * 0.48 +
      (boatOne?.startPower || 50) * 0.31 +
      (boatOne?.turnPower || 50) * 0.21);

  escape -= Math.min(windSpeed * 1.45, 10);
  escape -= Math.min(waveHeight * 0.85, 6);

  if (attackBoat) {
    escape -= Math.max(0, attackBoat.attack - 68) * 0.22;
  }

  escape = clamp(escape, 16, 94);
  const remaining = 100 - escape;
  const attackNo = attackBoat?.boatNo || 2;

  let sashi = remaining * (attackBoat?.course === 2 ? 0.58 : 0.38);
  let makuri = remaining * ([3, 4].includes(attackBoat?.course) ? 0.43 : 0.29);
  let makuriSashi = remaining - sashi - makuri;

  const [escapeP, sashiP, makuriP, makuriSashiP] = normalizeFourProbabilities([
    escape,
    sashi,
    makuri,
    makuriSashi,
  ]);

  const scenario =
    escapeP >= Math.max(sashiP, makuriP, makuriSashiP)
      ? "escape"
      : sashiP >= Math.max(makuriP, makuriSashiP)
      ? "sashi"
      : makuriP >= makuriSashiP
      ? "makuri"
      : "makuriSashi";

  const sortedForFinish = [...boats].sort((a, b) => {
    const aScenarioBonus =
      a.course === 1 && scenario === "escape"
        ? escapeP * 0.48
        : a.boatNo === attackNo
        ? (100 - escapeP) * 0.54
        : 0;
    const bScenarioBonus =
      b.course === 1 && scenario === "escape"
        ? escapeP * 0.48
        : b.boatNo === attackNo
        ? (100 - escapeP) * 0.54
        : 0;

    const aScore = a.ability * 0.46 + a.startPower * 0.19 + a.turnPower * 0.24 + a.stretchPower * 0.11 + aScenarioBonus;
    const bScore = b.ability * 0.46 + b.startPower * 0.19 + b.turnPower * 0.24 + b.stretchPower * 0.11 + bScenarioBonus;
    return bScore - aScore;
  });

  const leaderNo = scenario === "escape" ? boatOne?.boatNo || 1 : attackNo;
  const finishOrder = [
    boats.find((boat) => boat.boatNo === leaderNo),
    ...sortedForFinish.filter((boat) => boat.boatNo !== leaderNo),
  ]
    .filter(Boolean)
    .map((boat) => boat.boatNo);

  const entryOrder = [...boats]
    .sort((a, b) => a.course - b.course)
    .map((boat) => boat.boatNo);

  const boatsWithManeuver = boats.map((boat) => ({
    ...boat,
    maneuver: getManeuverForBoat(boat, scenario, attackNo),
  }));

  const scenarioLabels = {
    escape: "逃げ",
    sashi: "差し",
    makuri: "まくり",
    makuriSashi: "まくり差し",
  };

  const mainComment =
    scenario === "escape"
      ? `1号艇が先マイ。内側を締めながらバック先頭へ抜ける想定です。`
      : scenario === "sashi"
      ? `${attackNo}号艇が1号艇の懐へ差し込み、出口で並ぶ想定です。`
      : scenario === "makuri"
      ? `${attackNo}号艇がスタート優位から外を握って攻める想定です。`
      : `${attackNo}号艇が攻め艇の内側を突く、まくり差し想定です。`;

  return {
    boats: boatsWithManeuver,
    scenario,
    scenarioLabel: scenarioLabels[scenario],
    attackBoatNo: attackNo,
    leaderBoatNo: leaderNo,
    entryOrder,
    finishOrder,
    probabilities: {
      escape: escapeP,
      sashi: sashiP,
      makuri: makuriP,
      makuriSashi: makuriSashiP,
    },
    mainComment,
    evidence: buildEvidence({ boatOne, attackBoat, escape: escapeP, windSpeed, waveHeight }),
    environment: { windSpeed, waveHeight },
    predictionMode: livePrediction ? "live" : "previous",
  };
}

function getCourseIndex(model, boatNo) {
  const index = model.entryOrder.indexOf(boatNo);
  return index >= 0 ? index : Math.max(0, boatNo - 1);
}

function getFinishIndex(model, boatNo) {
  const index = model.finishOrder.indexOf(boatNo);
  return index >= 0 ? index : Math.max(0, boatNo - 1);
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function catmullRomDerivative(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return {
    x: 0.5 * ((-p0.x + p2.x) +
      2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t +
      3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2),
    y: 0.5 * ((-p0.y + p2.y) +
      2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t +
      3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2),
  };
}

function smoothStep(t) {
  const value = clamp(t, 0, 1);
  return value * value * (3 - 2 * value);
}

function buildRouteKnots(model, boat) {
  const courseIndex = getCourseIndex(model, boat.boatNo);
  const finishIndex = getFinishIndex(model, boat.boatNo);
  const laneY = 72 + courseIndex * 45;
  const startGain = (boat.startPower - 50) * 0.23;
  const stretchGain = (boat.stretchPower - 50) * 0.22;
  const turnGain = (boat.turnPower - 50) * 0.12;

  const approachY = 247 + courseIndex * 9;
  const approachX = 454 + stretchGain * 0.15 - courseIndex * 1.5;

  const turnExitByManeuver = {
    escape: { x: 590 + turnGain, y: 91 + finishIndex * 31 },
    resist: { x: 584 + turnGain, y: 108 + finishIndex * 31 },
    sashi: { x: 575 + turnGain, y: 92 + finishIndex * 31 },
    makuri: { x: 619 + turnGain, y: 116 + finishIndex * 31 },
    makuriSashi: { x: 593 + turnGain, y: 101 + finishIndex * 31 },
    follow: { x: 608 + turnGain, y: 137 + finishIndex * 31 },
  };

  const exit = turnExitByManeuver[boat.maneuver] || turnExitByManeuver.follow;

  // 旋回中に艇同士が完全に重ならないよう、コースと着順から僅かに分離します。
  const separation = (courseIndex - finishIndex) * 3.2;

  return [
    { x: 76, y: laneY },
    { x: 202 + startGain, y: laneY },
    {
      x: 343 + stretchGain,
      y: 172 + courseIndex * 19 - startGain * 0.05,
    },
    { x: approachX, y: approachY + separation },
    { x: exit.x, y: exit.y + separation },
    { x: 666 - finishIndex * 2, y: 68 + finishIndex * 43 },
    { x: 676 - finishIndex * 2, y: 68 + finishIndex * 43 },
  ];
}

function getSplinePose(knots, segment, progress) {
  const maxSegment = knots.length - 2;
  const safeSegment = Math.max(0, Math.min(segment, maxSegment));
  const p1 = knots[safeSegment];
  const p2 = knots[safeSegment + 1];
  const p0 = knots[Math.max(0, safeSegment - 1)];
  const p3 = knots[Math.min(knots.length - 1, safeSegment + 2)];
  const t = smoothStep(progress);
  const point = catmullRom(p0, p1, p2, p3, t);
  const velocity = catmullRomDerivative(p0, p1, p2, p3, t);
  const angle = Math.atan2(velocity.y, velocity.x) * 180 / Math.PI;
  return { ...point, angle };
}

export function getBoatPose(model, boatNo, stage, progress) {
  const boat = model.boats.find((row) => row.boatNo === boatNo);
  if (!boat) return { x: 70, y: 80, angle: 0 };

  const knots = buildRouteKnots(model, boat);

  if (stage <= 0) {
    return { ...knots[0], angle: 0 };
  }

  if (stage >= 6) {
    return { ...knots[6], angle: 0 };
  }

  // stage 1〜5 を連続スプラインの segment 0〜4 に対応させます。
  return getSplinePose(knots, stage - 1, progress);
}

export function getBoatTrailPath(model, boatNo, stage, progress) {
  if (stage < 1) return "";

  const points = [];
  const completedSegments = Math.max(0, Math.min(stage - 1, 5));
  const samplesPerSegment = 18;

  for (let segment = 0; segment < completedSegments; segment += 1) {
    for (let index = 0; index <= samplesPerSegment; index += 1) {
      const pose = getBoatPose(model, boatNo, segment + 1, index / samplesPerSegment);
      points.push(pose);
    }
  }

  if (stage <= 5) {
    const currentSamples = Math.max(1, Math.ceil(samplesPerSegment * clamp(progress, 0, 1)));
    for (let index = 0; index <= currentSamples; index += 1) {
      const localProgress = (index / currentSamples) * clamp(progress, 0, 1);
      points.push(getBoatPose(model, boatNo, stage, localProgress));
    }
  }

  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

export function getBoatColor(boatNo) {
  return BOAT_COLORS[Number(boatNo)] || BOAT_COLORS[1];
}

export function getStageLabel(stage) {
  return [
    "解析待機",
    "スタート",
    "加速・隊形",
    "1マーク接近",
    "1マーク攻防",
    "バックストレッチ",
    "予想着順",
  ][stage] || "解析待機";
}

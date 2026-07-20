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

  return entries
    .map((entry) => {
      const boatNo = Number(entry.boat_no);
      const national = nationalRank.get(boatNo) || null;
      const local = localRank.get(boatNo) || null;
      const motor = motorRank.get(boatNo) || null;
      const boat = boatRank.get(boatNo) || null;
      const exhibition = exhibitionRank.get(boatNo) || null;
      const st = stRank.get(boatNo) || null;

      const exhibitionAvailable =
        toNumber(entry.exhibition_time) !== null ||
        toNumber(entry.exhibition_st) !== null;

      const courseBonus =
        boatNo === 1 ? 12 :
        boatNo === 2 ? 6 :
        boatNo === 3 ? 3 :
        boatNo === 4 ? 1 : 0;

      const ability = clamp(
        rankScore(national) * 0.24 +
        rankScore(local) * 0.15 +
        rankScore(motor) * 0.2 +
        rankScore(boat) * 0.1 +
        (exhibitionAvailable
          ? rankScore(exhibition) * 0.2 +
            rankScore(st) * 0.11
          : 15) +
        courseBonus
      );

      const exhibitionSt = toNumber(entry.exhibition_st, null);
      const startPower =
        exhibitionSt === null
          ? ability
          : clamp(100 - exhibitionSt * 190 + ability * 0.25);

      return {
        boatNo,
        racerName: normalizeName(entry.racer_name),
        racerClass: entry.racer_class || "-",
        ability: Math.round(ability),
        startPower: Math.round(startPower),
        exhibitionTime: toNumber(entry.exhibition_time, null),
        exhibitionSt,
        motorRate: toNumber(entry.motor_2_rate, null),
        localRate: toNumber(entry.local_win_rate, null),
        course: Number(entry.actual_course || entry.course || boatNo),
      };
    })
    .sort((a, b) => a.boatNo - b.boatNo);
}

function decideAttackBoat(boats) {
  const candidates = boats
    .filter((boat) => boat.boatNo !== 1)
    .map((boat) => {
      let attack = boat.ability * 0.55 + boat.startPower * 0.45;

      if (boat.boatNo === 2) attack += 4;
      if (boat.boatNo === 3) attack += 7;
      if (boat.boatNo === 4) attack += 4;
      if (boat.boatNo >= 5) attack -= 3;

      return { ...boat, attack };
    })
    .sort((a, b) => b.attack - a.attack);

  return candidates[0] || null;
}

export function buildRaceTheaterModel({
  entries = [],
  event = null,
  previousPrediction = null,
  livePrediction = null,
}) {
  const boats = buildBoatAbility(entries);
  const boatOne = boats.find((boat) => boat.boatNo === 1);
  const attackBoat = decideAttackBoat(boats);

  const prediction = livePrediction || previousPrediction;
  const aiEscape = normalizeProbability(prediction?.score);

  const windSpeed = toNumber(event?.wind_speed, 0);
  const waveHeight = toNumber(event?.wave_height, 0);

  let escape =
    aiEscape ??
    ((boatOne?.ability || 50) * 0.72 +
      (boatOne?.startPower || 50) * 0.28);

  escape -= Math.min(windSpeed * 1.8, 12);
  escape -= Math.min(waveHeight * 1.2, 8);

  if (attackBoat) {
    escape -= Math.max(0, attackBoat.attack - 70) * 0.16;
  }

  escape = clamp(escape, 18, 94);

  const remaining = 100 - escape;
  const attackNo = attackBoat?.boatNo || 2;

  let sashi = remaining * 0.47;
  let makuri = remaining * 0.31;
  let makuriSashi = remaining * 0.22;

  if (attackNo === 2) {
    sashi += remaining * 0.12;
    makuri -= remaining * 0.07;
    makuriSashi -= remaining * 0.05;
  } else if (attackNo === 3 || attackNo === 4) {
    makuri += remaining * 0.1;
    sashi -= remaining * 0.05;
    makuriSashi -= remaining * 0.05;
  } else {
    makuriSashi += remaining * 0.13;
    sashi -= remaining * 0.06;
    makuri -= remaining * 0.07;
  }

  const totalAttack = sashi + makuri + makuriSashi;
  const scale = remaining / totalAttack;

  sashi *= scale;
  makuri *= scale;
  makuriSashi *= scale;

  const scenario =
    escape >= 62
      ? "escape"
      : attackNo === 2
      ? "sashi"
      : attackNo <= 4
      ? "makuri"
      : "makuriSashi";

  const sortedForFinish = [...boats].sort((a, b) => {
    const aBonus =
      a.boatNo === 1 ? escape :
      a.boatNo === attackNo ? 100 - escape :
      0;

    const bBonus =
      b.boatNo === 1 ? escape :
      b.boatNo === attackNo ? 100 - escape :
      0;

    return (
      b.ability + b.startPower * 0.2 + bBonus * 0.35 -
      (a.ability + a.startPower * 0.2 + aBonus * 0.35)
    );
  });

  const finishOrder =
    scenario === "escape"
      ? [
          boats.find((boat) => boat.boatNo === 1),
          ...sortedForFinish.filter((boat) => boat.boatNo !== 1),
        ].filter(Boolean)
      : [
          boats.find((boat) => boat.boatNo === attackNo),
          ...sortedForFinish.filter((boat) => boat.boatNo !== attackNo),
        ].filter(Boolean);

  const entryOrder = [...boats]
    .sort((a, b) => a.course - b.course)
    .map((boat) => boat.boatNo);

  const mainComment =
    scenario === "escape"
      ? `1号艇が先マイできる想定です。逃げ成功率は${Math.round(
          escape
        )}%です。`
      : scenario === "sashi"
      ? `${attackNo}号艇の差しが最も警戒されます。`
      : scenario === "makuri"
      ? `${attackNo}号艇のまくり攻勢が中心シナリオです。`
      : `${attackNo}号艇が展開を突く、まくり差し想定です。`;

  return {
    boats,
    scenario,
    attackBoatNo: attackNo,
    entryOrder,
    finishOrder: finishOrder.map((boat) => boat.boatNo),
    probabilities: {
      escape: Math.round(escape),
      sashi: Math.round(sashi),
      makuri: Math.round(makuri),
      makuriSashi:
        100 -
        Math.round(escape) -
        Math.round(sashi) -
        Math.round(makuri),
    },
    mainComment,
    environment: {
      windSpeed,
      waveHeight,
    },
  };
}

export function getStageLabel(stage) {
  const labels = [
    "解析待機",
    "スタート",
    "進入予想",
    "1マーク進入",
    "旋回",
    "バックストレッチ",
    "予想着順",
  ];

  return labels[stage] || labels[0];
}

export function getBoatColor(boatNo) {
  const colors = {
    1: { main: "#ffffff", text: "#0f172a", edge: "#cbd5e1" },
    2: { main: "#171717", text: "#ffffff", edge: "#475569" },
    3: { main: "#ef3038", text: "#ffffff", edge: "#ff7075" },
    4: { main: "#1987ed", text: "#ffffff", edge: "#62b2ff" },
    5: { main: "#f5c61b", text: "#111827", edge: "#ffe36e" },
    6: { main: "#19a85b", text: "#ffffff", edge: "#62db98" },
  };

  return colors[Number(boatNo)] || colors[1];
}

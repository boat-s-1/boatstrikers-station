const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const finite = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalize = (value, min, max) => {
  const number = finite(value);
  if (number === null || max === min) return 0.5;
  return clamp((number - min) / (max - min), 0, 1);
};

const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

function rankAscending(entries, key) {
  const valid = entries
    .filter((entry) => finite(entry[key]) !== null)
    .sort((a, b) => finite(a[key], 999) - finite(b[key], 999));

  return new Map(valid.map((entry, index) => [entry.boat_no, index + 1]));
}

function rankDescending(entries, selector) {
  const valid = entries
    .map((entry) => ({
      boatNo: entry.boat_no,
      value: selector(entry),
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value);

  return new Map(valid.map((row, index) => [row.boatNo, index + 1]));
}

function courseBias(boatNo) {
  const biases = {
    1: 1.0,
    2: 0.62,
    3: 0.54,
    4: 0.49,
    5: 0.43,
    6: 0.38,
  };

  return biases[Number(boatNo)] ?? 0.4;
}

function buildBaseScore(entry) {
  const national = normalize(entry.national_win_rate, 3.0, 8.0);
  const local = normalize(entry.local_win_rate, 2.5, 8.0);
  const motor = normalize(entry.motor_2_rate, 20, 55);
  const boat = normalize(entry.boat_2_rate, 20, 55);
  const lane = courseBias(entry.boat_no);

  return (
    national * 0.3 +
    local * 0.22 +
    motor * 0.22 +
    boat * 0.11 +
    lane * 0.15
  );
}

function buildExhibitionScore(entry, timeRank, stRank, hasExhibition) {
  if (!hasExhibition) return 0.5;

  const time = timeRank.get(entry.boat_no);
  const st = stRank.get(entry.boat_no);

  const timeScore = time ? (7 - time) / 6 : 0.5;
  const stScore = st ? (7 - st) / 6 : 0.5;

  return timeScore * 0.68 + stScore * 0.32;
}

function buildGrade(score) {
  if (score >= 90) return "S";
  if (score >= 82) return "A";
  if (score >= 72) return "B";
  if (score >= 62) return "C";
  return "D";
}

function buildDanger(score, entry, exhibitionRank, stRank) {
  const signs = [];

  if (finite(entry.local_win_rate, 0) < 3.5) {
    signs.push("当地成績が低め");
  }

  if (finite(entry.motor_2_rate, 0) < 25) {
    signs.push("モーター気配に不安");
  }

  if (exhibitionRank && exhibitionRank >= 5) {
    signs.push("展示タイム下位");
  }

  if (stRank && stRank >= 5) {
    signs.push("展示ST下位");
  }

  if (score < 55) {
    signs.push("総合指数が低い");
  }

  return signs;
}

export function buildAiDashboard(entries = []) {
  const safeEntries = Array.isArray(entries) ? entries : [];

  const hasExhibition = safeEntries.some(
    (entry) => finite(entry.exhibition_time) !== null
  );

  const hasExhibitionSt = safeEntries.some(
    (entry) => finite(entry.exhibition_st) !== null
  );

  const timeRank = rankAscending(safeEntries, "exhibition_time");
  const stRank = rankAscending(safeEntries, "exhibition_st");

  const provisionalScores = safeEntries.map((entry) => {
    const base = buildBaseScore(entry);
    const exhibition = buildExhibitionScore(
      entry,
      timeRank,
      stRank,
      hasExhibition
    );

    const total = hasExhibition
      ? base * 0.68 + exhibition * 0.32
      : base;

    return {
      ...entry,
      baseScore: base,
      exhibitionScore: exhibition,
      aiScore: Math.round(clamp(total * 100)),
      exhibitionRank: timeRank.get(entry.boat_no) || null,
      stRank: stRank.get(entry.boat_no) || null,
    };
  });

  const overallRank = rankDescending(
    provisionalScores,
    (entry) => entry.aiScore
  );

  const boats = provisionalScores
    .map((entry) => ({
      ...entry,
      aiRank: overallRank.get(entry.boat_no) || null,
      grade: buildGrade(entry.aiScore),
      dangerSigns: buildDanger(
        entry.aiScore,
        entry,
        entry.exhibitionRank,
        entry.stRank
      ),
    }))
    .sort((a, b) => Number(a.boat_no) - Number(b.boat_no));

  const boat1 = boats.find((entry) => Number(entry.boat_no) === 1);
  const rivals = boats.filter((entry) => Number(entry.boat_no) !== 1);
  const bestRival = [...rivals].sort((a, b) => b.aiScore - a.aiScore)[0];

  const lead = boat1 && bestRival ? boat1.aiScore - bestRival.aiScore : 0;
  const boat1Local = finite(boat1?.local_win_rate, 4.5);
  const boat1National = finite(boat1?.national_win_rate, 4.8);
  const boat1Motor = finite(boat1?.motor_2_rate, 32);

  let escapeExpectation = boat1
    ? boat1.aiScore * 0.61 +
      normalize(boat1Local, 3, 8) * 17 +
      normalize(boat1National, 3.5, 8) * 10 +
      normalize(boat1Motor, 20, 55) * 7 +
      clamp(lead, -20, 20) * 0.35
    : 0;

  if (hasExhibition && boat1?.exhibitionRank === 1) {
    escapeExpectation += 4;
  }

  if (hasExhibition && boat1?.exhibitionRank >= 5) {
    escapeExpectation -= 7;
  }

  if (hasExhibitionSt && boat1?.stRank === 1) {
    escapeExpectation += 3;
  }

  escapeExpectation = Math.round(clamp(escapeExpectation, 20, 96));

  const escapeGrade =
    escapeExpectation >= 88
      ? "鉄板級"
      : escapeExpectation >= 78
        ? "信頼"
        : escapeExpectation >= 66
          ? "期待"
          : escapeExpectation >= 55
            ? "注意"
            : "危険";

  const sorted = [...boats].sort((a, b) => b.aiScore - a.aiScore);
  const focusBoats = sorted.slice(0, 3);
  const dangerBoat = [...boats]
    .sort((a, b) => {
      const dangerDiff = b.dangerSigns.length - a.dangerSigns.length;
      if (dangerDiff !== 0) return dangerDiff;
      return a.aiScore - b.aiScore;
    })[0];

  const commentParts = [];

  if (boat1) {
    if (escapeExpectation >= 85) {
      commentParts.push(
        `1号艇は総合指数${boat1.aiScore}で、イン逃げ期待度は${escapeExpectation}%です。`
      );
    } else if (escapeExpectation >= 70) {
      commentParts.push(
        `1号艇は中心候補ですが、相手艇との指数差は大きくありません。`
      );
    } else {
      commentParts.push(
        `1号艇の信頼度は控えめで、イン飛びも意識したい組み合わせです。`
      );
    }

    if (hasExhibition) {
      if (boat1.exhibitionRank === 1) {
        commentParts.push("展示タイムはトップで、直前気配も良好です。");
      } else if (boat1.exhibitionRank && boat1.exhibitionRank >= 5) {
        commentParts.push("展示タイムは下位で、直前気配には注意が必要です。");
      }
    } else {
      commentParts.push(
        "展示情報はまだ未公開のため、現在は前日情報中心の評価です。"
      );
    }
  }

  if (bestRival) {
    commentParts.push(
      `相手筆頭は${bestRival.boat_no}号艇で、AI指数は${bestRival.aiScore}です。`
    );
  }

  const averageScore = average(boats.map((entry) => entry.aiScore));

  return {
    hasExhibition,
    hasExhibitionSt,
    boats,
    escapeExpectation,
    escapeGrade,
    focusBoats,
    dangerBoat,
    bestRival,
    averageScore: averageScore ? Math.round(averageScore) : null,
    comment: commentParts.join(""),
  };
}

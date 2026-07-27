"use client";

import { useMemo, useState } from "react";
import RaceNumberNav from "./RaceNumberNav";
import AiDashboard from "./AiDashboard";
import RaceResultPanel from "./RaceResultPanel";
import AnimatedStartSlit from "./AnimatedStartSlit";
import AiRaceTheater from "./AiRaceTheater";
import styles from "../phase2.module.css";

const TABS = [
  { key: "entries", icon: "📋", label: "出走表" },
  { key: "exhibition", icon: "⏱️", label: "展示" },
  { key: "bscExhibition", icon: "📊", label: "BSC展示" },
  { key: "raceTheater", icon: "🎬", label: "1マーク予想" },
  { key: "ai", icon: "🧠", label: "AI分析" },
  { key: "previous", icon: "📰", label: "前日版" },
  { key: "live", icon: "⚡", label: "直前版" },
  { key: "bets", icon: "🎯", label: "買い目" },
  { key: "result", icon: "🏁", label: "結果" },
];

function number(value, digits = 2) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "-";
}

function formatDisplayST(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const st = Number(value);

  if (!Number.isFinite(st)) {
    return "-";
  }

  if (st < 0) {
    return `F${Math.abs(st).toFixed(2).replace(/^0/, "")}`;
  }

  return st.toFixed(2).replace(/^0/, "");
}

function racerName(value) {
  return String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function BoatBadge({ boatNo, large = false }) {
  return (
    <span
      className={`${styles.boatBadge} ${styles[`boat${boatNo}`]} ${
        large ? styles.boatBadgeLarge : ""
      }`}
    >
      {boatNo}
    </span>
  );
}

function EmptyAi({ type }) {
  const isLive = type === "live";

  return (
    <div className={styles.emptyAi}>
      <div className={styles.emptyAiIcon}>
        {isLive ? "⚡" : "📰"}
      </div>

      <h3>
        {isLive ? "一果の直前版" : "一果の前日版"}
        は準備中です
      </h3>

      <p>
        AI予測が生成されると、期待度・評価・コメント・
        買い目が自動表示されます。
      </p>
    </div>
  );
}

function PredictionPanel({ prediction, title }) {
  if (!prediction) {
    return (
      <EmptyAi
        type={title.includes("直前") ? "live" : "previous"}
      />
    );
  }

  const bets = Array.isArray(prediction.bet_json)
    ? prediction.bet_json
    : [];

  return (
    <div className={styles.predictionPanel}>
      <div className={styles.predictionHero}>
        <div>
          <span className={styles.aiEyebrow}>ICHIKA AI</span>
          <h3>{title}</h3>
        </div>

        <div className={styles.scoreCircle}>
          <strong>{number(prediction.score, 0)}</strong>
          <span>%</span>
        </div>
      </div>

      <div className={styles.aiSummaryGrid}>
        <div>
          <span>AI評価</span>
          <strong>{prediction.rank || "-"}</strong>
        </div>

        <div>
          <span>本命艇</span>
          <strong>
            {prediction.main_boat
              ? `${prediction.main_boat}号艇`
              : "-"}
          </strong>
        </div>

        <div>
          <span>危険度</span>
          <strong>{prediction.danger_level || "-"}</strong>
        </div>
      </div>

      {prediction.comment_text && (
        <div className={styles.aiComment}>
          <span>一果のコメント</span>
          <p>{prediction.comment_text}</p>
        </div>
      )}

      {bets.length > 0 && (
        <div className={styles.betList}>
          <h4>おすすめ買い目</h4>

          {bets.map((bet, index) => (
            <div
              className={styles.betRow}
              key={`${JSON.stringify(bet)}-${index}`}
            >
              <strong>
                {typeof bet === "string"
                  ? bet
                  : bet.bet ||
                    bet.combination ||
                    JSON.stringify(bet)}
              </strong>

              {typeof bet === "object" &&
                bet !== null &&
                bet.confidence && (
                  <span>{bet.confidence}</span>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BetPanel({ prediction }) {
  if (!prediction) {
    return (
      <div className={styles.emptyAi}>
        <div className={styles.emptyAiIcon}>🎯</div>
        <h3>買い目はまだありません</h3>
        <p>
          AI予測が公開されると、おすすめ買い目が表示されます。
        </p>
      </div>
    );
  }

  const bets = Array.isArray(prediction.bet_json)
    ? prediction.bet_json
    : [];

  if (bets.length === 0) {
    return (
      <div className={styles.emptyAi}>
        <div className={styles.emptyAiIcon}>🎯</div>
        <h3>今回は買い目を公開していません</h3>
        <p>
          AI評価と1マーク予想を参考にレースを分析してください。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.panelHeading}>
        <div>
          <p>AI BET SELECTION</p>
          <h2>一果のおすすめ買い目</h2>
        </div>

        <span className={styles.panelBadge}>
          {bets.length}点
        </span>
      </div>

      <div className={styles.betList}>
        {bets.map((bet, index) => (
          <div
            className={styles.betRow}
            key={`${JSON.stringify(bet)}-${index}`}
          >
            <strong>
              {typeof bet === "string"
                ? bet
                : bet.bet ||
                  bet.combination ||
                  JSON.stringify(bet)}
            </strong>

            {typeof bet === "object" &&
              bet !== null &&
              bet.confidence && (
                <span>{bet.confidence}</span>
              )}
          </div>
        ))}
      </div>
    </>
  );
}


const CORRECTION_WEIGHTS = Object.freeze({
  lap: 0.04,
  turn: 0.08,
  straight: 0.06,
  averageSt: 0.35,
});

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  const sorted = values
    .map(finiteNumber)
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function createRanks(rows, getter) {
  const validRows = rows
    .map((row) => ({
      boatNo: Number(row.boat_no),
      value: finiteNumber(getter(row)),
    }))
    .filter((row) => row.value !== null)
    .sort((a, b) => a.value - b.value);

  const ranks = new Map();
  let previousValue = null;
  let previousRank = 0;

  validRows.forEach((row, index) => {
    const rank =
      previousValue !== null && row.value === previousValue
        ? previousRank
        : index + 1;

    ranks.set(row.boatNo, rank);
    previousValue = row.value;
    previousRank = rank;
  });

  return ranks;
}

function rankCellStyle(rank) {
  if (rank === 1) {
    return {
      background: "#e53935",
      color: "#fff",
      fontWeight: 900,
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
    };
  }

  if (rank === 2) {
    return {
      background: "#ffd740",
      color: "#352b00",
      fontWeight: 900,
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
    };
  }

  return {};
}

function displayTime(value, digits = 2) {
  const parsed = finiteNumber(value);
  return parsed === null ? "-" : parsed.toFixed(digits);
}

function displayStart(value) {
  const parsed = finiteNumber(value);

  if (parsed === null) return "-";
  if (parsed < 0) return `F${Math.abs(parsed).toFixed(2).replace(/^0/, "")}`;

  return parsed.toFixed(2).replace(/^0/, "");
}
function displayDifference(value, digits = 2) {
  const parsed = finiteNumber(value);

  if (parsed === null) {
    return "-";
  }

  if (Math.abs(parsed) < 0.005) {
    return "±0.00";
  }

  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(
    digits
  )}`;
}

function getOfficialExhibitionStart(row) {
  const st = finiteNumber(row?.exhibition_st);

  if (st === null) {
    return null;
  }

  const symbol = String(
    row?.exhibition_fl ??
    row?.show_fl ??
    row?.exhibition_start_symbol ??
    ""
  )
    .trim()
    .toUpperCase();

  if (symbol === "F") {
    return -Math.abs(st);
  }

  // Lも区別したい場合に備え、
  // 通常のSTとは重ならない負値にします
  if (symbol === "L") {
    return -2 - Math.abs(st);
  }

  // すでに負数で保存されている場合はそのまま
  return st;
}

function displayOfficialStart(row) {
  const st = finiteNumber(row?.exhibition_st);

  if (st === null) {
    return "-";
  }

  const symbol = String(
    row?.exhibition_fl ??
    row?.show_fl ??
    row?.exhibition_start_symbol ??
    ""
  )
    .trim()
    .toUpperCase();

  if (symbol === "F" || st < 0) {
    return `F${Math.abs(st)
      .toFixed(2)
      .replace(/^0/, "")}`;
  }

  if (symbol === "L") {
    return `L${Math.abs(st)
      .toFixed(2)
      .replace(/^0/, "")}`;
  }

  return st.toFixed(2).replace(/^0/, "");
}


function differenceCellStyle(value) {
  const parsed = finiteNumber(value);

  if (parsed === null) {
    return {};
  }

  if (parsed <= -0.03) {
    return {
      background: "#e8f6ed",
      color: "#13753a",
      fontWeight: 900,
    };
  }

  if (parsed >= 0.03) {
    return {
      background: "#fff0f0",
      color: "#c52d2d",
      fontWeight: 900,
    };
  }

  return {
    color: "#435165",
    fontWeight: 800,
  };
}


function rankToScore(rank) {
  if (!Number.isFinite(rank)) {
    return null;
  }

  const scoreMap = {
    1: 100,
    2: 92,
    3: 84,
    4: 76,
    5: 68,
    6: 60,
  };

  return scoreMap[rank] ?? Math.max(40, 108 - rank * 8);
}

function scoreToGrade(score) {
  if (score >= 96) return "S";
  if (score >= 91) return "A+";
  if (score >= 86) return "A";
  if (score >= 81) return "B+";
  if (score >= 75) return "B";
  return "C";
}

function gradeStyle(grade) {
  switch (grade) {
    case "S":
      return {
        background:
          "linear-gradient(135deg, #ffcf33 0%, #ff8a00 100%)",
        color: "#3c2100",
        boxShadow: "0 5px 14px rgba(255, 148, 0, .28)",
      };

    case "A+":
      return {
        background:
          "linear-gradient(135deg, #ff7979 0%, #ed3f3f 100%)",
        color: "#fff",
      };

    case "A":
      return {
        background:
          "linear-gradient(135deg, #fb9d63 0%, #ee6b31 100%)",
        color: "#fff",
      };

    case "B+":
      return {
        background:
          "linear-gradient(135deg, #72b9ff 0%, #337fd0 100%)",
        color: "#fff",
      };

    case "B":
      return {
        background:
          "linear-gradient(135deg, #83d5aa 0%, #35a66b 100%)",
        color: "#fff",
      };

    default:
      return {
        background: "#e8edf3",
        color: "#536174",
      };
  }
}

function buildExhibitionRatings(rows, correctedRanks) {
  return rows
    .map((row) => {
      const boatNo = Number(row.boat_no);

      const metrics = [
        {
          key: "exhibition",
          label: "展示タイム",
          weight: 0.35,
          rank: correctedRanks.exhibition.get(boatNo),
        },
        {
          key: "lap",
          label: "一周タイム",
          weight: 0.25,
          rank: correctedRanks.lap.get(boatNo),
        },
        {
          key: "turn",
          label: "まわり足",
          weight: 0.25,
          rank: correctedRanks.turn.get(boatNo),
        },
        {
          key: "straight",
          label: "直線",
          weight: 0.15,
          rank: correctedRanks.straight.get(boatNo),
        },
      ];

      const validMetrics = metrics.filter(
        (metric) => Number.isFinite(metric.rank)
      );

      const totalWeight = validMetrics.reduce(
        (sum, metric) => sum + metric.weight,
        0
      );

      const weightedScore = validMetrics.reduce(
        (sum, metric) =>
          sum +
          rankToScore(metric.rank) * metric.weight,
        0
      );

      const score =
        totalWeight > 0
          ? Math.round(weightedScore / totalWeight)
          : null;

      const bestMetric = [...validMetrics].sort(
        (a, b) => a.rank - b.rank
      )[0];

      const weakMetric = [...validMetrics].sort(
        (a, b) => b.rank - a.rank
      )[0];

      let comment = "展示データ待ち";

      if (score !== null) {
        if (bestMetric?.rank === 1) {
          comment = `${bestMetric.label}がトップ評価`;
        } else if (score >= 91) {
          comment = "全体的に高水準な展示内容";
        } else if (score >= 81) {
          comment = "バランスの良い展示気配";
        } else if (
          weakMetric &&
          weakMetric.rank >= 5
        ) {
          comment = `${weakMetric.label}にやや不安`;
        } else {
          comment = "大きな強調材料は少なめ";
        }
      }

      return {
        boatNo,
        score,
        grade: score === null ? "-" : scoreToGrade(score),
        comment,
      };
    })
    .sort((a, b) => {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
}

function buildOfficialExhibitionAnalysis(entries = []) {
  const safeEntries = Array.isArray(entries)
    ? entries.filter(Boolean)
    : [];

  const rows = safeEntries.map((entry) => ({
    ...entry,
    boat_no: Number(entry.boat_no),
  }));

  return {
    rows,

    officialRanks: {
      exhibition: createRanks(
        rows,
        (row) => row.exhibition_time
      ),

      lap: createRanks(
        rows,
        (row) => row.official_lap
      ),

      turn: createRanks(
        rows,
        (row) => row.official_turn
      ),

      straight: createRanks(
        rows,
        (row) => row.official_straight
      ),

      start: createRanks(
  rows,
  (row) => getOfficialExhibitionStart(row)
),
    },
  };
}

function buildExhibitionAnalysis(entries, venueBaselines = {}) {
  const lapMedian = median(
    entries.map((entry) => entry.official_lap)
  );

  const turnMedian = median(
    entries.map((entry) => entry.official_turn)
  );

  const straightMedian = median(
    entries.map((entry) => entry.official_straight)
  );

  const averageStMedian = median(
    entries.map((entry) => entry.average_st)
  );

  const exhibitionMedian = median(
    entries.map((entry) => entry.exhibition_time)
  );

  const rows = entries.map((entry) => {
    const boatNo = Number(entry.boat_no);

    const exhibitionCourse =
      finiteNumber(entry.exhibition_course) ?? boatNo;

    const exhibitionTime =
      finiteNumber(entry.exhibition_time);

    const exhibitionSt =
      finiteNumber(entry.exhibition_st);

    const lapTime =
      finiteNumber(entry.official_lap);

    const turnTime =
      finiteNumber(entry.official_turn);

    const straightTime =
      finiteNumber(entry.official_straight);

    const averageSt =
      finiteNumber(entry.average_st);

    /*
     * 暫定コース補正
     *
     * 内側ほど展示タイムを出しやすい想定のため、
     * 内側は少し加算、外側は少し減算します。
     *
     * 将来的には過去データから作成した
     * 場別・展示進入別の補正値に置き換えます。
     */
    const courseCorrectionMap = {
      1: 0.025,
      2: 0.015,
      3: 0.006,
      4: -0.004,
      5: -0.014,
      6: -0.024,
    };

    const courseCorrection =
      courseCorrectionMap[exhibitionCourse] ?? 0;

    /*
     * 展示タイム補正
     *
     * 一周・まわり足・直線のレース内中央値との差を加味。
     * 補正式・係数は画面に表示しません。
     */
    let exhibitionCorrection = 0;

    if (lapTime !== null && lapMedian !== null) {
      exhibitionCorrection +=
        (lapTime - lapMedian) *
        CORRECTION_WEIGHTS.lap;
    }

    if (turnTime !== null && turnMedian !== null) {
      exhibitionCorrection +=
        (turnTime - turnMedian) *
        CORRECTION_WEIGHTS.turn;
    }

    if (
      straightTime !== null &&
      straightMedian !== null
    ) {
      exhibitionCorrection +=
        (straightTime - straightMedian) *
        CORRECTION_WEIGHTS.straight;
    }

    const correctedExhibition =
      exhibitionTime === null
        ? null
        : exhibitionTime +
          courseCorrection +
          exhibitionCorrection;

    /*
     * オリ展項目もコース差を少量だけ補正。
     *
     * 展示タイムと同じ補正量をそのまま使わず、
     * 各項目用に抑えた値を使用します。
     */
    const correctedLap =
      lapTime === null
        ? null
        : lapTime + courseCorrection * 0.8;

    const correctedTurn =
      turnTime === null
        ? null
        : turnTime + courseCorrection * 0.35;

    const correctedStraight =
      straightTime === null
        ? null
        : straightTime + courseCorrection * 0.45;

    /*
     * AI予想スリット用の内部ST
     * 数値自体は画面に表示しません。
     */
    let predictedStart = exhibitionSt;

    if (
      predictedStart !== null &&
      averageSt !== null &&
      averageStMedian !== null
    ) {
      const averageStCorrection = Math.max(
        -0.03,
        Math.min(
          0.03,
          (averageSt - averageStMedian) *
            CORRECTION_WEIGHTS.averageSt
        )
      );

      predictedStart += averageStCorrection;
    }

    /*
     * 場平均値
     *
     * venueBaselines がない項目は null となり、
     * 場平均差の表では「-」表示になります。
     */
    const exhibitionBaseline = finiteNumber(
      venueBaselines.exhibition
    );

    const lapBaseline = finiteNumber(
      venueBaselines.lap
    );

    const turnBaseline = finiteNumber(
      venueBaselines.turn
    );

    const straightBaseline = finiteNumber(
      venueBaselines.straight
    );

    return {
      ...entry,

      corrected_exhibition_time:
        correctedExhibition,

      corrected_lap:
        correctedLap,

      corrected_turn:
        correctedTurn,

      corrected_straight:
        correctedStraight,

      predicted_start:
        predictedStart,

      venue_diff_exhibition:
        correctedExhibition !== null &&
        exhibitionBaseline !== null
          ? correctedExhibition -
            exhibitionBaseline
          : null,

      venue_diff_lap:
        correctedLap !== null &&
        lapBaseline !== null
          ? correctedLap - lapBaseline
          : null,

      venue_diff_turn:
        correctedTurn !== null &&
        turnBaseline !== null
          ? correctedTurn - turnBaseline
          : null,

      venue_diff_straight:
        correctedStraight !== null &&
        straightBaseline !== null
          ? correctedStraight -
            straightBaseline
          : null,

      race_median_diff_exhibition:
        correctedExhibition !== null &&
        exhibitionMedian !== null
          ? correctedExhibition -
            exhibitionMedian
          : null,
    };
  });

 return {
  rows,

  // 展示タブで使用する公式値の順位
  officialRanks: {
    exhibition: createRanks(
      rows,
      (row) => row.exhibition_time
    ),

    lap: createRanks(
      rows,
      (row) => row.official_lap
    ),

    turn: createRanks(
      rows,
      (row) => row.official_turn
    ),

    straight: createRanks(
      rows,
      (row) => row.official_straight
    ),

    start: createRanks(
  rows,
  (row) => getOfficialExhibitionStart(row)
),
  },

  // BSC展示タブで使用する補正値の順位
  correctedRanks: {
    exhibition: createRanks(
      rows,
      (row) => row.corrected_exhibition_time
    ),

    lap: createRanks(
      rows,
      (row) => row.corrected_lap
    ),

    turn: createRanks(
      rows,
      (row) => row.corrected_turn
    ),

    straight: createRanks(
      rows,
      (row) => row.corrected_straight
    ),

    start: createRanks(
      rows,
      (row) => row.predicted_start
    ),
  },
};
}
function ExhibitionTable({
  title,
  eyebrow,
  rows = [],
  columns = [],
  emptyMessage,
}) {
  const hasAnyValue = rows.some((row) =>
    columns.some((column) => finiteNumber(column.getValue(row)) !== null)
  );

  return (
    <div
      style={{
        border: "1px solid #dbe4ef",
        borderRadius: "18px",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 8px 24px rgba(28, 50, 78, .08)",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e8eef5",
          background:
            "linear-gradient(135deg, #f7fbff 0%, #eef6ff 100%)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: ".12em",
            color: "#3b74a8",
          }}
        >
          {eyebrow}
        </div>
        <h3 style={{ margin: "4px 0 0", fontSize: "20px" }}>
          {title}
        </h3>
      </div>

      {!hasAnyValue ? (
        <div
          style={{
            padding: "30px 18px",
            textAlign: "center",
            color: "#68778a",
            fontWeight: 700,
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "620px",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th style={tableHeadStyle}>艇</th>
                {columns.map((column) => (
                  <th key={column.key} style={tableHeadStyle}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.boat_no}>
                  <td style={tableBoatStyle}>
                    <BoatBadge boatNo={row.boat_no} />
                  </td>

                  {columns.map((column) => {
                    const value = column.getValue(row);
                    const rank = column.getRank
                      ? column.getRank(row)
                      : null;

                    return (
                      <td
                        key={column.key}
                        style={{
  ...tableCellStyle,
  ...(column.getCellStyle
    ? column.getCellStyle(value, row)
    : {}),
  ...rankCellStyle(rank),
}}
                      >
                        {typeof column.format === "function"
  ? column.format(value, row)
  : value ?? "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const tableHeadStyle = {
  padding: "12px 8px",
  borderBottom: "1px solid #dfe7f0",
  background: "#f4f7fb",
  color: "#425166",
  fontSize: "13px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tableBoatStyle = {
  ...tableHeadStyle,
  borderRight: "1px solid #e5ebf2",
  background: "#fff",
};

const tableCellStyle = {
  padding: "14px 8px",
  borderBottom: "1px solid #edf1f5",
  borderRight: "1px solid #edf1f5",
  textAlign: "center",
  fontSize: "16px",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

function OfficialExhibitionSuite({ entries = [] }) {
  const analysis = useMemo(
    () => buildOfficialExhibitionAnalysis(entries),
    [entries]
  );

  const { rows, officialRanks } = analysis;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <ExhibitionTable
        title="公式展示情報"
        eyebrow="OFFICIAL EXHIBITION"
        rows={rows}
        emptyMessage="展示情報はまだ公開されていません。展示後の同期で自動表示されます。"
        columns={[
          {
            key: "exhibition",
            label: "展示",
            getValue: (row) => row.exhibition_time,
            getRank: (row) =>
              officialRanks.exhibition.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
          {
            key: "lap",
            label: "一周",
            getValue: (row) => row.official_lap,
            getRank: (row) =>
              officialRanks.lap.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
          {
            key: "turn",
            label: "まわり足",
            getValue: (row) => row.official_turn,
            getRank: (row) =>
              officialRanks.turn.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
          {
            key: "straight",
            label: "直線",
           getValue: (row) => row.official_straight,
            getRank: (row) =>
              officialRanks.straight.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
        ]}
      />

      <ExhibitionTable
        title="公式スタート展示"
        eyebrow="OFFICIAL START EXHIBITION"
        rows={rows}
        emptyMessage="スタート展示はまだ公開されていません。"
        columns={[
          {
            key: "course",
            label: "展示進入",
            getValue: (row) => row.exhibition_course,
            format: (value) => {
              const parsed = finiteNumber(value);
              return parsed === null ? "-" : String(Math.trunc(parsed));
            },
          },
         {
  key: "start",
  label: "展示ST",

  // ExhibitionTableに値があると認識させる
  getValue: (row) =>
    getOfficialExhibitionStart(row),

  getRank: (row) =>
    officialRanks.start.get(
      Number(row.boat_no)
    ),

  // F/Lフラグを含めて表示する
  format: (_value, row) =>
    displayOfficialStart(row),
},
        ]}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          padding: "12px 14px",
          borderRadius: "12px",
          background: "#f7f9fc",
          color: "#566579",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        <span
          style={{
            ...rankCellStyle(1),
            borderRadius: "6px",
            padding: "4px 10px",
          }}
        >
          1位
        </span>
        <span
          style={{
            ...rankCellStyle(2),
            borderRadius: "6px",
            padding: "4px 10px",
          }}
        >
          2位
        </span>
        <span>各項目は数値が小さい艇を上位表示しています。</span>
      </div>
    </div>
  );
}

function AiPredictedStartSlit({ rows }) {
  const validRows = rows.filter(
    (row) =>
      finiteNumber(row.predicted_start) !== null
  );

  if (!validRows.length) {
    return (
      <div
        style={{
          padding: "30px 18px",
          border: "1px solid #dbe4ef",
          borderRadius: "18px",
          background: "#fff",
          textAlign: "center",
          color: "#68778a",
          fontWeight: 700,
        }}
      >
        展示STが公開されるとAI予想スリットを表示します。
      </div>
    );
  }

  const startValues = validRows.map(
    (row) => finiteNumber(row.predicted_start)
  );

  const fastest = Math.min(...startValues);
  const slowest = Math.max(...startValues);
  const range = Math.max(0.08, slowest - fastest);

  const rankedRows = [...rows].sort((a, b) => {
    const courseA =
      finiteNumber(a.exhibition_course) ??
      Number(a.boat_no);

    const courseB =
      finiteNumber(b.exhibition_course) ??
      Number(b.boat_no);

    return courseA - courseB;
  });

  return (
    <div
      style={{
        border: "1px solid #dbe4ef",
        borderRadius: "18px",
        overflow: "hidden",
        background: "#fff",
        boxShadow:
          "0 8px 24px rgba(28, 50, 78, .08)",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e8eef5",
          background:
            "linear-gradient(135deg, #f7fbff 0%, #eef6ff 100%)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: ".12em",
            color: "#3b74a8",
          }}
        >
          BOATSTRIKERS AI START SLIT
        </div>

        <h3
          style={{
            margin: "4px 0 0",
            fontSize: "20px",
          }}
        >
          AI予想スリット
        </h3>
      </div>

      <div
        style={{
          position: "relative",
          padding: "22px 18px 22px",
          background:
            "linear-gradient(180deg, #f9fcff 0%, #eef5fb 100%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "18px",
            bottom: "18px",
            right: "22%",
            width: "3px",
            background:
              "linear-gradient(180deg, #ed3f3f, #ff7474)",
            boxShadow:
              "0 0 12px rgba(230, 50, 50, .35)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "calc(22% - 27px)",
            fontSize: "10px",
            fontWeight: 900,
            color: "#d83434",
          }}
        >
          START
        </div>

        <div
          style={{
            display: "grid",
            gap: "10px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {rankedRows.map((row, index) => {
            const predicted =
              finiteNumber(row.predicted_start);

            const normalized =
              predicted === null
                ? 0
                : (slowest - predicted) / range;

            const leftPosition =
              predicted === null
                ? 12
                : 42 + normalized * 34;

            const isFastest =
              predicted !== null &&
              Math.abs(predicted - fastest) <
                0.0001;

            return (
              <div
                key={row.boat_no}
                style={{
                  position: "relative",
                  height: "42px",
                  borderRadius: "12px",
                  background:
                    "rgba(255,255,255,.78)",
                  border:
                    "1px solid rgba(202,215,229,.85)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2,
                  }}
                >
                  <BoatBadge
                    boatNo={row.boat_no}
                  />
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: "56px",
                    right: "12px",
                    top: "50%",
                    height: "2px",
                    transform: "translateY(-50%)",
                    background:
                      "repeating-linear-gradient(90deg, #b7c4d3 0 8px, transparent 8px 15px)",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: `${leftPosition}%`,
                    top: "50%",
                    width: isFastest ? "30px" : "26px",
                    height: isFastest ? "30px" : "26px",
                    transform:
                      "translate(-50%, -50%)",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "12px",
                    fontWeight: 900,
                    background: isFastest
                      ? "#ffdf48"
                      : "#ffffff",
                    border: isFastest
                      ? "3px solid #e2473f"
                      : "2px solid #60748a",
                    boxShadow: isFastest
                      ? "0 0 0 5px rgba(255, 215, 65, .24)"
                      : "0 3px 8px rgba(33, 55, 79, .15)",
                    animation:
                      "bscSlitSlide .7s ease both",
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  {row.boat_no}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #e8eef5",
          color: "#58697c",
          fontSize: "12px",
          fontWeight: 700,
          lineHeight: 1.7,
        }}
      >
        展示進入・展示ST・平均STなどをもとに、
        BoatStrikers独自基準で予測したスタート隊形です。
        数値は表示せず、艇の前後関係で表現しています。
      </div>

      <style jsx>{`
        @keyframes bscSlitSlide {
          from {
            opacity: 0;
            transform: translate(-90px, -50%);
          }

          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  );
}

function ExhibitionOverallRating({
  rows,
  correctedRanks,
}) {
  const ratings = useMemo(
    () =>
      buildExhibitionRatings(
        rows,
        correctedRanks
      ),
    [rows, correctedRanks]
  );

  const hasRating = ratings.some(
    (rating) => rating.score !== null
  );

  return (
    <div
      style={{
        border: "1px solid #dbe4ef",
        borderRadius: "18px",
        overflow: "hidden",
        background: "#fff",
        boxShadow:
          "0 8px 24px rgba(28, 50, 78, .08)",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #e8eef5",
          background:
            "linear-gradient(135deg, #f7fbff 0%, #eef6ff 100%)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: ".12em",
            color: "#3b74a8",
          }}
        >
          BOATSTRIKERS EXHIBITION RATING
        </div>

        <h3
          style={{
            margin: "4px 0 0",
            fontSize: "20px",
          }}
        >
          展示総合評価
        </h3>
      </div>

      {!hasRating ? (
        <div
          style={{
            padding: "30px 18px",
            textAlign: "center",
            color: "#68778a",
            fontWeight: 700,
          }}
        >
          公式展示情報が公開されると総合評価を表示します。
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "10px",
            padding: "16px",
          }}
        >
          {ratings.map((rating, index) => (
            <div
              key={rating.boatNo}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "42px 58px 70px minmax(0, 1fr)",
                gap: "10px",
                alignItems: "center",
                padding: "12px",
                border:
                  index === 0
                    ? "2px solid #f0b429"
                    : "1px solid #e3eaf2",
                borderRadius: "14px",
                background:
                  index === 0
                    ? "linear-gradient(135deg, #fffdf4 0%, #fff8da 100%)"
                    : "#fff",
              }}
            >
              <BoatBadge
                boatNo={rating.boatNo}
                large
              />

              <div
                style={{
                  ...gradeStyle(rating.grade),
                  display: "grid",
                  placeItems: "center",
                  width: "54px",
                  height: "42px",
                  borderRadius: "11px",
                  fontSize: "20px",
                  fontWeight: 1000,
                }}
              >
                {rating.grade}
              </div>

              <div
                style={{
                  textAlign: "center",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "22px",
                    lineHeight: 1,
                    color: "#203146",
                    fontVariantNumeric:
                      "tabular-nums",
                  }}
                >
                  {rating.score ?? "-"}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: "4px",
                    color: "#708095",
                    fontSize: "10px",
                    fontWeight: 900,
                  }}
                >
                  BSC指数
                </span>
              </div>

              <div
                style={{
                  minWidth: 0,
                  color: "#4c5d71",
                  fontSize: "13px",
                  fontWeight: 800,
                  lineHeight: 1.5,
                }}
              >
                {rating.comment}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "11px 16px",
          borderTop: "1px solid #e8eef5",
          background: "#fafcff",
          color: "#65758a",
          fontSize: "11px",
          fontWeight: 700,
          lineHeight: 1.6,
        }}
      >
        補正展示・一周・まわり足・直線を総合して、
        BoatStrikers独自指数と評価を算出しています。
      </div>
    </div>
  );
}


function CorrectedExhibitionSuite({
  entries,
  event,
}) {
  /*
   * 将来的にはSupabaseの場別基準テーブルから取得します。
   *
   * 現在はイベントに基準値がある場合に使用し、
   * 存在しない場合は「-」表示になります。
   */
  const venueBaselines = useMemo(
    () => ({
      exhibition:
        event?.venue_average_exhibition_time ??
        event?.baseline_exhibition_time ??
        null,

      lap:
        event?.venue_average_lap ??
        event?.baseline_lap ??
        null,

      turn:
        event?.venue_average_turn ??
        event?.baseline_turn ??
        null,

      straight:
        event?.venue_average_straight ??
        event?.baseline_straight ??
        null,
    }),
    [event]
  );

  const analysis = useMemo(
    () =>
      buildExhibitionAnalysis(
        entries,
        venueBaselines
      ),
    [entries, venueBaselines]
  );

  const { rows, correctedRanks } = analysis;

  return (
    <div
      style={{
        display: "grid",
        gap: "20px",
      }}
    >
      <ExhibitionTable
        title="BoatStrikers補正展示"
        eyebrow="BOATSTRIKERS CORRECTED EXHIBITION"
        rows={rows}
        emptyMessage="公式展示情報が公開されるとBoatStrikers補正値を表示します。"
        columns={[
          {
            key: "exhibition",
            label: "展示",
            getValue: (row) =>
              row.corrected_exhibition_time,

            getRank: (row) =>
              correctedRanks.exhibition.get(
                Number(row.boat_no)
              ),

            format: (value) =>
              displayTime(value),
          },

          {
            key: "lap",
            label: "一周",
            getValue: (row) =>
              row.corrected_lap,

            getRank: (row) =>
              correctedRanks.lap.get(
                Number(row.boat_no)
              ),

            format: (value) =>
              displayTime(value),
          },

          {
            key: "turn",
            label: "まわり足",
            getValue: (row) =>
              row.corrected_turn,

            getRank: (row) =>
              correctedRanks.turn.get(
                Number(row.boat_no)
              ),

            format: (value) =>
              displayTime(value),
          },

          {
            key: "straight",
            label: "直線",
            getValue: (row) =>
              row.corrected_straight,

            getRank: (row) =>
              correctedRanks.straight.get(
                Number(row.boat_no)
              ),

            format: (value) =>
              displayTime(value),
          },
        ]}
      />

      <ExhibitionTable
        title="場平均タイム差"
        eyebrow="VENUE AVERAGE DIFFERENCE"
        rows={rows}
        emptyMessage="場平均基準値が登録されると平均との差を表示します。"
        columns={[
          {
            key: "exhibition",
            label: "展示",

            getValue: (row) =>
              row.venue_diff_exhibition,

            format: (value) =>
              displayDifference(value),

            getCellStyle: (value) =>
              differenceCellStyle(value),
          },

          {
            key: "lap",
            label: "一周",

            getValue: (row) =>
              row.venue_diff_lap,

            format: (value) =>
              displayDifference(value),

            getCellStyle: (value) =>
              differenceCellStyle(value),
          },

          {
            key: "turn",
            label: "まわり足",

            getValue: (row) =>
              row.venue_diff_turn,

            format: (value) =>
              displayDifference(value),

            getCellStyle: (value) =>
              differenceCellStyle(value),
          },

          {
            key: "straight",
            label: "直線",

            getValue: (row) =>
              row.venue_diff_straight,

            format: (value) =>
              displayDifference(value),

            getCellStyle: (value) =>
              differenceCellStyle(value),
          },
        ]}
      />

      <div
        style={{
          padding: "11px 14px",
          borderRadius: "12px",
          background: "#f7f9fc",
          color: "#566579",
          fontSize: "12px",
          fontWeight: 700,
          lineHeight: 1.7,
        }}
      >
        場平均タイム差は、マイナスほど場平均より速く、
        プラスほど場平均より遅いことを示します。
      </div>

      <AiPredictedStartSlit rows={rows} />

<ExhibitionOverallRating
  rows={rows}
  correctedRanks={correctedRanks}
/>

<div
  style={{
          padding: "14px 16px",
          border: "1px solid #dce7f2",
          borderRadius: "14px",
          background: "#f8fbff",
          color: "#53657a",
          fontSize: "13px",
          lineHeight: 1.7,
        }}
      >
        展示進入、競艇場ごとの傾向、展示内容などを
        BoatStrikers独自基準で補正しています。
      </div>
    </div>
  );
}

export default function RaceDetailTabs({
  courseCode,
  raceNo,
  raceDate,
  event = null,
  entries = [],
  previousPrediction = null,
  livePrediction = null,
  syncedAt = null,
  result = null,
  resultEntries = [],
}) {
  const [activeTab, setActiveTab] = useState("entries");

  const exhibitionRows = useMemo(() => {
    const validTimes = entries
      .filter(
        (entry) =>
          entry.exhibition_time !== null &&
          entry.exhibition_time !== undefined
      )
      .sort(
        (a, b) =>
          Number(a.exhibition_time ?? 999) -
          Number(b.exhibition_time ?? 999)
      );

    const timeRank = new Map(
      validTimes.map((entry, index) => [
        Number(entry.boat_no),
        index + 1,
      ])
    );

    return entries.map((entry) => ({
      ...entry,
      exhibitionRank:
        timeRank.get(Number(entry.boat_no)) || null,
    }));
  }, [entries]);

  const currentPrediction =
    livePrediction || previousPrediction;

  return (
    <>
      <nav className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`${styles.tabButton} ${
              activeTab === tab.key
                ? styles.tabButtonActive
                : ""
            }`}
          >
            <span>{tab.icon}</span>
            <strong>{tab.label}</strong>
          </button>
        ))}
      </nav>

      <RaceNumberNav
        courseCode={courseCode}
        currentRaceNo={raceNo}
        raceDate={raceDate}
      />

      <section className={styles.detailPanel}>
        {activeTab === "entries" && (
          <>
            <div className={styles.panelHeading}>
              <div>
                <p>OFFICIAL ENTRY DATA</p>
                <h2>基本出走表</h2>
              </div>

              <span className={styles.panelBadge}>
                {entries.length}艇
              </span>
            </div>

            <div className={styles.entryCards}>
              {entries.map((entry) => (
                <article
                  className={styles.entryCard}
                  key={entry.boat_no}
                >
                  <div className={styles.entryCardTop}>
                    <BoatBadge
                      boatNo={entry.boat_no}
                      large
                    />

                    <div className={styles.entryNameArea}>
                      <span className={styles.gradeBadge}>
                        {entry.racer_class || "-"}
                      </span>

                      <h3>{racerName(entry.racer_name)}</h3>

                      <p>
                        登録番号{" "}
                        {entry.racer_registration_no || "-"}
                      </p>
                    </div>
                  </div>

                  <div className={styles.statGrid}>
                    <div>
                      <span>全国勝率</span>
                      <strong>
                        {number(entry.national_win_rate)}
                      </strong>
                    </div>

                    <div>
                      <span>当地勝率</span>
                      <strong>
                        {number(entry.local_win_rate)}
                      </strong>
                    </div>

                    <div>
                      <span>展示</span>
                      <strong>
                        {number(entry.exhibition_time)}
                      </strong>
                    </div>

                    <div>
                      <span>展示ST</span>
                      <strong>
                        {formatDisplayST(entry.exhibition_st)}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.machineGrid}>
                    <div>
                      <span>モーター</span>
                      <strong>{entry.motor_no ?? "-"}</strong>
                      <small>
                        {number(entry.motor_2_rate)}%
                      </small>
                    </div>

                    <div>
                      <span>ボート</span>
                      <strong>
                        {entry.boat_machine_no ?? "-"}
                      </strong>
                      <small>
                        {number(entry.boat_2_rate)}%
                      </small>
                    </div>

                    <div>
                      <span>チルト</span>
                      <strong>{number(entry.tilt, 1)}</strong>
                    </div>
                  </div>

                  <div className={styles.seriesRow}>
                    <span>今節成績</span>
                    <strong>
                      {entry.current_series_results || "-"}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {activeTab === "exhibition" && (
  <>
    <OfficialExhibitionSuite entries={entries} />

    <div style={{ marginTop: "24px" }}>
      <AnimatedStartSlit entries={entries} />
    </div>
  </>
)}

        {activeTab === "bscExhibition" && (
  <CorrectedExhibitionSuite
    entries={entries}
    event={event}
  />
)}

        {activeTab === "raceTheater" && (
          <AiRaceTheater
            event={event}
            entries={entries}
            previousPrediction={previousPrediction}
            livePrediction={livePrediction}
            result={result}
            resultEntries={resultEntries}
          />
        )}

        {activeTab === "ai" && (
          <AiDashboard
            event={event}
            entries={entries}
            prediction={currentPrediction}
            previousPrediction={previousPrediction}
            livePrediction={livePrediction}
          />
        )}

        {activeTab === "previous" && (
          <PredictionPanel
            prediction={previousPrediction}
            title="一果AI 前日版"
          />
        )}

        {activeTab === "live" && (
          <PredictionPanel
            prediction={livePrediction}
            title="一果AI 直前版"
          />
        )}

        {activeTab === "bets" && (
          <BetPanel prediction={currentPrediction} />
        )}

        {activeTab === "result" && (
          <RaceResultPanel
            result={result}
            resultEntries={resultEntries}
            entries={entries}
          />
        )}
      </section>

      {syncedAt && (
        <p className={styles.syncedAt}>
          最終同期：{syncedAt}
        </p>
      )}
    </>
  );
}

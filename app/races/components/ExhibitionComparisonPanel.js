"use client";

import { useMemo } from "react";
import AnimatedStartSlit from "./AnimatedStartSlit";
import styles from "../phase2.module.css";

/* =========================================================
   共通処理
========================================================= */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function formatTime(value, digits = 2) {
  const number = toNumber(value);

  return number === null
    ? "-"
    : number.toFixed(digits);
}

function formatStart(value) {
  const number = toNumber(value);

  if (number === null) {
    return "-";
  }

  if (number < 0) {
    return `F${Math.abs(number)
      .toFixed(2)
      .replace(/^0/, "")}`;
  }

  return number
    .toFixed(2)
    .replace(/^0/, "");
}

function normalizeName(value) {
  return String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}
function createTimeRankMap(rows, fieldName) {
  const validRows = rows
    .filter((row) => toNumber(row[fieldName]) !== null)
    .sort(
      (a, b) =>
        Number(a[fieldName]) -
        Number(b[fieldName])
    );

  return new Map(
    validRows.map((row, index) => [
      Number(row.boat_no),
      index + 1,
    ])
  );
}

function getTimeRankClass(rank) {
  if (rank === 1) {
    return styles.exhibitionBestCell;
  }

  if (rank === 2) {
    return styles.exhibitionSecondCell;
  }

  return "";
}
/* =========================================================
   星評価
========================================================= */

function Stars({ count }) {
  const safeCount = clamp(
    Number(count) || 1,
    1,
    5
  );

  return (
    <span
      className={styles.bscStars}
      aria-label={`${safeCount}点`}
    >
      {Array.from(
        { length: 5 },
        (_, index) => (
          <span
            key={index}
            className={
              index < safeCount
                ? styles.bscStarActive
                : styles.bscStarEmpty
            }
          >
            ★
          </span>
        )
      )}
    </span>
  );
}

/* =========================================================
   艇番
========================================================= */

function BoatBadge({ boatNo }) {
  return (
    <span
      className={`${styles.boatBadge} ${
        styles[`boat${boatNo}`]
      }`}
    >
      {boatNo}
    </span>
  );
}

/* =========================================================
   補正計算
   ※ 研究版の仮ロジック
========================================================= */

function buildCorrectedRows(entries) {
  const validExhibitionTimes = entries
    .map((entry) =>
      toNumber(entry.exhibition_time)
    )
    .filter((value) => value !== null);

  const validLapTimes = entries
    .map((entry) =>
      toNumber(entry.lap_time)
    )
    .filter((value) => value !== null);

  const averageExhibition =
    validExhibitionTimes.length > 0
      ? validExhibitionTimes.reduce(
          (sum, value) => sum + value,
          0
        ) / validExhibitionTimes.length
      : null;

  const averageLap =
    validLapTimes.length > 0
      ? validLapTimes.reduce(
          (sum, value) => sum + value,
          0
        ) / validLapTimes.length
      : null;

  const baseRows = entries.map((entry) => {
    const exhibitionTime =
      toNumber(entry.exhibition_time);

    const lapTime =
      toNumber(entry.lap_time);

    const turnTime =
      toNumber(entry.turn_time);

    const straightTime =
      toNumber(entry.straight_time);

    const exhibitionSt =
      toNumber(entry.exhibition_st);

    /*
     * 補正展示
     *
     * 一周・回り足・直線が良い艇ほど
     * 最大0.05秒ほど速く補正する研究用計算です。
     */
    let correction = 0;

    if (
      turnTime !== null &&
      turnTime <= 5.45
    ) {
      correction += 0.02;
    }

    if (
      straightTime !== null &&
      straightTime <= 7.45
    ) {
      correction += 0.02;
    }

    if (
      lapTime !== null &&
      averageLap !== null &&
      lapTime < averageLap
    ) {
      correction += 0.01;
    }

    const correctedExhibition =
      exhibitionTime !== null
        ? exhibitionTime - correction
        : null;

    const correctedLap =
      lapTime !== null
        ? lapTime - correction
        : null;

    /*
     * 補正ST
     *
     * 展示・直線・回り足の評価を
     * ±0.03秒以内で反映します。
     */
    let stCorrection = 0;

    if (
      exhibitionTime !== null &&
      averageExhibition !== null &&
      exhibitionTime < averageExhibition
    ) {
      stCorrection += 0.01;
    }

    if (
      straightTime !== null &&
      straightTime <= 7.45
    ) {
      stCorrection += 0.01;
    }

    if (
      turnTime !== null &&
      turnTime <= 5.45
    ) {
      stCorrection += 0.01;
    }

    const correctedStart =
      exhibitionSt !== null
        ? Math.max(
            -0.99,
            exhibitionSt - stCorrection
          )
        : null;

    /*
     * 星評価
     */
/*
 * 相対順位ベースの評価
 *
 * 全艇が5つ星にならないよう、
 * 補正展示・補正一周の順位を中心に評価します。
 */

const exhibitionValues = entries
  .map((item) =>
    toNumber(item.exhibition_time)
  )
  .filter((value) => value !== null)
  .sort((a, b) => a - b);

const lapValues = entries
  .map((item) =>
    toNumber(item.lap_time)
  )
  .filter((value) => value !== null)
  .sort((a, b) => a - b);

const exhibitionRank =
  correctedExhibition === null
    ? null
    : exhibitionValues.findIndex(
        (value) =>
          value >= correctedExhibition
      ) + 1;

const lapRank =
  correctedLap === null
    ? null
    : lapValues.findIndex(
        (value) =>
          value >= correctedLap
      ) + 1;

let normalizedScore = 50;

if (exhibitionRank !== null) {
  normalizedScore +=
    (7 - exhibitionRank) * 6;
}

if (lapRank !== null) {
  normalizedScore +=
    (7 - lapRank) * 4;
}

if (
  turnTime !== null &&
  turnTime <= 5.45
) {
  normalizedScore += 5;
}

if (
  straightTime !== null &&
  straightTime <= 7.45
) {
  normalizedScore += 5;
}

normalizedScore = clamp(
  Math.round(normalizedScore),
  35,
  95
);

let stars = 1;

if (normalizedScore >= 88) {
  stars = 5;
} else if (normalizedScore >= 76) {
  stars = 4;
} else if (normalizedScore >= 64) {
  stars = 3;
} else if (normalizedScore >= 52) {
  stars = 2;
}

    let comment = "平均的な展示内容";

    if (stars === 5) {
      comment = "伸び・出足・バランス良好";
    } else if (stars === 4) {
      comment = "展示内容は良好";
    } else if (stars === 3) {
      comment = "全体的に平均レベル";
    } else if (stars === 2) {
      comment = "やや物足りない展示";
    } else if (stars === 1) {
      comment = "展示気配に注意";
    }

    return {
      ...entry,

      racer_name: normalizeName(
        entry.racer_name
      ),

      corrected_exhibition_time:
        correctedExhibition,

      corrected_lap_time:
        correctedLap,

      corrected_exhibition_st:
        correctedStart,

      bsc_score: normalizedScore,
      bsc_stars: stars,
      bsc_comment: comment,
    };
    });

  const exhibitionRankMap =
    createTimeRankMap(
      baseRows,
      "exhibition_time"
    );

  const lapRankMap =
    createTimeRankMap(
      baseRows,
      "lap_time"
    );

  const turnRankMap =
    createTimeRankMap(
      baseRows,
      "turn_time"
    );

  const straightRankMap =
    createTimeRankMap(
      baseRows,
      "straight_time"
    );

  const correctedExhibitionRankMap =
    createTimeRankMap(
      baseRows,
      "corrected_exhibition_time"
    );

  const correctedLapRankMap =
    createTimeRankMap(
      baseRows,
      "corrected_lap_time"
    );

 return baseRows.map((row) => {
  const boatNo = Number(row.boat_no);

  const correctedExhibitionRank =
    correctedExhibitionRankMap.get(
      boatNo
    ) ?? 6;

  const correctedLapRank =
    correctedLapRankMap.get(
      boatNo
    ) ?? 6;

  const totalRankScore =
    correctedExhibitionRank * 0.65 +
    correctedLapRank * 0.35;

  let bscStars = 1;

  if (totalRankScore <= 1.4) {
    bscStars = 5;
  } else if (totalRankScore <= 2.4) {
    bscStars = 4;
  } else if (totalRankScore <= 3.5) {
    bscStars = 3;
  } else if (totalRankScore <= 4.6) {
    bscStars = 2;
  }

  let bscComment = "展示気配に注意";

  if (bscStars === 5) {
    bscComment =
      "伸び・出足・バランス良好";
  } else if (bscStars === 4) {
    bscComment =
      "展示内容は良好";
  } else if (bscStars === 3) {
    bscComment =
      "全体的に平均レベル";
  } else if (bscStars === 2) {
    bscComment =
      "やや物足りない展示";
  }

  return {
    ...row,

    exhibition_rank:
      exhibitionRankMap.get(boatNo) ??
      null,

    lap_rank:
      lapRankMap.get(boatNo) ??
      null,

    turn_rank:
      turnRankMap.get(boatNo) ??
      null,

    straight_rank:
      straightRankMap.get(boatNo) ??
      null,

    corrected_exhibition_rank:
      correctedExhibitionRank,

    corrected_lap_rank:
      correctedLapRank,

    bsc_stars: bscStars,
    bsc_comment: bscComment,
  };
});
}

/* =========================================================
   公式展示テーブル
========================================================= */

function OfficialExhibitionTable({ rows }) {
  return (
    <section className={styles.exhibitionSection}>
      <div className={styles.exhibitionSectionTitle}>
        <span>⏱</span>
        <h3>公式展示情報</h3>
      </div>

      <div className={styles.exhibitionTableWrap}>
        <table className={styles.exhibitionTable}>
          <thead>
            <tr>
              <th>艇</th>
              <th>選手</th>
              <th>展示</th>
              <th>一周</th>
              <th>まわり足</th>
              <th>直線</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.boat_no}>
                <td className={styles.exhibitionBoatCell}>
                  <BoatBadge boatNo={row.boat_no} />
                </td>

                <td className={styles.exhibitionRacerName}>
                  {row.racer_name}
                </td>

                <td
                  className={`${styles.exhibitionTimeCell} ${getTimeRankClass(
                    row.exhibition_rank
                  )}`}
                >
                  {formatTime(row.exhibition_time)}
                </td>

                <td
                  className={`${styles.exhibitionTimeCell} ${getTimeRankClass(
                    row.lap_rank
                  )}`}
                >
                  {formatTime(row.lap_time)}
                </td>

                <td
                  className={`${styles.exhibitionTimeCell} ${getTimeRankClass(
                    row.turn_rank
                  )}`}
                >
                  {formatTime(row.turn_time)}
                </td>

                <td
                  className={`${styles.exhibitionTimeCell} ${getTimeRankClass(
                    row.straight_rank
                  )}`}
                >
                  {formatTime(row.straight_time)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* =========================================================
   BoatStrikers補正テーブル
========================================================= */

function CorrectedExhibitionTable({ rows }) {
  return (
    <section className={styles.exhibitionSection}>
      <div className={styles.exhibitionSectionTitle}>
        <span>🛥</span>
        <h3>BoatStrikers補正</h3>
      </div>

      <div className={styles.exhibitionTableWrap}>
        <table className={styles.exhibitionTable}>
          <thead>
            <tr>
              <th>艇</th>
              <th>選手</th>
              <th>補正展示</th>
              <th>補正一周</th>
              <th>評価</th>
              <th>コメント</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.boat_no}>
                <td className={styles.exhibitionBoatCell}>
                  <BoatBadge boatNo={row.boat_no} />
                </td>

                <td className={styles.exhibitionRacerName}>
                  {row.racer_name}
                </td>

                <td
                  className={`${styles.exhibitionTimeCell} ${getTimeRankClass(
                    row.corrected_exhibition_rank
                  )}`}
                >
                  {formatTime(
                    row.corrected_exhibition_time
                  )}
                </td>

                <td
                  className={`${styles.exhibitionTimeCell} ${getTimeRankClass(
                    row.corrected_lap_rank
                  )}`}
                >
                  {formatTime(
                    row.corrected_lap_time
                  )}
                </td>

                <td className={styles.bscEvaluationCell}>
                  <Stars count={row.bsc_stars} />
                </td>

                <td className={styles.bscExhibitionComment}>
                  {row.bsc_comment}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* =========================================================
   メイン
========================================================= */

export default function ExhibitionComparisonPanel({
  entries = [],
}) {
  /*
   * setStateやuseEffectを使わず、
   * entriesが変わった時だけ計算します。
   *
   * このためReactの無限ループは発生しません。
   */
  const rows = useMemo(() => {
    const normalizedEntries = Array.isArray(
      entries
    )
      ? entries
      : [];

    return buildCorrectedRows(
      normalizedEntries
    );
  }, [entries]);

  const officialStartEntries = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        exhibition_st:
          row.exhibition_st,
      })),
    [rows]
  );

  const correctedStartEntries = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        exhibition_st:
          row.corrected_exhibition_st,
      })),
    [rows]
  );

  const hasExhibitionData = rows.some(
    (row) =>
      row.exhibition_time !== null &&
      row.exhibition_time !== undefined
  );

  if (!hasExhibitionData) {
    return (
      <div className={styles.emptyAi}>
        <div className={styles.emptyAiIcon}>
          ⏱️
        </div>

        <h3>展示情報はまだありません</h3>

        <p>
          展示データ取得後、自動で表示されます。
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        styles.exhibitionComparisonPanel
      }
    >
      <div className={styles.panelHeading}>
        <div>
          <p>EXHIBITION COMPARISON</p>
          <h2>展示比較</h2>
        </div>

        <span className={styles.panelBadge}>
          自動順位
        </span>
      </div>

      <OfficialExhibitionTable
        rows={rows}
      />

      <CorrectedExhibitionTable
        rows={rows}
      />

      <section className={styles.exhibitionSection}>
        <div
          className={
            styles.exhibitionSectionTitle
          }
        >
          <span>⏱</span>
          <h3>
            公式スタート展示アニメーション
          </h3>
        </div>

        <AnimatedStartSlit
          entries={officialStartEntries}
        />
      </section>

      <section className={styles.exhibitionSection}>
        <div
          className={
            styles.exhibitionSectionTitle
          }
        >
          <span>🛥</span>
          <h3>
            BoatStrikers補正スタート
            アニメーション
          </h3>
        </div>

        <AnimatedStartSlit
          entries={correctedStartEntries}
        />
      </section>

      <p className={styles.aiDisclaimer}>
        ※ BoatStrikers補正は研究用の独自評価です。
        公式発表値ではありません。
      </p>
    </div>
  );
}

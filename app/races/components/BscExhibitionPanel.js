"use client";

import { useMemo } from "react";
import { buildBscExhibition } from "../../lib/bscExhibition";
import styles from "../phase2.module.css";

const f = (value, digits = 2) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(digits)
    : "-";
};

const n = (value) =>
  String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function BscExhibitionPanel({
  entries = [],
}) {
  const rows = useMemo(
    () => buildBscExhibition(entries),
    [entries]
  );

  const hasExhibitionData = rows.some(
    (row) =>
      row.exhibition_time != null ||
      row.lap_time != null ||
      row.turn_time != null ||
      row.straight_time != null ||
      row.exhibition_st != null
  );

  if (!hasExhibitionData) {
    return (
      <div className={styles.emptyAi}>
        <div className={styles.emptyAiIcon}>
          ⏱️
        </div>

        <h3>BSC展示はまだありません</h3>

        <p>
          展示取得後、5分同期で自動計算されます。
        </p>
      </div>
    );
  }

  const sortedRows = [...rows].sort(
    (a, b) =>
      Number(a.bscExhibitionRank ?? 999) -
      Number(b.bscExhibitionRank ?? 999)
  );

  return (
    <>
      <div className={styles.panelHeading}>
        <div>
          <p>BOATSTRIKERS EXHIBITION</p>
          <h2>BSCオリジナル展示</h2>
        </div>

        <span className={styles.panelBadge}>
          研究版
        </span>
      </div>

      <div className={styles.exhibitionList}>
        {sortedRows.map((row) => (
          <article
            className={styles.exhibitionRow}
            key={row.boat_no}
          >
            <span
              className={`${styles.boatBadge} ${
                styles[`boat${row.boat_no}`]
              }`}
            >
              {row.boat_no}
            </span>

            <div className={styles.exhibitionRacer}>
              <strong>
                {n(row.racer_name)}
              </strong>

              <span>
                展示 {f(row.exhibition_time)}
                {" / "}
                一周 {f(row.lap_time)}
                {" / "}
                まわり足 {f(row.turn_time)}
                {" / "}
                直線 {f(row.straight_time)}
                {" / "}
                ST {f(row.exhibition_st)}
              </span>
            </div>

            <div className={styles.exhibitionValue}>
              <small>BSC指数</small>
              <strong>
                {row.bscExhibitionScore ?? "-"}
              </strong>
            </div>

            <div className={styles.exhibitionValue}>
              <small>評価</small>
              <strong>
                {row.bscExhibitionGrade ?? "-"}
              </strong>
            </div>

            <span className={styles.rankBadge}>
              {row.bscExhibitionRank
                ? `${row.bscExhibitionRank}位`
                : "-"}
            </span>

            {Array.isArray(row.reasons) &&
              row.reasons.length > 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    gap: 5,
                    flexWrap: "wrap",
                  }}
                >
                  {row.reasons.map(
                    (reason, index) => (
                      <small
                        key={`${reason}-${index}`}
                        style={{
                          padding: "4px 7px",
                          borderRadius: 999,
                          background: "#eef6fb",
                        }}
                      >
                        {reason}
                      </small>
                    )
                  )}
                </div>
              )}
          </article>
        ))}
      </div>

      <p className={styles.aiDisclaimer}>
        ※ BSC展示指数は独自の研究用評価で、
        実測タイムではありません。
      </p>
    </>
  );
}

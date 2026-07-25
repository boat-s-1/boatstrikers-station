"use client";

import styles from "../phase2.module.css";

const st = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "-";
  }

  if (parsed < 0) {
    return `F${Math.abs(parsed).toFixed(2).replace(/^0/, "")}`;
  }

  return parsed.toFixed(2);
};

const payout = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? `${parsed.toLocaleString("ja-JP")}円`
    : "-";
};

function formatCombination(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const text = String(value).replace(/\D/g, "");

  if (text.length === 3) {
    return `${text[0]}-${text[1]}-${text[2]}`;
  }

  if (text.length === 2) {
    return `${text[0]}-${text[1]}`;
  }

  return String(value);
}

const WINNING_TECHNIQUE_LABELS = {
  "1": "逃げ",
  "2": "差し",
  "3": "まくり",
  "4": "まくり差し",
  "5": "抜き",
  "6": "恵まれ",
};

function formatWinningTechnique(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const code = String(value).trim();

  return WINNING_TECHNIQUE_LABELS[code] || code;
}

export default function RaceResultPanel({
  result,
  resultEntries,
  entries,
}) {
  if (!result || !resultEntries?.length) {
    return (
      <div className={styles.emptyAi}>
        <div className={styles.emptyAiIcon}>🏁</div>
        <h3>結果はまだありません</h3>
        <p>
          レース終了後、BRDB反映後に自動表示されます。
        </p>
      </div>
    );
  }

  const names = new Map(
    (entries || []).map((entry) => [
      Number(entry.boat_no),
      entry.racer_name,
    ])
  );

  const rows = [...resultEntries].sort(
    (a, b) =>
      (Number(a.arrival_order) || 99) -
      (Number(b.arrival_order) || 99)
  );

  return (
    <>
      <div className={styles.panelHeading}>
        <div>
          <p>RACE RESULT</p>
          <h2>レース結果</h2>
        </div>

        <span className={styles.panelBadge}>確定</span>
      </div>

      <div className={styles.predictionHero}>
        <div>
          <span className={styles.aiEyebrow}>TRIFECTA</span>

          <h3>{formatCombination(result.trifecta)}</h3>

          <small>
            決まり手{" "}
            {formatWinningTechnique(
              result.winning_technique_code
            )}
          </small>

          {result.trifecta_popularity !== null &&
            result.trifecta_popularity !== undefined && (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  fontWeight: 800,
                  opacity: 0.9,
                }}
              >
                {result.trifecta_popularity}番人気
              </div>
            )}
        </div>

        <div style={{ textAlign: "right" }}>
          <small>払戻</small>

          <strong
            style={{
              display: "block",
              fontSize: "25px",
            }}
          >
            {payout(result.trifecta_payout)}
          </strong>
        </div>
      </div>

      {result.exacta && (
        <div
          style={{
            marginTop: "12px",
            padding: "14px 18px",
            border: "1px solid #dce5ef",
            borderRadius: "14px",
            background: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div>
            <small
              style={{
                color: "#66778a",
                fontWeight: 800,
              }}
            >
              2連単
            </small>

            <strong
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "22px",
              }}
            >
              {formatCombination(result.exacta)}
            </strong>

            {result.exacta_popularity !== null &&
              result.exacta_popularity !== undefined && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#68778a",
                    fontWeight: 700,
                  }}
                >
                  {result.exacta_popularity}番人気
                </span>
              )}
          </div>

          <strong
            style={{
              fontSize: "20px",
            }}
          >
            {payout(result.exacta_payout)}
          </strong>
        </div>
      )}

      <div
        className={styles.exhibitionList}
        style={{ marginTop: "12px" }}
      >
        {rows.map((row) => {
          const boatNo = Number(row.boat_no);
          const arrivalOrder = Number(row.arrival_order);

          return (
            <article
              className={styles.exhibitionRow}
              key={row.boat_no}
            >
              <span
                className={`${styles.boatBadge} ${
                  styles[`boat${boatNo}`]
                }`}
              >
                {boatNo}
              </span>

              <div className={styles.exhibitionRacer}>
                <strong>
                  {String(
                    names.get(boatNo) || "選手名未取得"
                  )
                    .replace(/\u3000/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()}
                </strong>

                <span>
                  {Number.isFinite(arrivalOrder)
                    ? `${arrivalOrder}着`
                    : "-"}
                </span>
              </div>

              <div className={styles.exhibitionValue}>
                <small>進入</small>
                <strong>{row.actual_course ?? "-"}</strong>
              </div>

              <div className={styles.exhibitionValue}>
                <small>ST</small>
                <strong>
                  {st(row.actual_start_timing)}
                </strong>
              </div>

              <span className={styles.rankBadge}>
                {Number.isFinite(arrivalOrder)
                  ? `${arrivalOrder}着`
                  : "-"}
              </span>
            </article>
          );
        })}
      </div>
    </>
  );
}

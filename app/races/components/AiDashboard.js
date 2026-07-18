"use client";

import { useMemo } from "react";
import { buildAiDashboard } from "../../lib/aiDashboard";
import styles from "../phase2.module.css";

function format(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "-";
}

function racerName(value) {
  return String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function BoatBadge({ boatNo }) {
  return (
    <span
      className={`${styles.boatBadge} ${styles[`boat${boatNo}`]}`}
    >
      {boatNo}
    </span>
  );
}

function ScoreBar({ score }) {
  return (
    <div className={styles.aiScoreTrack}>
      <span
        className={styles.aiScoreFill}
        style={{ width: `${Math.max(4, score)}%` }}
      />
    </div>
  );
}

function EscapeMeter({ score, label }) {
  const level =
    score >= 88
      ? styles.escapeStrong
      : score >= 72
        ? styles.escapeGood
        : score >= 58
          ? styles.escapeCaution
          : styles.escapeDanger;

  return (
    <section className={`${styles.escapeCard} ${level}`}>
      <div>
        <p>ICHIKA IN ESCAPE INDEX</p>
        <h2>イン逃げ期待度</h2>
        <span className={styles.escapeLabel}>{label}</span>
      </div>

      <div className={styles.escapeCircle}>
        <strong>{score}</strong>
        <span>%</span>
      </div>

      <div className={styles.escapeTrack}>
        <span style={{ width: `${score}%` }} />
      </div>
    </section>
  );
}

export default function AiDashboard({ entries, syncedAt }) {
  const dashboard = useMemo(
    () => buildAiDashboard(entries),
    [entries]
  );

  return (
    <div className={styles.aiDashboard}>
      <div className={styles.liveUpdateBar}>
        <div>
          <span className={styles.liveDot} />
          <strong>LIVE AI DASHBOARD</strong>
        </div>
        <small>
          {dashboard.hasExhibition ? "展示反映済み" : "前日情報モード"}
          {syncedAt ? `・最終同期 ${syncedAt}` : ""}
        </small>
      </div>

      <EscapeMeter
        score={dashboard.escapeExpectation}
        label={dashboard.escapeGrade}
      />

      <section className={styles.aiDashboardCard}>
        <div className={styles.aiSectionHeading}>
          <div>
            <p>BOAT PERFORMANCE INDEX</p>
            <h2>6艇AI指数</h2>
          </div>
          <span>研究版</span>
        </div>

        <div className={styles.aiBoatList}>
          {dashboard.boats.map((boat) => (
            <article
              className={`${styles.aiBoatRow} ${
                boat.aiRank === 1 ? styles.aiBoatTop : ""
              }`}
              key={boat.boat_no}
            >
              <BoatBadge boatNo={boat.boat_no} />

              <div className={styles.aiBoatIdentity}>
                <strong>{racerName(boat.racer_name)}</strong>
                <span>
                  {boat.racer_class || "-"}・総合{boat.aiRank || "-"}位
                </span>
              </div>

              <div className={styles.aiBoatBarArea}>
                <div className={styles.aiBoatScoreHeader}>
                  <small>AI指数</small>
                  <strong>{boat.aiScore}</strong>
                </div>
                <ScoreBar score={boat.aiScore} />
              </div>

              <span
                className={`${styles.aiGrade} ${
                  styles[`aiGrade${boat.grade}`]
                }`}
              >
                {boat.grade}
              </span>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.aiTwoColumn}>
        <section className={styles.aiDashboardCard}>
          <div className={styles.aiSectionHeading}>
            <div>
              <p>EXHIBITION RANKING</p>
              <h2>展示タイム順位</h2>
            </div>
          </div>

          {dashboard.hasExhibition ? (
            <div className={styles.aiRankingList}>
              {[...dashboard.boats]
                .filter((boat) => boat.exhibitionRank)
                .sort(
                  (a, b) =>
                    a.exhibitionRank - b.exhibitionRank
                )
                .map((boat) => (
                  <div
                    className={styles.aiRankingRow}
                    key={boat.boat_no}
                  >
                    <span>{boat.exhibitionRank}位</span>
                    <BoatBadge boatNo={boat.boat_no} />
                    <strong>{racerName(boat.racer_name)}</strong>
                    <b>{format(boat.exhibition_time)}</b>
                  </div>
                ))}
            </div>
          ) : (
            <div className={styles.aiWaiting}>
              <span>⏱️</span>
              <strong>展示待ち</strong>
              <p>展示公開後、5分同期で順位が表示されます。</p>
            </div>
          )}
        </section>

        <section className={styles.aiDashboardCard}>
          <div className={styles.aiSectionHeading}>
            <div>
              <p>START EXHIBITION</p>
              <h2>展示ST順位</h2>
            </div>
          </div>

          {dashboard.hasExhibitionSt ? (
            <div className={styles.aiRankingList}>
              {[...dashboard.boats]
                .filter((boat) => boat.stRank)
                .sort((a, b) => a.stRank - b.stRank)
                .map((boat) => (
                  <div
                    className={styles.aiRankingRow}
                    key={boat.boat_no}
                  >
                    <span>{boat.stRank}位</span>
                    <BoatBadge boatNo={boat.boat_no} />
                    <strong>{racerName(boat.racer_name)}</strong>
                    <b>{format(boat.exhibition_st)}</b>
                  </div>
                ))}
            </div>
          ) : (
            <div className={styles.aiWaiting}>
              <span>🚦</span>
              <strong>展示ST待ち</strong>
              <p>展示ST取得後に自動順位を表示します。</p>
            </div>
          )}
        </section>
      </div>

      <section className={styles.ichikaCommentCard}>
        <div className={styles.ichikaCommentHead}>
          <span>🍓</span>
          <div>
            <p>ICHIKA AI COMMENT</p>
            <h2>一果のレース診断</h2>
          </div>
        </div>

        <p className={styles.ichikaCommentText}>
          {dashboard.comment}
        </p>

        <div className={styles.focusGrid}>
          {dashboard.focusBoats.map((boat, index) => (
            <div key={boat.boat_no}>
              <span>
                {index === 0
                  ? "本命"
                  : index === 1
                    ? "対抗"
                    : "単穴"}
              </span>
              <strong>{boat.boat_no}号艇</strong>
              <small>AI指数 {boat.aiScore}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.dangerCard}>
        <div className={styles.dangerIcon}>⚠️</div>
        <div className={styles.dangerBody}>
          <p>DANGER CHECK</p>
          <h2>危険サイン</h2>

          {dashboard.dangerBoat?.dangerSigns?.length ? (
            <>
              <strong>
                {dashboard.dangerBoat.boat_no}号艇{" "}
                {racerName(dashboard.dangerBoat.racer_name)}
              </strong>
              <ul>
                {dashboard.dangerBoat.dangerSigns.map((sign) => (
                  <li key={sign}>{sign}</li>
                ))}
              </ul>
            </>
          ) : (
            <strong>大きな危険サインはありません。</strong>
          )}
        </div>
      </section>

      <p className={styles.aiDisclaimer}>
        ※ Phase 3.1は同期データを使った研究用ルールベース指数です。
        学習済みIchika Brainの予測確率ではありません。
      </p>
    </div>
  );
}

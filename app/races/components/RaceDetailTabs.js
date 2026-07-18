"use client";

import { useMemo, useState } from "react";
import styles from "../phase2.module.css";

const TABS = [
  { key: "entries", icon: "📋", label: "出走表" },
  { key: "exhibition", icon: "⏱️", label: "展示" },
  { key: "previous", icon: "📰", label: "前日版" },
  { key: "live", icon: "⚡", label: "直前版" },
  { key: "bets", icon: "🎯", label: "買い目" },
];

function number(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "-";
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
  return (
    <div className={styles.emptyAi}>
      <div className={styles.emptyAiIcon}>{type === "live" ? "⚡" : "📰"}</div>
      <h3>{type === "live" ? "一果の直前版" : "一果の前日版"}は準備中です</h3>
      <p>
        AI予測がSupabaseのbs_ai_predictionsへ公開されると、
        この画面へ期待度・印・コメント・買い目が自動表示されます。
      </p>
    </div>
  );
}

function PredictionPanel({ prediction, title }) {
  if (!prediction) {
    return <EmptyAi type={title.includes("直前") ? "live" : "previous"} />;
  }

  const bets = Array.isArray(prediction.bet_json) ? prediction.bet_json : [];

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
          <strong>{prediction.main_boat ? `${prediction.main_boat}号艇` : "-"}</strong>
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
            <div className={styles.betRow} key={`${JSON.stringify(bet)}-${index}`}>
              <strong>
                {typeof bet === "string"
                  ? bet
                  : bet.bet || bet.combination || JSON.stringify(bet)}
              </strong>
              {typeof bet === "object" && bet.confidence && (
                <span>{bet.confidence}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RaceDetailTabs({
  entries,
  previousPrediction,
  livePrediction,
}) {
  const [activeTab, setActiveTab] = useState("entries");

  const exhibitionRows = useMemo(() => {
    const validTimes = entries
      .filter((entry) => entry.exhibition_time !== null)
      .sort(
        (a, b) =>
          Number(a.exhibition_time ?? 999) -
          Number(b.exhibition_time ?? 999)
      );

    const timeRank = new Map(
      validTimes.map((entry, index) => [entry.boat_no, index + 1])
    );

    return entries.map((entry) => ({
      ...entry,
      exhibitionRank: timeRank.get(entry.boat_no) || null,
    }));
  }, [entries]);

  const currentPrediction = livePrediction || previousPrediction;

  return (
    <>
      <nav className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`${styles.tabButton} ${
              activeTab === tab.key ? styles.tabButtonActive : ""
            }`}
          >
            <span>{tab.icon}</span>
            <strong>{tab.label}</strong>
          </button>
        ))}
      </nav>

      <section className={styles.detailPanel}>
        {activeTab === "entries" && (
          <>
            <div className={styles.panelHeading}>
              <div>
                <p>OFFICIAL ENTRY DATA</p>
                <h2>基本出走表</h2>
              </div>
              <span className={styles.panelBadge}>{entries.length}艇</span>
            </div>

            <div className={styles.entryCards}>
              {entries.map((entry) => (
                <article className={styles.entryCard} key={entry.boat_no}>
                  <div className={styles.entryCardTop}>
                    <BoatBadge boatNo={entry.boat_no} large />
                    <div className={styles.entryNameArea}>
                      <span className={styles.gradeBadge}>
                        {entry.racer_class || "-"}
                      </span>
                      <h3>{racerName(entry.racer_name)}</h3>
                      <p>登録番号 {entry.racer_registration_no || "-"}</p>
                    </div>
                  </div>

                  <div className={styles.statGrid}>
                    <div>
                      <span>全国勝率</span>
                      <strong>{number(entry.national_win_rate)}</strong>
                    </div>
                    <div>
                      <span>当地勝率</span>
                      <strong>{number(entry.local_win_rate)}</strong>
                    </div>
                    <div>
                      <span>展示</span>
                      <strong>{number(entry.exhibition_time)}</strong>
                    </div>
                    <div>
                      <span>展示ST</span>
                      <strong>{number(entry.exhibition_st)}</strong>
                    </div>
                  </div>

                  <div className={styles.machineGrid}>
                    <div>
                      <span>モーター</span>
                      <strong>{entry.motor_no ?? "-"}</strong>
                      <small>{number(entry.motor_2_rate)}%</small>
                    </div>
                    <div>
                      <span>ボート</span>
                      <strong>{entry.boat_machine_no ?? "-"}</strong>
                      <small>{number(entry.boat_2_rate)}%</small>
                    </div>
                    <div>
                      <span>チルト</span>
                      <strong>{number(entry.tilt, 1)}</strong>
                    </div>
                  </div>

                  <div className={styles.seriesRow}>
                    <span>今節成績</span>
                    <strong>{entry.current_series_results || "-"}</strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {activeTab === "exhibition" && (
          <>
            <div className={styles.panelHeading}>
              <div>
                <p>EXHIBITION COMPARISON</p>
                <h2>展示比較</h2>
              </div>
              <span className={styles.panelBadge}>自動順位</span>
            </div>

            {exhibitionRows.every(
              (entry) => entry.exhibition_time === null
            ) ? (
              <div className={styles.emptyAi}>
                <div className={styles.emptyAiIcon}>⏱️</div>
                <h3>展示情報はまだありません</h3>
                <p>展示発表後、次回の5分同期で自動表示されます。</p>
              </div>
            ) : (
              <div className={styles.exhibitionList}>
                {exhibitionRows.map((entry) => {
                  const rank = entry.exhibitionRank;
                  const rankClass =
                    rank === 1
                      ? styles.rankFirst
                      : rank === 2
                        ? styles.rankSecond
                        : rank === 3
                          ? styles.rankThird
                          : "";

                  return (
                    <article className={styles.exhibitionRow} key={entry.boat_no}>
                      <BoatBadge boatNo={entry.boat_no} />
                      <div className={styles.exhibitionRacer}>
                        <strong>{racerName(entry.racer_name)}</strong>
                        <span>{entry.racer_class || "-"}</span>
                      </div>
                      <div className={styles.exhibitionValue}>
                        <small>展示タイム</small>
                        <strong>{number(entry.exhibition_time)}</strong>
                      </div>
                      <div className={styles.exhibitionValue}>
                        <small>展示ST</small>
                        <strong>{number(entry.exhibition_st)}</strong>
                      </div>
                      <span className={`${styles.rankBadge} ${rankClass}`}>
                        {rank ? `${rank}位` : "-"}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "previous" && (
          <PredictionPanel
            prediction={previousPrediction}
            title="一果 前日版"
          />
        )}

        {activeTab === "live" && (
          <PredictionPanel
            prediction={livePrediction}
            title="一果 直前版"
          />
        )}

        {activeTab === "bets" && (
          <>
            <div className={styles.panelHeading}>
              <div>
                <p>AI RECOMMENDATION</p>
                <h2>おすすめ買い目</h2>
              </div>
              <span className={styles.panelBadge}>
                {livePrediction ? "直前版" : previousPrediction ? "前日版" : "準備中"}
              </span>
            </div>

            {currentPrediction ? (
              <PredictionPanel
                prediction={currentPrediction}
                title={livePrediction ? "最終買い目" : "前日買い目"}
              />
            ) : (
              <EmptyAi type="previous" />
            )}
          </>
        )}
      </section>
    </>
  );
}

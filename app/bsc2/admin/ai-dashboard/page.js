"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";

const DEFAULT_KEY_NAMES = [
  "bsc_ai_admin_key",
  "BSC_AI_ADMIN_KEY",
  "aiAdminKey",
];

function getStoredKey() {
  if (typeof window === "undefined") return "";

  for (const name of DEFAULT_KEY_NAMES) {
    const value =
      window.localStorage.getItem(name) ||
      window.sessionStorage.getItem(name);

    if (value) return value;
  }

  return "";
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatScore(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(1);
}

function starText(count) {
  const stars = Math.max(1, Math.min(5, Number(count || 1)));
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

function labelClass(label) {
  if (label === "イン鉄板") return styles.labelIron;
  if (label === "イン有力") return styles.labelInside;
  if (label === "女子戦注目") return styles.labelFemale;
  if (label === "穴期待") return styles.labelHole;
  if (label === "5アタマ警戒") return styles.labelAlert;
  if (label === "イン危険") return styles.labelDanger;
  if (label === "見送り") return styles.labelSkip;
  return styles.labelWatch;
}

function Metric({ label, value, kind = "percent" }) {
  const number = Number(value || 0);
  const width = Math.max(0, Math.min(100, number));

  return (
    <div className={styles.metric}>
      <div className={styles.metricHeader}>
        <span>{label}</span>
        <strong>
          {kind === "score" ? formatScore(value) : `${number.toFixed(1)}%`}
        </strong>
      </div>

      <div className={styles.metricTrack}>
        <div
          className={styles.metricBar}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ProbabilityBox({ name, probability, icon }) {
  return (
    <div className={styles.probabilityBox}>
      <span className={styles.probabilityIcon}>{icon}</span>
      <span className={styles.probabilityName}>{name}</span>
      <strong>{formatPercent(probability)}</strong>
    </div>
  );
}

function TicketList({ tickets }) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return (
      <p className={styles.emptyText}>
        この診断では推奨買い目を出していません。
      </p>
    );
  }

  return (
    <div className={styles.ticketGrid}>
      {tickets.map((ticket, index) => (
        <div className={styles.ticketCard} key={`${ticket.ticket}-${index}`}>
          <span className={styles.ticketMark}>{ticket.mark || "・"}</span>
          <div>
            <small>{ticket.category || "候補"}</small>
            <strong>{ticket.ticket}</strong>
            <p>{ticket.reason || ""}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreBreakdown({ contributions }) {
  const scoreItems = Array.isArray(contributions)
    ? contributions.filter((item) => String(item.key || "").startsWith("score_"))
    : [];

  if (scoreItems.length === 0) {
    return (
      <p className={styles.emptyText}>
        採点内訳はまだありません。
      </p>
    );
  }

  return (
    <div className={styles.breakdownList}>
      {scoreItems.map((item, index) => (
        <div className={styles.breakdownRow} key={`${item.key}-${index}`}>
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
          <span className={Number(item.points) < 0 ? styles.minus : styles.plus}>
            {Number(item.points) >= 0 ? "+" : ""}
            {Number(item.points).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RaceDetail({ race, onClose }) {
  if (!race) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <div className={styles.detailTop}>
          <div>
            <span className={styles.rankBadge}>第{race.daily_rank}位</span>
            <h2>
              場{race.stadium_code}・{race.race_no}R
            </h2>
          </div>

          <div className={styles.detailScore}>
            <span>{starText(race.star_count)}</span>
            <strong>{formatScore(race.total_score)}点</strong>
          </div>
        </div>

        <span className={`${styles.diagnosisLabel} ${labelClass(race.diagnosis_label)}`}>
          {race.diagnosis_label}
        </span>

        <div className={styles.probabilityGrid}>
          <ProbabilityBox
            name="一果AI"
            probability={race.ichika_probability}
            icon="🍀"
          />
          <ProbabilityBox
            name="初音AI"
            probability={race.hatsune_probability}
            icon="🎀"
          />
          <ProbabilityBox
            name="キイナAI"
            probability={race.kiina_probability}
            icon="⭐"
          />
        </div>

        <div className={styles.metricGrid}>
          <Metric label="イン期待" value={race.inside_expectation} />
          <Metric label="穴期待" value={race.hole_expectation} />
          <Metric label="危険度" value={race.danger_score} />
          <Metric label="AI一致率" value={race.consensus_score} />
        </div>

        <section className={styles.detailSection}>
          <h3>AIコメント</h3>
          <ul className={styles.commentList}>
            {(race.comments || []).map((comment, index) => (
              <li key={`${comment}-${index}`}>{comment}</li>
            ))}
          </ul>
        </section>

        <section className={styles.detailSection}>
          <h3>推奨買い目</h3>
          <TicketList tickets={race.tickets} />
        </section>

        <section className={styles.detailSection}>
          <h3>採点内訳</h3>
          <ScoreBreakdown contributions={race.contributions} />
        </section>
      </div>
    </div>
  );
}

export default function AiDashboardPage() {
  const [selectedDate, setSelectedDate] = useState("");
  const [races, setRaces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    const localDate = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 10);

    setSelectedDate(localDate);

    const stored = getStoredKey();
    setAdminKey(stored);
    setKeyInput(stored);
  }, []);

  async function loadDashboard(date, key = adminKey) {
    if (!date || !key) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/bsc2/ai-dashboard?date=${encodeURIComponent(date)}`,
        {
          headers: {
            "x-bsc-ai-key": key,
          },
          cache: "no-store",
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "ダッシュボードの取得に失敗しました");
      }

      setRaces(body.races || []);
      setSummary(body.summary || null);
    } catch (requestError) {
      setError(requestError.message || "取得に失敗しました");
      setRaces([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedDate && adminKey) {
      loadDashboard(selectedDate, adminKey);
    }
  }, [selectedDate, adminKey]);

  function saveAdminKey(event) {
    event.preventDefault();

    const value = keyInput.trim();

    if (!value) return;

    window.sessionStorage.setItem("bsc_ai_admin_key", value);
    setAdminKey(value);
  }

  const topRace = races[0] || null;

  const statusMessage = useMemo(() => {
    if (!summary) return "";

    if (summary.maxScore >= 85) {
      return "今日は強い推奨レースがあります。";
    }

    if (summary.maxScore >= 75) {
      return "今日は狙い目候補があります。";
    }

    if (summary.maxScore >= 62) {
      return "今日は条件付き候補が中心です。";
    }

    return "今日は強い推奨が少ないため、慎重な判断を優先します。";
  }, [summary]);

  if (!adminKey) {
    return (
      <main className={styles.page}>
        <form className={styles.loginCard} onSubmit={saveAdminKey}>
          <span className={styles.eyebrow}>BOAT STRIKERS AI</span>
          <h1>AI診断ダッシュボード</h1>
          <p>Vercelへ登録したBSC_AI_ADMIN_KEYを入力してください。</p>

          <input
            type="password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="AI管理キー"
            autoComplete="current-password"
          />

          <button type="submit">ダッシュボードを開く</button>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>BOAT STRIKERS AI ULTIMATE</span>
          <h1>AI診断ダッシュボード</h1>
          <p>絶対評価と当日ランキングを分けて表示します。</p>
        </div>

        <div className={styles.headerActions}>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
          <button
            type="button"
            onClick={() => loadDashboard(selectedDate)}
            disabled={loading}
          >
            {loading ? "更新中…" : "最新状態へ更新"}
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      {summary && (
        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>診断レース</span>
            <strong>{summary.totalRaces}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>最高スコア</span>
            <strong>{formatScore(summary.maxScore)}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>★★★★★</span>
            <strong>{summary.fiveStarCount}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>見送り</span>
            <strong>{summary.skipCount}</strong>
          </div>
        </section>
      )}

      {summary && (
        <div className={styles.dailyMessage}>
          <span>本日のAI判断</span>
          <strong>{statusMessage}</strong>
        </div>
      )}

      {topRace && (
        <section className={styles.heroCard}>
          <div>
            <span className={styles.heroRank}>本日のAIランキング 1位</span>
            <h2>
              場{topRace.stadium_code}・{topRace.race_no}R
            </h2>
            <span
              className={`${styles.diagnosisLabel} ${labelClass(
                topRace.diagnosis_label,
              )}`}
            >
              {topRace.diagnosis_label}
            </span>
          </div>

          <div className={styles.heroScore}>
            <span>{starText(topRace.star_count)}</span>
            <strong>{formatScore(topRace.total_score)}点</strong>
            <small>{topRace.star_label}</small>
          </div>

          <button type="button" onClick={() => setSelectedRace(topRace)}>
            診断詳細を見る
          </button>
        </section>
      )}

      <section className={styles.rankingSection}>
        <div className={styles.sectionTitle}>
          <div>
            <span className={styles.eyebrow}>TODAY&apos;S RANKING</span>
            <h2>本日の総合ランキング</h2>
          </div>
          <span>{races.length}レース</span>
        </div>

        {loading ? (
          <div className={styles.loadingBox}>診断結果を取得しています…</div>
        ) : races.length === 0 ? (
          <div className={styles.loadingBox}>
            この日付の診断結果はありません。
          </div>
        ) : (
          <div className={styles.raceList}>
            {races.map((race) => (
              <button
                type="button"
                className={styles.raceCard}
                key={race.id}
                onClick={() => setSelectedRace(race)}
              >
                <span className={styles.listRank}>{race.daily_rank}</span>

                <div className={styles.raceMain}>
                  <small>{race.race_date}</small>
                  <strong>
                    場{race.stadium_code}・{race.race_no}R
                  </strong>
                  <div className={styles.listProbabilities}>
                    <span>一果 {formatPercent(race.ichika_probability)}</span>
                    <span>初音 {formatPercent(race.hatsune_probability)}</span>
                    <span>キイナ {formatPercent(race.kiina_probability)}</span>
                  </div>
                </div>

                <span
                  className={`${styles.diagnosisLabel} ${labelClass(
                    race.diagnosis_label,
                  )}`}
                >
                  {race.diagnosis_label}
                </span>

                <div className={styles.listScore}>
                  <span>{starText(race.star_count)}</span>
                  <strong>{formatScore(race.total_score)}</strong>
                  <small>点</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <RaceDetail
        race={selectedRace}
        onClose={() => setSelectedRace(null)}
      />
    </main>
  );
}

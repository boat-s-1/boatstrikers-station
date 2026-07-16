"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";

const STORAGE_KEY = "bsc_ai_admin_key";

function formatPercent(value, scale = 100) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return `${(Number(value) * scale).toFixed(1)}%`;
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return Number(value).toFixed(1);
}

function starText(count) {
  const normalized = Math.max(1, Math.min(5, Number(count || 1)));
  return `${"★".repeat(normalized)}${"☆".repeat(5 - normalized)}`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function getLabelTone(label) {
  const map = {
    イン鉄板: "iron",
    イン有力: "inside",
    女子戦注目: "female",
    穴期待: "hole",
    "5アタマ警戒": "alert",
    イン危険: "danger",
    見送り: "skip",
    様子見: "watch",
  };

  return map[label] || "watch";
}

function getRecommendationText(score) {
  if (score >= 85) return "積極的に検討";
  if (score >= 75) return "狙い目候補";
  if (score >= 62) return "条件付きで検討";
  if (score >= 48) return "資金を抑えて慎重";
  return "見送り優先";
}

function getBuyIndex(race) {
  const score = Number(race.total_score || 0);
  const danger = Number(race.danger_score || 0);
  const consensus = Number(race.consensus_score || 0);

  return clamp(score * 0.7 + (100 - danger) * 0.15 + consensus * 0.15);
}

function getHitIndex(race) {
  const inside = Number(race.inside_expectation || 0);
  const consensus = Number(race.consensus_score || 0);
  const danger = Number(race.danger_score || 0);

  return clamp(inside * 0.55 + consensus * 0.25 + (100 - danger) * 0.2);
}

function getChaosIndex(race) {
  const hole = Number(race.hole_expectation || 0);
  const danger = Number(race.danger_score || 0);
  const consensus = Number(race.consensus_score || 0);

  return clamp(hole * 0.45 + danger * 0.4 + (100 - consensus) * 0.15);
}

function getRecommendIndex(race) {
  const score = Number(race.total_score || 0);
  const buy = getBuyIndex(race);

  return clamp(score * 0.65 + buy * 0.35);
}

function ScoreRing({ value, label, suffix = "%" }) {
  const normalized = clamp(value);

  return (
    <div
      className={styles.scoreRing}
      style={{
        "--ring-value": `${normalized * 3.6}deg`,
      }}
    >
      <div>
        <strong>{normalized.toFixed(0)}{suffix}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Meter({ label, value, tone = "blue" }) {
  const normalized = clamp(value);

  return (
    <div className={styles.meter}>
      <div className={styles.meterHeader}>
        <span>{label}</span>
        <strong>{normalized.toFixed(1)}%</strong>
      </div>

      <div className={styles.meterTrack}>
        <div
          className={`${styles.meterFill} ${styles[`meter_${tone}`]}`}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function CharacterProbability({ icon, name, value, className = "" }) {
  return (
    <div className={`${styles.characterProbability} ${className}`}>
      <span className={styles.characterIcon}>{icon}</span>
      <div>
        <small>{name}</small>
        <strong>{formatPercent(value)}</strong>
      </div>
    </div>
  );
}

function TicketCards({ tickets }) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return (
      <div className={styles.emptyNotice}>
        この診断では推奨買い目を出していません。
      </div>
    );
  }

  return (
    <div className={styles.ticketCards}>
      {tickets.map((ticket, index) => (
        <div className={styles.ticketCard} key={`${ticket.ticket}-${index}`}>
          <span className={styles.ticketMark}>{ticket.mark || "・"}</span>
          <div className={styles.ticketBody}>
            <small>{ticket.category || "候補"}</small>
            <strong>{ticket.ticket}</strong>
            <p>{ticket.reason || ""}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContributionList({ contributions }) {
  const scoreItems = Array.isArray(contributions)
    ? contributions.filter((item) =>
        String(item.key || "").startsWith("score_"),
      )
    : [];

  if (scoreItems.length === 0) {
    return (
      <div className={styles.emptyNotice}>
        採点内訳はまだありません。
      </div>
    );
  }

  return (
    <div className={styles.contributionList}>
      {scoreItems.map((item, index) => {
        const value = Number(item.points || 0);

        return (
          <div className={styles.contributionRow} key={`${item.key}-${index}`}>
            <div>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>

            <span className={value < 0 ? styles.negative : styles.positive}>
              {value >= 0 ? "+" : ""}
              {value.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RaceModal({ race, onClose }) {
  if (!race) return null;

  const buyIndex = getBuyIndex(race);
  const hitIndex = getHitIndex(race);
  const chaosIndex = getChaosIndex(race);
  const recommendIndex = getRecommendIndex(race);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.modalClose} onClick={onClose}>
          ×
        </button>

        <div className={styles.modalHeader}>
          <div>
            <span className={styles.rankPill}>本日 第{race.daily_rank}位</span>
            <h2>場{race.stadium_code}・{race.race_no}R</h2>
            <span
              className={`${styles.labelBadge} ${
                styles[`label_${getLabelTone(race.diagnosis_label)}`]
              }`}
            >
              {race.diagnosis_label}
            </span>
          </div>

          <div className={styles.modalMainScore}>
            <span>{starText(race.star_count)}</span>
            <strong>{formatScore(race.total_score)}点</strong>
            <small>{race.star_label}</small>
          </div>
        </div>

        <div className={styles.recommendationBanner}>
          <div>
            <span>AI総合判断</span>
            <strong>{getRecommendationText(Number(race.total_score || 0))}</strong>
          </div>
          <p>
            絶対評価と当日順位を合わせて判断し、資金配分を調整してください。
          </p>
        </div>

        <div className={styles.indexGrid}>
          <ScoreRing value={buyIndex} label="買い度" />
          <ScoreRing value={hitIndex} label="的中期待" />
          <ScoreRing value={chaosIndex} label="荒れ度" />
          <ScoreRing value={recommendIndex} label="おすすめ度" />
        </div>

        <section className={styles.modalSection}>
          <div className={styles.sectionHeading}>
            <h3>3人のAI評価</h3>
            <span>補正済み確率</span>
          </div>

          <div className={styles.characterGrid}>
            <CharacterProbability
              icon="🍀"
              name="一果AI"
              value={race.ichika_probability}
              className={styles.ichikaBox}
            />
            <CharacterProbability
              icon="🎀"
              name="初音AI"
              value={race.hatsune_probability}
              className={styles.hatsuneBox}
            />
            <CharacterProbability
              icon="⭐"
              name="キイナAI"
              value={race.kiina_probability}
              className={styles.kiinaBox}
            />
          </div>
        </section>

        <section className={styles.modalSection}>
          <div className={styles.sectionHeading}>
            <h3>レース診断メーター</h3>
            <span>0〜100%</span>
          </div>

          <div className={styles.meterGrid}>
            <Meter label="イン期待" value={race.inside_expectation} tone="blue" />
            <Meter label="穴期待" value={race.hole_expectation} tone="purple" />
            <Meter label="危険度" value={race.danger_score} tone="red" />
            <Meter label="AI一致率" value={race.consensus_score} tone="green" />
          </div>
        </section>

        <section className={styles.modalSection}>
          <div className={styles.sectionHeading}>
            <h3>AIコメント</h3>
            <span>診断理由</span>
          </div>

          <div className={styles.commentBubble}>
            <span>🤖</span>
            <ul>
              {(race.comments || []).map((comment, index) => (
                <li key={`${comment}-${index}`}>{comment}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.modalSection}>
          <div className={styles.sectionHeading}>
            <h3>推奨買い目</h3>
            <span>3連単候補</span>
          </div>

          <TicketCards tickets={race.tickets} />
        </section>

        <section className={styles.modalSection}>
          <div className={styles.sectionHeading}>
            <h3>採点内訳</h3>
            <span>加点・減点</span>
          </div>

          <ContributionList contributions={race.contributions} />
        </section>
      </div>
    </div>
  );
}

export default function ProductAiDashboard() {
  const [selectedDate, setSelectedDate] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [races, setRaces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [filter, setFilter] = useState("all");
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

    const storedKey =
      window.sessionStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(STORAGE_KEY) ||
      "";

    setAdminKey(storedKey);
    setKeyInput(storedKey);
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

      const text = await response.text();
      let body;

      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(
          response.status === 404
            ? "AIダッシュボードAPIが見つかりません。route.jsの配置を確認してください。"
            : `APIからJSON以外の応答が返りました（HTTP ${response.status}）。`,
        );
      }

      if (!response.ok) {
        throw new Error(body.error || "ダッシュボード取得に失敗しました");
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

    window.sessionStorage.setItem(STORAGE_KEY, value);
    setAdminKey(value);
  }

  function logout() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setKeyInput("");
    setRaces([]);
    setSummary(null);
  }

  const filteredRaces = useMemo(() => {
    if (filter === "all") return races;
    if (filter === "top") return races.filter((race) => Number(race.star_count) >= 3);
    if (filter === "inside") {
      return races.filter((race) =>
        ["イン鉄板", "イン有力", "女子戦注目"].includes(race.diagnosis_label),
      );
    }
    if (filter === "hole") {
      return races.filter((race) =>
        ["穴期待", "5アタマ警戒"].includes(race.diagnosis_label),
      );
    }
    if (filter === "danger") {
      return races.filter((race) =>
        ["イン危険", "見送り"].includes(race.diagnosis_label),
      );
    }

    return races;
  }, [races, filter]);

  const topRace = races[0] || null;

  const dailyMessage = useMemo(() => {
    const maxScore = Number(summary?.maxScore || 0);

    if (maxScore >= 85) {
      return "今日は強い推奨レースがあります。";
    }

    if (maxScore >= 75) {
      return "今日は狙い目候補があります。";
    }

    if (maxScore >= 62) {
      return "今日は条件付き候補が中心です。";
    }

    return "今日は強い推奨が少ないため、慎重な判断を優先します。";
  }, [summary]);

  if (!adminKey) {
    return (
      <main className={styles.loginPage}>
        <form className={styles.loginCard} onSubmit={saveAdminKey}>
          <span className={styles.eyebrow}>BOAT STRIKERS AI ULTIMATE</span>
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

          <Link href="/bsc2/admin">通常の管理画面へ戻る</Link>
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
          <Link href="/bsc2/admin" className={styles.secondaryButton}>
            管理画面へ戻る
          </Link>

          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => loadDashboard(selectedDate)}
            disabled={loading}
          >
            {loading ? "更新中…" : "最新状態へ更新"}
          </button>

          <button type="button" className={styles.logoutButton} onClick={logout}>
            ログアウト
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
          <div>
            <span>本日のAI判断</span>
            <strong>{dailyMessage}</strong>
          </div>
          <small>
            診断バージョン: {summary.diagnosisVersion || "—"}
          </small>
        </div>
      )}

      {topRace && (
        <section className={styles.heroCard}>
          <div className={styles.heroMain}>
            <span className={styles.heroRank}>🥇 本日のAIランキング 1位</span>
            <h2>場{topRace.stadium_code}・{topRace.race_no}R</h2>
            <span
              className={`${styles.labelBadge} ${
                styles[`label_${getLabelTone(topRace.diagnosis_label)}`]
              }`}
            >
              {topRace.diagnosis_label}
            </span>

            <p>{getRecommendationText(Number(topRace.total_score || 0))}</p>
          </div>

          <div className={styles.heroIndexes}>
            <ScoreRing value={getBuyIndex(topRace)} label="買い度" />
            <ScoreRing value={getHitIndex(topRace)} label="的中期待" />
            <ScoreRing value={getChaosIndex(topRace)} label="荒れ度" />
          </div>

          <div className={styles.heroScore}>
            <span>{starText(topRace.star_count)}</span>
            <strong>{formatScore(topRace.total_score)}点</strong>
            <small>{topRace.star_label}</small>

            <button type="button" onClick={() => setSelectedRace(topRace)}>
              診断詳細を見る
            </button>
          </div>
        </section>
      )}

      <section className={styles.rankingSection}>
        <div className={styles.rankingHeader}>
          <div>
            <span className={styles.eyebrow}>TODAY&apos;S RANKING</span>
            <h2>本日の総合ランキング</h2>
          </div>

          <div className={styles.filterGroup}>
            {[
              ["all", "すべて"],
              ["top", "★3以上"],
              ["inside", "イン系"],
              ["hole", "穴系"],
              ["danger", "危険・見送り"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? styles.activeFilter : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>診断結果を取得しています…</div>
        ) : filteredRaces.length === 0 ? (
          <div className={styles.emptyState}>
            条件に合う診断結果はありません。
          </div>
        ) : (
          <div className={styles.raceList}>
            {filteredRaces.map((race) => (
              <button
                type="button"
                className={styles.raceCard}
                key={race.id}
                onClick={() => setSelectedRace(race)}
              >
                <span className={styles.listRank}>{race.daily_rank}</span>

                <div className={styles.raceIdentity}>
                  <small>{race.race_date}</small>
                  <strong>場{race.stadium_code}・{race.race_no}R</strong>

                  <div className={styles.miniProbabilities}>
                    <span>一果 {formatPercent(race.ichika_probability)}</span>
                    <span>初音 {formatPercent(race.hatsune_probability)}</span>
                    <span>キイナ {formatPercent(race.kiina_probability)}</span>
                  </div>
                </div>

                <span
                  className={`${styles.labelBadge} ${
                    styles[`label_${getLabelTone(race.diagnosis_label)}`]
                  }`}
                >
                  {race.diagnosis_label}
                </span>

                <div className={styles.raceIndicators}>
                  <span>買い度 {getBuyIndex(race).toFixed(0)}%</span>
                  <span>危険度 {Number(race.danger_score || 0).toFixed(0)}%</span>
                </div>

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

      <RaceModal race={selectedRace} onClose={() => setSelectedRace(null)} />
    </main>
  );
}

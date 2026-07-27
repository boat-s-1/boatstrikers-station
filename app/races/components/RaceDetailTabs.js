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

function predictionArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  return [];
}

function factorValue(prediction, ...keys) {
  const factors =
    prediction?.factors && typeof prediction.factors === "object"
      ? prediction.factors
      : {};

  for (const key of keys) {
    const value = prediction?.[key] ?? factors?.[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function displayPercent(value) {
  const parsed = finiteNumber(value);
  return parsed === null ? "-" : `${Math.round(parsed)}%`;
}

function displayEvaluation(value) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = finiteNumber(value);
  if (parsed === null) return String(value);
  if (parsed >= 90) return "S";
  if (parsed >= 80) return "A";
  if (parsed >= 70) return "B";
  if (parsed >= 60) return "C";
  return "D";
}

function normalizeMarks(prediction) {
  const source = predictionArray(prediction?.marks);
  const fallbackBoats = [
    prediction?.main_boat,
    prediction?.second_boat,
    prediction?.third_boat,
    prediction?.fourth_boat,
  ];
  const symbols = ["◎", "○", "▲", "△"];

  if (Array.isArray(source) && source.length) {
    return source.slice(0, 4).map((item, index) => {
      if (typeof item === "number" || typeof item === "string") {
        return { symbol: symbols[index], boatNo: Number(item) || item };
      }
      return {
        symbol: item.symbol || item.mark || symbols[index],
        boatNo: item.boat_no || item.boatNo || item.boat || item.number,
      };
    });
  }

  if (source && !Array.isArray(source) && typeof source === "object") {
    return symbols
      .map((symbol) => ({ symbol, boatNo: source[symbol] }))
      .filter((item) => item.boatNo);
  }

  return fallbackBoats
    .map((boatNo, index) => ({ symbol: symbols[index], boatNo }))
    .filter((item) => item.boatNo);
}

function hasPublishedNote(noteFeature, timing) {
  if (!noteFeature?.is_published || !noteFeature?.note_url) return false;
  const scope = String(
    noteFeature.target_timing || noteFeature.content_scope || "both"
  ).toLowerCase();
  return scope === "both" || scope === timing;
}

function NoteGuideCard({ noteFeature, timing }) {
  if (!hasPublishedNote(noteFeature, timing)) return null;

  const isLive = timing === "live";
  const isPaid = Boolean(noteFeature.is_paid);

  return (
    <div
      style={{
        marginTop: "18px",
        padding: "20px",
        borderRadius: "18px",
        color: "#fff",
        background: isLive
          ? "linear-gradient(135deg, #152f55 0%, #1769e0 60%, #34a5ff 100%)"
          : "linear-gradient(135deg, #7b2d00 0%, #e56518 58%, #ffb02e 100%)",
        boxShadow: "0 12px 30px rgba(32, 60, 98, .2)",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 900, letterSpacing: ".14em", opacity: .9 }}>
        NOTE EXCLUSIVE ANALYSIS
      </div>
      <h3 style={{ margin: "6px 0 8px", fontSize: "22px" }}>
        {noteFeature.feature_title || (isLive ? "展示後の最終分析を公開中" : "一果の徹底解説を公開中")}
      </h3>
      <p style={{ margin: 0, lineHeight: 1.8, fontWeight: 700 }}>
        {noteFeature.teaser_text ||
          (isLive
            ? "最終買い目・展開予想・資金配分はnoteで公開しています。"
            : "詳しい根拠・買い目・資金配分はnoteで公開しています。")}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px",
          marginTop: "14px",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {(isLive
          ? ["展示後の展開予想", "最終買い目", "評価変更の理由", "資金配分"]
          : ["本命・対抗の根拠", "危険ポイント", "おすすめ買い目", "資金配分"]
        ).map((label) => (
          <div key={label} style={{ padding: "8px 10px", borderRadius: "10px", background: "rgba(255,255,255,.14)" }}>
            ✓ {label}
          </div>
        ))}
      </div>

      <a
        href={noteFeature.note_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          marginTop: "16px",
          padding: "13px 16px",
          borderRadius: "12px",
          background: "#fff",
          color: isLive ? "#1256ad" : "#a64500",
          textAlign: "center",
          textDecoration: "none",
          fontWeight: 1000,
        }}
      >
        📖 {noteFeature.cta_label || (isPaid ? "note有料版で買い目を見る" : "noteで詳しく見る")}
      </a>
    </div>
  );
}

function MarksPanel({ prediction, title = "最終印" }) {
  const marks = normalizeMarks(prediction);
  if (!marks.length) return null;

  return (
    <div style={{ marginTop: "16px", padding: "16px", border: "1px solid #e1e8f1", borderRadius: "16px", background: "#fff" }}>
      <h4 style={{ margin: "0 0 12px", fontSize: "16px" }}>{title}</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" }}>
        {marks.map((mark) => (
          <div key={`${mark.symbol}-${mark.boatNo}`} style={{ display: "grid", placeItems: "center", padding: "10px 4px", borderRadius: "12px", background: mark.symbol === "◎" ? "#fff2df" : "#f5f8fc" }}>
            <strong style={{ fontSize: "23px", color: mark.symbol === "◎" ? "#e16415" : "#31465e" }}>{mark.symbol}</strong>
            <span style={{ fontSize: "13px", fontWeight: 900 }}>{mark.boatNo}号艇</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiBetList({ prediction, title = "AIおすすめ買い目" }) {
  const bets = Array.isArray(prediction?.bet_json) ? prediction.bet_json : [];

  if (!bets.length) {
    return (
      <div className={styles.emptyAi} style={{ marginTop: "16px" }}>
        <div className={styles.emptyAiIcon}>🎯</div>
        <h3>AI買い目はまだありません</h3>
        <p>予測データが揃うと自動表示されます。</p>
      </div>
    );
  }

  return (
    <div className={styles.betList} style={{ marginTop: "16px" }}>
      <h4>{title}</h4>
      {bets.map((bet, index) => (
        <div className={styles.betRow} key={`${JSON.stringify(bet)}-${index}`}>
          <strong>{typeof bet === "string" ? bet : bet.bet || bet.combination || JSON.stringify(bet)}</strong>
          {typeof bet === "object" && bet !== null && bet.confidence && <span>{bet.confidence}</span>}
        </div>
      ))}
    </div>
  );
}

function scoreToStars(value, inverse = false) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "-";

  let normalized = Math.max(0, Math.min(100, parsed));
  if (inverse) normalized = 100 - normalized;

  const count = normalized >= 85 ? 5 : normalized >= 70 ? 4 : normalized >= 55 ? 3 : normalized >= 40 ? 2 : 1;
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

function rateToScore(value, min, max, lowerIsBetter = false) {
  const parsed = finiteNumber(value);
  if (parsed === null || max <= min) return null;
  const ratio = Math.max(0, Math.min(1, (parsed - min) / (max - min)));
  return (lowerIsBetter ? 1 - ratio : ratio) * 100;
}

function gradeToScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = finiteNumber(value);
  if (parsed !== null) return parsed;

  const grade = String(value).trim().toUpperCase();
  return ({ S: 95, "A+": 90, A: 85, "B+": 75, B: 68, C: 55, D: 35, E: 20 })[grade] ?? null;
}

function classWallScore(value) {
  const grade = String(value ?? "").trim().toUpperCase();
  return ({ A1: 95, A2: 82, B1: 65, B2: 45 })[grade] ?? 55;
}

function getBoat(entries, boatNo) {
  return (Array.isArray(entries) ? entries : []).find(
    (entry) => Number(entry?.boat_no ?? entry?.teiban) === Number(boatNo)
  ) || null;
}

function weightedAverage(items) {
  const validItems = items.filter(
    (item) => finiteNumber(item?.value) !== null && finiteNumber(item?.weight) !== null
  );

  const totalWeight = validItems.reduce(
    (sum, item) => sum + Number(item.weight),
    0
  );

  if (!totalWeight) return null;

  return validItems.reduce(
    (sum, item) => sum + Number(item.value) * Number(item.weight),
    0
  ) / totalWeight;
}

function diagnosisRank(score) {
  const value = finiteNumber(score);
  if (value === null) return "-";
  if (value >= 85) return "S";
  if (value >= 75) return "A";
  if (value >= 65) return "B";
  if (value >= 50) return "C";
  return "D";
}

function diagnosisMessage(score) {
  const rank = diagnosisRank(score);
  return ({
    S: "イン逃げを強く狙える条件が揃っています。",
    A: "イン逃げを後押しする材料が多いレースです。",
    B: "イン中心で検討できますが、相手関係の確認が必要です。",
    C: "逃げ切りには不安材料があり、慎重な判断が必要です。",
    D: "イン逃げの信頼度は低めです。無理な本命視は禁物です。",
  })[rank] || "診断材料を集計中です。";
}

function buildIchikaPreDayMetrics(prediction, entries) {
  const boat1 = getBoat(entries, 1);
  const boat2 = getBoat(entries, 2);
  const boat3 = getBoat(entries, 3);

  const aiScore = finiteNumber(
    factorValue(prediction, "expected_value", "ai_expected_value", "score")
  );
  const escapeScore = finiteNumber(
    factorValue(prediction, "escape_probability", "in_escape_score", "score")
  );

  const storedMotor = gradeToScore(
    factorValue(prediction, "boat1_motor_evaluation", "motor_evaluation", "motor_grade", "motor_score")
  );
  const motorRate = finiteNumber(boat1?.motor_2_rate ?? boat1?.motor_top2_rate);
  const motorScore = storedMotor ?? rateToScore(motorRate, 20, 55);

  const storedSt = gradeToScore(
    factorValue(prediction, "boat1_st_evaluation", "st_evaluation", "st_grade", "st_score")
  );
  const averageSt = finiteNumber(boat1?.average_st);
  const stScore = storedSt ?? rateToScore(averageSt, 0.11, 0.24, true);

  const storedWin = gradeToScore(
    factorValue(prediction, "boat1_win_rate_evaluation", "boat1_win_score", "win_rate_score")
  );
  const nationalWinRate = finiteNumber(boat1?.national_win_rate);
  const localWinRate = finiteNumber(boat1?.local_win_rate);
  const baseWinRate = localWinRate ?? nationalWinRate;
  const winScore = storedWin ?? rateToScore(baseWinRate, 3.5, 8.0);

  const storedWall = gradeToScore(
    factorValue(prediction, "wall_expectation", "wall_score", "wall_evaluation")
  );

  const wallBoats = [boat2, boat3].filter(Boolean);
  const wallScores = wallBoats.map((boat) => {
    const classScore = classWallScore(boat?.racer_class ?? boat?.class);
    const st = finiteNumber(boat?.average_st);
    const stPart = st === null ? 55 : rateToScore(st, 0.11, 0.24, true);
    return classScore * 0.45 + stPart * 0.55;
  });
  const wallScore = storedWall ?? (
    wallScores.length ? wallScores.reduce((sum, value) => sum + value, 0) / wallScores.length : null
  );

  const storedDanger = gradeToScore(
    factorValue(
      prediction,
      "difference_danger_score",
      "sashi_danger_score",
      "danger_score",
      "danger_level"
    )
  );

  const dangerScore = storedDanger ?? (
    wallScore === null ? null : Math.max(0, Math.min(100, 100 - wallScore))
  );

  // 総合診断は、AIの逃げ確率だけではなく、
  // 1号艇モーター・ST・勝率・壁期待度を合わせて算出します。
  // これにより「イン逃げ診断」と「逃げ成功率」が同じ数値になりません。
  const diagnosisScore = weightedAverage([
    { value: escapeScore, weight: 35 },
    { value: motorScore, weight: 20 },
    { value: stScore, weight: 20 },
    { value: winScore, weight: 15 },
    { value: wallScore, weight: 10 },
  ]);

  return {
    aiScore,
    diagnosisScore,
    escapeScore,
    motorScore,
    motorRate,
    stScore,
    averageSt,
    winScore,
    nationalWinRate,
    localWinRate,
    wallScore,
    dangerScore,
  };
}

function IchikaStarMetric({ label, score, detail, accent = "#e16318" }) {
  const stars = scoreToStars(score);

  return (
    <div
      style={{
        padding: "15px 14px",
        border: "1px solid #e1e8f1",
        borderRadius: "15px",
        background: "linear-gradient(180deg, #fff 0%, #fbfcfe 100%)",
        minHeight: "92px",
      }}
    >
      <span style={{ display: "block", color: "#68778a", fontSize: "12px", fontWeight: 900 }}>
        {label}
      </span>
      <strong
        aria-label={stars === "-" ? `${label} 未評価` : `${label} ${stars}`}
        style={{
          display: "block",
          marginTop: "8px",
          color: stars === "-" ? "#8a98a9" : accent,
          fontSize: "22px",
          lineHeight: 1,
          letterSpacing: ".06em",
          whiteSpace: "nowrap",
        }}
      >
        {stars}
      </strong>
      {detail && (
        <small style={{ display: "block", marginTop: "8px", color: "#738296", fontWeight: 800 }}>
          {detail}
        </small>
      )}
    </div>
  );
}

function IchikaPreviousPanel({ prediction, entries, noteFeature }) {
  if (!prediction) return <EmptyAi type="previous" />;

  const metrics = buildIchikaPreDayMetrics(prediction, entries);
  const diagnosisScore = metrics.diagnosisScore;
  const diagnosisGrade = diagnosisRank(diagnosisScore);
  const dangerPoint = factorValue(prediction, "danger_point", "danger_reason", "danger_level");
  const hasNote = hasPublishedNote(noteFeature, "previous");

  const motorDetail = metrics.motorRate === null
    ? null
    : `1号艇モーター2連率 ${number(metrics.motorRate)}%`;
  const stDetail = metrics.averageSt === null
    ? null
    : `1号艇平均ST ${number(metrics.averageSt, 2)}`;
  const winDetail = metrics.localWinRate !== null
    ? `1号艇当地勝率 ${number(metrics.localWinRate, 2)}`
    : metrics.nationalWinRate !== null
      ? `1号艇全国勝率 ${number(metrics.nationalWinRate, 2)}`
      : null;

  return (
    <div className={styles.predictionPanel}>
      <div
  style={{
    position: "relative",
    width: "100%",
    borderRadius: "18px",
    overflow: "hidden",
    background: "#fff7e8",
    boxShadow: "0 8px 24px rgba(110, 63, 10, .12)",
  }}
>
  <img
    src="/banners/S__21585946.jpg"
    alt="一果AI予想 前日版"
    style={{
      display: "block",
      width: "100%",
      height: "auto",
      objectFit: "cover",
    }}
  />
</div>

      <div
        style={{
          marginTop: "14px",
          padding: "18px",
          borderRadius: "18px",
          border: "1px solid #ffd59d",
          background: "linear-gradient(135deg, #fffaf2 0%, #fff1d9 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: "16px",
          alignItems: "center",
        }}
      >
        <div>
          <span style={{ color: "#9a5a20", fontSize: "12px", fontWeight: 900, letterSpacing: ".08em" }}>
            一果のイン逃げ診断
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
            <strong style={{ color: "#d65f0d", fontSize: "34px", lineHeight: 1 }}>
              {diagnosisScore === null ? "-" : Math.round(diagnosisScore)}
              {diagnosisScore !== null && <small style={{ fontSize: "15px" }}>点</small>}
            </strong>
            <strong style={{ color: "#7f3d0c", fontSize: "21px" }}>
              {diagnosisGrade}判定
            </strong>
          </div>
          <p style={{ margin: "9px 0 0", color: "#77451f", fontSize: "13px", fontWeight: 800, lineHeight: 1.7 }}>
            {diagnosisMessage(diagnosisScore)}
          </p>
        </div>
        <div style={{ color: "#e06c18", fontSize: "25px", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
          {scoreToStars(diagnosisScore)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "14px" }}>
        <IchikaStarMetric
          label="逃げ成功率"
          score={metrics.escapeScore}
          detail={metrics.escapeScore === null ? null : `AI推定 ${Math.round(metrics.escapeScore)}%`}
        />
        <IchikaStarMetric
          label="1号艇モーター評価"
          score={metrics.motorScore}
          detail={motorDetail}
          accent="#d86b10"
        />
        <IchikaStarMetric
          label="1号艇ST評価"
          score={metrics.stScore}
          detail={stDetail}
          accent="#1769e0"
        />
        <IchikaStarMetric
          label="1号艇勝率評価"
          score={metrics.winScore}
          detail={winDetail}
          accent="#167c54"
        />
        <IchikaStarMetric
          label="壁期待度"
          score={metrics.wallScore}
          detail="2・3号艇の級別と平均STから算出"
          accent="#7c55b5"
        />
        <IchikaStarMetric
          label="差され危険度"
          score={metrics.dangerScore}
          detail="星が多いほど差し・まくり差しへの警戒が必要"
          accent="#c43b3b"
        />
      </div>

      {dangerPoint && (
        <div style={{ marginTop: "14px", padding: "14px 16px", borderRadius: "14px", background: "#fff1f1", border: "1px solid #ffd6d6", color: "#a82e2e", fontWeight: 800 }}>
          ⚠ イン逃げ危険ポイント：{String(dangerPoint)}
        </div>
      )}

      <MarksPanel prediction={prediction} title="前日印" />

      {prediction.comment_text && (
        <div className={styles.aiComment} style={{ marginTop: "14px" }}>
          <span>一果の前日コメント</span><p>{prediction.comment_text}</p>
        </div>
      )}

      {hasNote ? <NoteGuideCard noteFeature={noteFeature} timing="previous" /> : <AiBetList prediction={prediction} />}
    </div>
  );
}

function MetricCard({ label, value, accent = "#2468a2", detail = "" }) {
  return (
    <div
      style={{
        minHeight: "82px",
        padding: "14px 15px",
        border: "1px solid #dce5ef",
        borderRadius: "14px",
        background: "#ffffff",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "6px",
      }}
    >
      <span style={{ color: "#6b7889", fontSize: "12px", fontWeight: 800 }}>
        {label}
      </span>
      <strong style={{ color: accent, fontSize: "20px", fontWeight: 900, lineHeight: 1.2 }}>
        {value ?? "-"}
      </strong>
      {detail && (
        <small style={{ color: "#8190a2", fontSize: "11px", fontWeight: 700, lineHeight: 1.5 }}>
          {detail}
        </small>
      )}
    </div>
  );
}

function IchikaLivePanel({ prediction, previousPrediction, entries, event, noteFeature }) {
  if (!prediction) return <EmptyAi type="live" />;

  const venueBaselines = {
    exhibition: event?.venue_average_exhibition_time ?? event?.baseline_exhibition_time ?? null,
    lap: event?.venue_average_lap ?? event?.baseline_lap ?? null,
    turn: event?.venue_average_turn ?? event?.baseline_turn ?? null,
    straight: event?.venue_average_straight ?? event?.baseline_straight ?? null,
  };
  const analysis = buildExhibitionAnalysis(entries, venueBaselines);
  const ratings = buildExhibitionRatings(analysis.rows, analysis.correctedRanks);
  const best = ratings[0] || null;
  const previousMain = Number(previousPrediction?.main_boat) || null;
  const liveMain = Number(prediction?.main_boat) || null;
  const scoreDiff = finiteNumber(prediction?.score) !== null && finiteNumber(previousPrediction?.score) !== null
    ? finiteNumber(prediction.score) - finiteNumber(previousPrediction.score)
    : null;
  const upgradedBoat = factorValue(prediction, "upgraded_boat", "evaluation_up_boat") ?? best?.boatNo ?? null;
  const downgradedBoat = factorValue(prediction, "downgraded_boat", "evaluation_down_boat") ?? null;
  const exhibitionGrade = factorValue(prediction, "exhibition_grade", "exhibition_rank") ?? best?.grade ?? prediction.rank ?? "-";
  const hasNote = hasPublishedNote(noteFeature, "live");

  return (
    <div className={styles.predictionPanel}>
      <div className={styles.predictionHero} style={{ background: "linear-gradient(135deg, #eaf4ff 0%, #b8dcff 100%)" }}>
        <div
  style={{
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 10px 28px rgba(0,60,150,.18)",
    background: "#fff",
    marginBottom: "18px",
  }}
>
  <img
    src="/banners/S__21585947.jpg"
    alt="一果AI予想 直前版"
    style={{
      width: "100%",
      display: "block",
      height: "auto",
    }}
  />
</div>
        <div className={styles.scoreCircle}>
          <strong>{number(prediction.score, 0)}</strong><span>%</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "14px" }}>
        <MetricCard label="展示評価" value={exhibitionGrade} />
        <MetricCard label="補正展示トップ" value={best ? `${best.boatNo}号艇` : "-"} />
        <MetricCard label="展示で評価アップ" value={upgradedBoat ? `↑ ${upgradedBoat}号艇` : "-"} accent="#16834d" />
        <MetricCard label="展示で評価ダウン" value={downgradedBoat ? `↓ ${downgradedBoat}号艇` : "-"} accent="#c43b3b" />
      </div>

      {(previousMain || scoreDiff !== null) && (
        <div style={{ marginTop: "14px", padding: "15px", borderRadius: "14px", background: "#f4f8fd", border: "1px solid #dce7f3", fontWeight: 800, lineHeight: 1.8 }}>
          <div>前日本命：{previousMain ? `${previousMain}号艇` : "-"} → 直前本命：{liveMain ? `${liveMain}号艇` : "-"}</div>
          {scoreDiff !== null && <div>期待度変化：{scoreDiff > 0 ? "+" : ""}{scoreDiff.toFixed(0)}ポイント</div>}
        </div>
      )}

      <div style={{ marginTop: "16px" }}>
        <AiPredictedStartSlit rows={analysis.rows} />
      </div>

      <MarksPanel prediction={prediction} title="最終印" />

      {prediction.comment_text && (
        <div className={styles.aiComment} style={{ marginTop: "14px" }}>
          <span>一果の展示後コメント</span><p>{prediction.comment_text}</p>
        </div>
      )}

      {hasNote ? <NoteGuideCard noteFeature={noteFeature} timing="live" /> : <AiBetList prediction={prediction} title="AI最終買い目" />}
    </div>
  );
}

function BetPanel({ prediction, noteFeature }) {
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

  if (hasPublishedNote(noteFeature, "live") || hasPublishedNote(noteFeature, "previous")) {
    return (
      <>
        <MarksPanel prediction={prediction} title="最終印" />
        <NoteGuideCard
          noteFeature={noteFeature}
          timing={hasPublishedNote(noteFeature, "live") ? "live" : "previous"}
        />
      </>
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
  const v = finiteNumber(value);

  if (v === null) return {};

  // 場平均よりかなり速い
  if (v <= -0.08) {
    return {
      background: "#009688",
      color: "#fff",
      fontWeight: 900,
    };
  }

  // 場平均より速い
  if (v <= -0.04) {
    return {
      background: "#4CAF50",
      color: "#fff",
      fontWeight: 900,
    };
  }

  // 少し速い
  if (v < 0) {
    return {
      background: "#DFF5E4",
      color: "#16783B",
      fontWeight: 900,
    };
  }

  // 平均
  if (Math.abs(v) < 0.01) {
    return {
      background: "#ffffff",
      color: "#44556A",
      fontWeight: 900,
    };
  }

  // 少し遅い
  if (v < 0.04) {
    return {
      background: "#FFF3D6",
      color: "#A06A00",
      fontWeight: 900,
    };
  }

  // 遅い
  if (v < 0.08) {
    return {
      background: "#FFB74D",
      color: "#fff",
      fontWeight: 900,
    };
  }

  // かなり遅い
  return {
    background: "#E53935",
    color: "#fff",
    fontWeight: 900,
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
    padding: "16px",
    borderRadius: "14px",
    background: "#f7f9fc",
    border: "1px solid #dfe8f2",
    color: "#566579",
    fontSize: "13px",
    lineHeight: 1.8,
  }}
>
  <div
    style={{
      fontWeight: 900,
      marginBottom: "10px",
      color: "#23384f",
      fontSize: "15px",
    }}
  >
    場平均タイム差の見方
  </div>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginBottom: "14px",
    }}
  >
    <span
      style={{
        background: "#009688",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      濃い緑 = かなり速い
    </span>

    <span
      style={{
        background: "#4CAF50",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      緑 = 速い
    </span>

    <span
      style={{
        background: "#DFF5E4",
        color: "#16783B",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      薄緑 = やや速い
    </span>

    <span
      style={{
        background: "#fff",
        border: "1px solid #ddd",
        color: "#444",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      白 = 平均
    </span>

    <span
      style={{
        background: "#FFF3D6",
        color: "#A06A00",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      薄黄 = やや遅い
    </span>

    <span
      style={{
        background: "#FFB74D",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      オレンジ = 遅い
    </span>

    <span
      style={{
        background: "#E53935",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: "6px",
        fontWeight: 800,
      }}
    >
      赤 = かなり遅い
    </span>
  </div>

  <div style={{ fontWeight: 700 }}>
    ● <span style={{ color: "#0b8f55" }}>マイナス（－）</span>
    は場平均より速い展示です。
  </div>

  <div style={{ fontWeight: 700 }}>
    ● <span style={{ color: "#d53b3b" }}>プラス（＋）</span>
    は場平均より遅い展示です。
  </div>

  <div
    style={{
      marginTop: "10px",
      color: "#6b7787",
      fontSize: "12px",
    }}
  >
    ※BoatStrikers独自の場別基準タイムとの差を表示しています。
  </div>
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
  noteFeature = null,
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
          <IchikaPreviousPanel
            prediction={previousPrediction}
            entries={entries}
            noteFeature={noteFeature}
          />
        )}

        {activeTab === "live" && (
          <IchikaLivePanel
            prediction={livePrediction}
            previousPrediction={previousPrediction}
            entries={entries}
            event={event}
            noteFeature={noteFeature}
          />
        )}

        {activeTab === "bets" && (
          <BetPanel
            prediction={currentPrediction}
            noteFeature={noteFeature}
          />
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

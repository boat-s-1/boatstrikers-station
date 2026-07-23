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

function buildExhibitionAnalysis(entries) {
  const lapMedian = median(entries.map((entry) => entry.lap_time));
  const turnMedian = median(entries.map((entry) => entry.turn_time));
  const straightMedian = median(entries.map((entry) => entry.straight_time));
  const averageStMedian = median(entries.map((entry) => entry.average_st));

  const rows = entries.map((entry) => {
    const exhibitionTime = finiteNumber(entry.exhibition_time);
    const exhibitionSt = finiteNumber(entry.exhibition_st);
    const lapTime = finiteNumber(entry.lap_time);
    const turnTime = finiteNumber(entry.turn_time);
    const straightTime = finiteNumber(entry.straight_time);
    const averageSt = finiteNumber(entry.average_st);

    let exhibitionCorrection = 0;
    let exhibitionCorrectionParts = 0;

    if (lapTime !== null && lapMedian !== null) {
      exhibitionCorrection +=
        (lapTime - lapMedian) * CORRECTION_WEIGHTS.lap;
      exhibitionCorrectionParts += 1;
    }

    if (turnTime !== null && turnMedian !== null) {
      exhibitionCorrection +=
        (turnTime - turnMedian) * CORRECTION_WEIGHTS.turn;
      exhibitionCorrectionParts += 1;
    }

    if (straightTime !== null && straightMedian !== null) {
      exhibitionCorrection +=
        (straightTime - straightMedian) * CORRECTION_WEIGHTS.straight;
      exhibitionCorrectionParts += 1;
    }

    const correctedExhibition =
      exhibitionTime === null
        ? null
        : exhibitionTime +
          (exhibitionCorrectionParts ? exhibitionCorrection : 0);

    let correctedStart = exhibitionSt;

    if (
      correctedStart !== null &&
      averageSt !== null &&
      averageStMedian !== null
    ) {
      const startCorrection = Math.max(
        -0.03,
        Math.min(
          0.03,
          (averageSt - averageStMedian) *
            CORRECTION_WEIGHTS.averageSt
        )
      );

      correctedStart += startCorrection;
    }

    return {
      ...entry,
      corrected_exhibition_time: correctedExhibition,
      corrected_exhibition_st: correctedStart,
    };
  });

  return {
    rows,
    officialRanks: {
      exhibition: createRanks(rows, (row) => row.exhibition_time),
      lap: createRanks(rows, (row) => row.lap_time),
      turn: createRanks(rows, (row) => row.turn_time),
      straight: createRanks(rows, (row) => row.straight_time),
      start: createRanks(rows, (row) => row.exhibition_st),
    },
    correctedRanks: {
      exhibition: createRanks(
        rows,
        (row) => row.corrected_exhibition_time
      ),
      start: createRanks(rows, (row) => row.corrected_exhibition_st),
    },
  };
}

function ExhibitionTable({
  title,
  eyebrow,
  rows,
  columns,
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
                          ...rankCellStyle(rank),
                        }}
                      >
                        {column.format(value)}
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

function OfficialExhibitionSuite({ entries }) {
  const analysis = useMemo(
    () => buildExhibitionAnalysis(entries),
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
            getValue: (row) => row.lap_time,
            getRank: (row) =>
              officialRanks.lap.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
          {
            key: "turn",
            label: "まわり足",
            getValue: (row) => row.turn_time,
            getRank: (row) =>
              officialRanks.turn.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
          {
            key: "straight",
            label: "直線",
            getValue: (row) => row.straight_time,
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
            getValue: (row) => row.exhibition_st,
            getRank: (row) =>
              officialRanks.start.get(Number(row.boat_no)),
            format: displayStart,
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

function CorrectedExhibitionSuite({ entries }) {
  const analysis = useMemo(
    () => buildExhibitionAnalysis(entries),
    [entries]
  );

  const { rows, correctedRanks } = analysis;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <ExhibitionTable
        title="BoatStrikers補正展示タイム"
        eyebrow="BOATSTRIKERS CORRECTED EXHIBITION"
        rows={rows}
        emptyMessage="公式展示タイムが公開されると補正値を表示します。"
        columns={[
          {
            key: "official",
            label: "公式展示",
            getValue: (row) => row.exhibition_time,
            format: (value) => displayTime(value),
          },
          {
            key: "corrected",
            label: "補正展示",
            getValue: (row) => row.corrected_exhibition_time,
            getRank: (row) =>
              correctedRanks.exhibition.get(Number(row.boat_no)),
            format: (value) => displayTime(value),
          },
          {
            key: "difference",
            label: "補正差",
            getValue: (row) => {
              const official = finiteNumber(row.exhibition_time);
              const corrected = finiteNumber(
                row.corrected_exhibition_time
              );

              return official === null || corrected === null
                ? null
                : corrected - official;
            },
            format: (value) => {
              const parsed = finiteNumber(value);
              if (parsed === null) return "-";
              return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(3)}`;
            },
          },
        ]}
      />

      <ExhibitionTable
        title="BoatStrikers補正スタート展示"
        eyebrow="BOATSTRIKERS CORRECTED START"
        rows={rows}
        emptyMessage="公式スタート展示が公開されると補正STを表示します。"
        columns={[
          {
            key: "official",
            label: "公式展示ST",
            getValue: (row) => row.exhibition_st,
            format: displayStart,
          },
          {
            key: "corrected",
            label: "補正展示ST",
            getValue: (row) => row.corrected_exhibition_st,
            getRank: (row) =>
              correctedRanks.start.get(Number(row.boat_no)),
            format: displayStart,
          },
          {
            key: "average",
            label: "平均ST",
            getValue: (row) => row.average_st,
            format: displayStart,
          },
        ]}
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
        補正展示は、公式展示タイムに一周・まわり足・直線の
        レース内中央値との差を加味した暫定ロジックです。
        補正スタートは展示STと選手平均STのレース内差を使用し、
        補正幅を±0.03以内に制限しています。
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
          <CorrectedExhibitionSuite entries={entries} />
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

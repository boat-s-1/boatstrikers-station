import { createClient } from "@supabase/supabase-js";
import styles from "./stats.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;
const MODE_ORDER = ["oni", "hit", "recovery", "hole"];
const MODE_NAMES = {
  oni: "鬼絞り",
  hit: "的中率",
  recovery: "回収率",
  hole: "穴狙い",
};
const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定されていません。"
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function firstValue(...values) {
  return values.find(hasValue) ?? null;
}

function numberValue(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function booleanValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "hit", "的中"].includes(text);
}

function normalizeModeKey(value) {
  const key = String(value ?? "unknown").trim().toLowerCase();
  const aliases = {
    oni_shibori: "oni",
    onishibori: "oni",
    accuracy: "hit",
    hit_rate: "hit",
    return: "recovery",
    recovery_rate: "recovery",
    ana: "hole",
    longshot: "hole",
  };
  return aliases[key] || key || "unknown";
}

function normalizeRow(row) {
  const investment = numberValue(
    firstValue(row.investment, row.invest_amount, row.bet_amount, row.stake)
  );
  const payout = numberValue(
    firstValue(row.payout, row.payout_amount, row.return_amount, row.refund)
  );
  const modeKey = normalizeModeKey(
    firstValue(row.mode_key, row.bet_mode, row.mode, row.strategy_key)
  );
  const settledAt = firstValue(
    row.settled_at,
    row.updated_at,
    row.created_at,
    row.synced_at
  );

  return {
    ...row,
    race_date: String(firstValue(row.race_date, row.target_date, "") || "").slice(0, 10),
    course_code: numberValue(firstValue(row.course_code, row.jo_code, row.venue_code)),
    race_no: numberValue(firstValue(row.race_no, row.race_number)),
    prediction_timing: firstValue(row.prediction_timing, row.timing, row.prediction_type),
    mode_key: modeKey,
    mode_name: firstValue(row.mode_name, MODE_NAMES[modeKey], modeKey),
    ticket_count: numberValue(firstValue(row.ticket_count, row.bet_count, row.tickets)),
    investment,
    result_combination: firstValue(
      row.result_combination,
      row.trifecta_result,
      row.result,
      row.winning_combination
    ),
    trifecta_payout: numberValue(firstValue(row.trifecta_payout, row.official_payout)),
    is_hit: booleanValue(firstValue(row.is_hit, row.hit, row.hit_flag)),
    hit_ticket: firstValue(row.hit_ticket, row.winning_ticket),
    payout,
    profit: numberValue(firstValue(row.profit, payout - investment)),
    recovery_rate: investment ? (payout / investment) * 100 : 0,
    settled_at: settledAt,
  };
}

function yen(value) {
  return `${Math.round(numberValue(value)).toLocaleString("ja-JP")}円`;
}

function percent(value) {
  return `${numberValue(value).toLocaleString("ja-JP", {
    maximumFractionDigits: 1,
  })}%`;
}

function signedYen(value) {
  const number = numberValue(value);
  return `${number > 0 ? "+" : ""}${yen(number)}`;
}

function aggregate(rows) {
  const raceCount = rows.length;
  const hitCount = rows.filter((row) => row.is_hit).length;
  const investment = rows.reduce((sum, row) => sum + row.investment, 0);
  const payout = rows.reduce((sum, row) => sum + row.payout, 0);
  const profit = payout - investment;

  return {
    race_count: raceCount,
    hit_count: hitCount,
    hit_rate: raceCount ? (hitCount / raceCount) * 100 : 0,
    investment,
    payout,
    profit,
    recovery_rate: investment ? (payout / investment) * 100 : 0,
  };
}

function groupRows(rows, keyBuilder, extraBuilder = () => ({})) {
  const groups = new Map();

  for (const row of rows) {
    const key = keyBuilder(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([key, groupedRows]) => ({
    key,
    ...extraBuilder(groupedRows[0]),
    ...aggregate(groupedRows),
  }));
}

async function loadAllRows() {
  const supabase = getClient();
  const rows = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("bs_ai_bet_results")
      .select("*")
      .order("race_date", { ascending: false })
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page.map(normalizeRow));

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export default async function AiBetStatsPage() {
  let rows = [];
  let loadError = null;

  try {
    rows = await loadAllRows();
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
  }

  if (loadError) {
    return (
      <main className={styles.page}>
        <section className={styles.errorPanel}>
          <strong>Supabaseへ接続できませんでした</strong>
          <p>{loadError.message}</p>
          <p>
            `bs_ai_bet_results` テーブルと、Vercelの環境変数を確認してください。
            Ultimate v21では集計VIEWや追加SQLは使用しません。
          </p>
        </section>
      </main>
    );
  }

  const overall = aggregate(rows);
  const modeStats = groupRows(
    rows,
    (row) => row.mode_key,
    (row) => ({ mode_key: row.mode_key, mode_name: row.mode_name })
  ).sort((a, b) => {
    const aIndex = MODE_ORDER.indexOf(a.mode_key);
    const bIndex = MODE_ORDER.indexOf(b.mode_key);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  const monthly = groupRows(
    rows.filter((row) => row.race_date),
    (row) => `${row.race_date.slice(0, 7)}:${row.mode_key}`,
    (row) => ({
      month: row.race_date.slice(0, 7),
      mode_key: row.mode_key,
      mode_name: row.mode_name,
    })
  )
    .sort(
      (a, b) =>
        b.month.localeCompare(a.month) ||
        MODE_ORDER.indexOf(a.mode_key) - MODE_ORDER.indexOf(b.mode_key)
    )
    .slice(0, 72);

  const courseStats = groupRows(
    rows.filter((row) => row.course_code),
    (row) => `${row.course_code}:${row.mode_key}`,
    (row) => ({
      course_code: row.course_code,
      course_name: COURSE_NAMES[row.course_code] || `場${row.course_code}`,
      mode_key: row.mode_key,
      mode_name: row.mode_name,
    })
  )
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 24);

  const recent = rows.slice(0, 100);
  const latestSettledAt = rows
    .map((row) => row.settled_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const uniqueRaces = new Set(
    rows.map((row) => `${row.race_date}:${row.course_code}:${row.race_no}`)
  ).size;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>BOATSTRIKERS ULTIMATE v21</p>
          <h1>AI BET 成績管理</h1>
          <span>
            bs_ai_bet_resultsを直接取得。VIEW・集計SQLなしで自動集計します。
          </span>
        </div>
        <nav className={styles.headerActions}>
          <a href="/admin/sync">同期管理</a>
          <a href="/admin/ai-bet-stats">再読み込み</a>
        </nav>
      </header>

      {rows.length === 0 && (
        <section className={styles.notice}>
          <strong>Supabaseへの接続は成功しましたが、AI成績は0件です。</strong>
          <p>
            レース結果同期後に settle_ai_bet_results.py を実行し、
            bs_ai_bet_resultsへ精算結果を登録してください。
          </p>
          <code>python settle_ai_bet_results.py --date YYYY-MM-DD</code>
        </section>
      )}

      <section className={styles.statusBar}>
        <div><span>接続状態</span><strong className={styles.online}>● 接続済み</strong></div>
        <div><span>成績レコード</span><strong>{rows.length.toLocaleString("ja-JP")}件</strong></div>
        <div><span>集計レース</span><strong>{uniqueRaces.toLocaleString("ja-JP")}R</strong></div>
        <div>
          <span>最終精算</span>
          <strong>
            {latestSettledAt
              ? new Date(latestSettledAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
              : "未精算"}
          </strong>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>全体的中率</span><strong>{percent(overall.hit_rate)}</strong>
          <small>{overall.hit_count}/{overall.race_count} 的中</small>
        </article>
        <article className={styles.summaryCard}>
          <span>全体回収率</span><strong>{percent(overall.recovery_rate)}</strong>
          <small>払戻 ÷ 投資</small>
        </article>
        <article className={styles.summaryCard}>
          <span>累計投資</span><strong>{yen(overall.investment)}</strong>
          <small>全モード合計</small>
        </article>
        <article className={styles.summaryCard}>
          <span>累計利益</span>
          <strong className={overall.profit >= 0 ? styles.textPlus : styles.textMinus}>
            {signedYen(overall.profit)}
          </strong>
          <small>払戻 {yen(overall.payout)}</small>
        </article>
      </section>

      <section className={styles.cards}>
        {modeStats.map((row) => (
          <article className={styles.card} key={row.mode_key}>
            <div className={styles.cardTop}><h2>{row.mode_name}</h2><span>{row.race_count}件</span></div>
            <div className={styles.metrics}>
              <div><span>的中率</span><strong>{percent(row.hit_rate)}</strong><small>{row.hit_count}/{row.race_count}</small></div>
              <div><span>回収率</span><strong>{percent(row.recovery_rate)}</strong></div>
              <div><span>投資</span><strong>{yen(row.investment)}</strong></div>
              <div><span>払戻</span><strong>{yen(row.payout)}</strong></div>
            </div>
            <div className={row.profit >= 0 ? styles.profitPlus : styles.profitMinus}>
              累計利益 {signedYen(row.profit)}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><p>MONTHLY PERFORMANCE</p><h2>月別成績</h2></div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>月</th><th>モード</th><th>対象</th><th>的中率</th><th>投資</th><th>払戻</th><th>利益</th><th>回収率</th></tr></thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={row.key}>
                  <td>{row.month}</td><td>{row.mode_name}</td><td>{row.race_count}件</td>
                  <td>{percent(row.hit_rate)}</td><td>{yen(row.investment)}</td><td>{yen(row.payout)}</td>
                  <td className={row.profit >= 0 ? styles.textPlus : styles.textMinus}>{signedYen(row.profit)}</td>
                  <td>{percent(row.recovery_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><p>COURSE PERFORMANCE</p><h2>場別・モード別ランキング</h2></div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>順位</th><th>場</th><th>モード</th><th>対象</th><th>的中率</th><th>回収率</th><th>利益</th></tr></thead>
            <tbody>
              {courseStats.map((row, index) => (
                <tr key={row.key}>
                  <td>{index + 1}</td>
                  <td>#{String(row.course_code).padStart(2, "0")} {row.course_name}</td>
                  <td>{row.mode_name}</td><td>{row.race_count}件</td>
                  <td>{percent(row.hit_rate)}</td><td>{percent(row.recovery_rate)}</td>
                  <td className={row.profit >= 0 ? styles.textPlus : styles.textMinus}>{signedYen(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><p>RECENT SETTLEMENTS</p><h2>直近の精算結果</h2></div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>日付</th><th>場/R</th><th>モード</th><th>買い目数</th><th>結果</th><th>的中</th><th>投資</th><th>払戻</th><th>利益</th></tr></thead>
            <tbody>
              {recent.map((row, index) => (
                <tr key={`${row.race_date}-${row.course_code}-${row.race_no}-${row.mode_key}-${index}`}>
                  <td>{row.race_date || "-"}</td>
                  <td>{COURSE_NAMES[row.course_code] || row.course_code || "-"} {row.race_no || "-"}R</td>
                  <td>{row.mode_name}</td><td>{row.ticket_count}点</td><td>{row.result_combination || "-"}</td>
                  <td>{row.is_hit ? <strong className={styles.hit}>的中</strong> : <span className={styles.miss}>不的中</span>}</td>
                  <td>{yen(row.investment)}</td><td>{yen(row.payout)}</td>
                  <td className={row.profit >= 0 ? styles.textPlus : styles.textMinus}>{signedYen(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

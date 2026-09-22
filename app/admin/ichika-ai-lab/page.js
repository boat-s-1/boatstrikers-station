import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const METRIC_LABELS = {
  overall: "全体",
  national_win_rate: "全国勝率",
  local_win_rate: "当地勝率",
  motor_2_rate: "モーター2連率",
  average_st: "平均ST",
  course1_top2_rate: "1コース2連率",
  course: "場別",
  wind: "風速",
  exhibition_time_rank: "展示タイム順位",
  start_exhibition_rank: "スタート展示順位",
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function int(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("ja-JP") : "—";
}

function metricLabel(metric) {
  return METRIC_LABELS[metric] || metric;
}

function timingLabel(value) {
  return value === "after_exhibition" ? "直前版" : "前日版";
}

function classify(row) {
  if (!row.sample_sufficient) return "insufficient";
  const recovery = Number(row.recovery_rate);
  const hitRate = Number(row.hit_rate);

  if (recovery >= 100 && hitRate >= 30) return "buy";
  if (recovery < 75) return "skip";
  return "watch";
}

async function loadAnalysis() {
  const supabase = getClient();
  if (!supabase) return { rows: [], latestDate: null, error: "Supabase環境変数がありません。" };

  const { data: latest, error: latestError } = await supabase
    .from("bs_ichika_ai_analysis_metrics")
    .select("analysis_date")
    .order("analysis_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError || !latest?.analysis_date) {
    return {
      rows: [],
      latestDate: null,
      error: latestError?.message || "分析データがまだありません。",
    };
  }

  const { data, error } = await supabase
    .from("bs_ichika_ai_analysis_metrics")
    .select(
      "analysis_date,window_days,period_start,period_end,timing,metric,bucket,races,tickets,hits,hit_rate,recovery_rate,avg_tickets,sample_sufficient,generated_at",
    )
    .eq("analysis_date", latest.analysis_date)
    .eq("window_days", 30)
    .order("metric", { ascending: true })
    .order("timing", { ascending: true })
    .order("bucket", { ascending: true });

  return {
    rows: data || [],
    latestDate: latest.analysis_date,
    error: error?.message || null,
  };
}

function InsightCard({ row, tone }) {
  return (
    <article className={`${styles.insightCard} ${styles[tone]}`}>
      <div className={styles.insightHead}>
        <div>
          <span>{timingLabel(row.timing)}</span>
          <strong>{metricLabel(row.metric)}</strong>
        </div>
        <b>{row.bucket}</b>
      </div>
      <div className={styles.insightStats}>
        <div><span>回収率</span><strong>{pct(row.recovery_rate)}</strong></div>
        <div><span>的中率</span><strong>{pct(row.hit_rate)}</strong></div>
        <div><span>件数</span><strong>{int(row.races)}R</strong></div>
      </div>
      <small>{row.sample_sufficient ? "100R以上の検証済み条件" : "サンプル不足"}</small>
    </article>
  );
}

export default async function IchikaAiLabPage() {
  const { rows, latestDate, error } = await loadAnalysis();
  const overall = rows.filter((row) => row.metric === "overall");
  const candidates = rows.filter((row) => row.metric !== "overall" && row.sample_sufficient);

  const buy = candidates
    .filter((row) => classify(row) === "buy")
    .sort((a, b) => Number(b.recovery_rate) - Number(a.recovery_rate))
    .slice(0, 12);

  const watch = candidates
    .filter((row) => classify(row) === "watch")
    .sort((a, b) => Number(a.recovery_rate) - Number(b.recovery_rate))
    .slice(0, 12);

  const skip = candidates
    .filter((row) => classify(row) === "skip")
    .sort((a, b) => Number(a.recovery_rate) - Number(b.recovery_rate))
    .slice(0, 12);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href="/admin" className={styles.back}>← 管理TOPへ</Link>
          <Link href="/admin/ai-bet-stats" className={styles.back}>AI買い目成績 →</Link>
        </div>

        <section className={styles.hero}>
          <div>
            <span>ICHIKA AI IMPROVEMENT LAB</span>
            <h1>一果AI 改善パネル</h1>
            <p>1アタマ限定の実績を、30日ローリングで条件別に比較します。ここでの判定は研究用で、予想ロジックを自動変更しません。</p>
          </div>
          <div className={styles.heroMeta}>
            <span>最新分析日</span>
            <strong>{latestDate || "—"}</strong>
          </div>
        </section>

        {error ? (
          <section className={styles.empty}>
            <h2>分析データを読み込めませんでした</h2>
            <p>{error}</p>
          </section>
        ) : (
          <>
            <section className={styles.summary}>
              <div className={styles.sectionHeading}>
                <div><span>30-DAY OVERVIEW</span><h2>現在の基準成績</h2></div>
                <small>対象: 一果の1-◯-◯買い目のみ</small>
              </div>
              <div className={styles.summaryGrid}>
                {overall.map((row) => (
                  <article className={styles.summaryCard} key={row.timing}>
                    <div className={styles.summaryTitle}>
                      <span>{timingLabel(row.timing)}</span>
                      <strong>{row.races}R</strong>
                    </div>
                    <div className={styles.summaryStats}>
                      <div><span>的中率</span><strong>{pct(row.hit_rate)}</strong></div>
                      <div><span>回収率</span><strong>{pct(row.recovery_rate)}</strong></div>
                      <div><span>平均点数</span><strong>{Number(row.avg_tickets || 0).toFixed(2)}点</strong></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.ruleBox}>
              <div>
                <span>自動判定ルール</span>
                <strong>100R以上の条件だけを評価</strong>
              </div>
              <p>
                買い候補 = 回収率100%以上かつ的中率30%以上 / 注意 = 回収率75〜99.99% / 見送り候補 = 回収率75%未満。
                現在は候補表示のみで、本番AIには自動反映しません。
              </p>
            </section>

            <section className={styles.candidateSection}>
              <div className={styles.sectionHeading}>
                <div><span>BUY CANDIDATES</span><h2>買い候補</h2></div>
                <small>{buy.length}条件</small>
              </div>
              {buy.length ? (
                <div className={styles.cardGrid}>{buy.map((row) => <InsightCard key={`${row.timing}-${row.metric}-${row.bucket}`} row={row} tone="buy" />)}</div>
              ) : (
                <div className={styles.emptyMini}>現在、100R以上で回収率100%を超える強い条件はありません。</div>
              )}
            </section>

            <section className={styles.candidateSection}>
              <div className={styles.sectionHeading}>
                <div><span>WATCH LIST</span><h2>注意候補</h2></div>
                <small>{watch.length}条件</small>
              </div>
              {watch.length ? (
                <div className={styles.cardGrid}>{watch.map((row) => <InsightCard key={`${row.timing}-${row.metric}-${row.bucket}`} row={row} tone="watch" />)}</div>
              ) : (
                <div className={styles.emptyMini}>注意候補はありません。</div>
              )}
            </section>

            <section className={styles.candidateSection}>
              <div className={styles.sectionHeading}>
                <div><span>SKIP CANDIDATES</span><h2>見送り候補</h2></div>
                <small>{skip.length}条件</small>
              </div>
              {skip.length ? (
                <div className={styles.cardGrid}>{skip.map((row) => <InsightCard key={`${row.timing}-${row.metric}-${row.bucket}`} row={row} tone="skip" />)}</div>
              ) : (
                <div className={styles.emptyMini}>見送り候補はありません。</div>
              )}
            </section>

            <section className={styles.noteBox}>
              <strong>次の改善ステップ</strong>
              <p>この画面で100R以上の条件が増えたら、複数条件の組み合わせを検証してから一果の見送りルールへ採用します。単独条件だけで即時に本番ロジックへ反映しない設計です。</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

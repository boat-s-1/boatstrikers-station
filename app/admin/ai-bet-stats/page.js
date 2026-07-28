import { createClient } from "@supabase/supabase-js";
import styles from "./stats.module.css";

export const dynamic = "force-dynamic";

const MODE_ORDER = ["oni", "hit", "recovery", "hole"];

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase環境変数が設定されていません。");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function yen(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")}円`;
}

function percent(value) {
  return `${Number(value || 0).toLocaleString("ja-JP", {
    maximumFractionDigits: 1,
  })}%`;
}

export default async function AiBetStatsPage() {
  const supabase = getClient();

  const [{ data: totals, error: totalError }, { data: monthly }] =
    await Promise.all([
      supabase.from("v_bs_ai_bet_mode_stats").select("*"),
      supabase
        .from("v_bs_ai_bet_monthly_stats")
        .select("*")
        .order("month", { ascending: false })
        .limit(48),
    ]);

  if (totalError) {
    return (
      <main className={styles.page}>
        <div className={styles.error}>
          成績を読み込めませんでした：{totalError.message}
        </div>
      </main>
    );
  }

  const sorted = [...(totals || [])].sort(
    (a, b) =>
      MODE_ORDER.indexOf(a.mode_key) -
      MODE_ORDER.indexOf(b.mode_key)
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>BOATSTRIKERS ULTIMATE v19</p>
          <h1>AI BET 成績管理</h1>
          <span>
            鬼絞り・的中率・回収率・穴狙いを自動集計
          </span>
        </div>
        <a href="/admin/sync">同期管理へ</a>
      </header>

      <section className={styles.cards}>
        {sorted.map((row) => (
          <article className={styles.card} key={row.mode_key}>
            <div className={styles.cardTop}>
              <h2>{row.mode_name}</h2>
              <span>{row.race_count}R</span>
            </div>

            <div className={styles.metrics}>
              <div>
                <span>的中率</span>
                <strong>{percent(row.hit_rate)}</strong>
                <small>
                  {row.hit_count}/{row.race_count} 的中
                </small>
              </div>
              <div>
                <span>回収率</span>
                <strong>{percent(row.recovery_rate)}</strong>
                <small>払戻 ÷ 投資</small>
              </div>
              <div>
                <span>累計投資</span>
                <strong>{yen(row.investment)}</strong>
              </div>
              <div>
                <span>累計払戻</span>
                <strong>{yen(row.payout)}</strong>
              </div>
            </div>

            <div
              className={
                Number(row.profit) >= 0
                  ? styles.profitPlus
                  : styles.profitMinus
              }
            >
              累計利益 {Number(row.profit) > 0 ? "+" : ""}
              {yen(row.profit)}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div>
            <p>MONTHLY PERFORMANCE</p>
            <h2>月別成績</h2>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>月</th>
                <th>モード</th>
                <th>対象</th>
                <th>的中率</th>
                <th>投資</th>
                <th>払戻</th>
                <th>利益</th>
                <th>回収率</th>
              </tr>
            </thead>
            <tbody>
              {(monthly || []).map((row) => (
                <tr key={`${row.month}-${row.mode_key}`}>
                  <td>{String(row.month).slice(0, 7)}</td>
                  <td>{row.mode_name}</td>
                  <td>{row.race_count}R</td>
                  <td>{percent(row.hit_rate)}</td>
                  <td>{yen(row.investment)}</td>
                  <td>{yen(row.payout)}</td>
                  <td
                    className={
                      Number(row.profit) >= 0
                        ? styles.textPlus
                        : styles.textMinus
                    }
                  >
                    {Number(row.profit) > 0 ? "+" : ""}
                    {yen(row.profit)}
                  </td>
                  <td>{percent(row.recovery_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

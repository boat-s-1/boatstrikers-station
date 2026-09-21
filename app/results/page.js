import Link from "next/link";
import { getMonthlyPublicPredictionResults } from "../../lib/publicPredictionResults";
import styles from "./results.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers予想実績｜的中率・回収率",
  description:
    "一果、初音、キイナのボートレース予想実績を掲載。予想数、的中率、回収率、最高払戻などを確認できます。",
};

export default async function ResultsPage() {
  const results = await getMonthlyPublicPredictionResults();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>BOATSTRIKERS RESULTS</span>
          <h1>予想実績</h1>
          <p>{results.monthLabel}の公開実績です。</p>
        </div>
        <Link href="/">トップへ戻る</Link>
      </header>

      <section className={styles.scope} aria-label="予想実績の集計条件">
        <div>
          <span>集計期間</span>
          <strong>{results.periodLabel}</strong>
        </div>
        <div>
          <span>対象予想</span>
          <strong>{results.targetLabel}</strong>
        </div>
        <div>
          <span>最終更新</span>
          <strong>{results.lastUpdatedLabel} JST</strong>
        </div>
      </section>

      {results.totalRace === 0 ? (
        <section className={styles.empty}>
          <h2>今月の予想実績は集計中です</h2>
          <p>実績が登録されると、こちらに詳しい成績を表示します。</p>
        </section>
      ) : (
        <>
          <section className={styles.summary}>
            {[
              ["予想レース数", `${results.totalRace}R`],
              ["的中率", `${results.hitRate.toFixed(1)}%`],
              ["回収率", `${results.recoveryRate.toFixed(1)}%`],
              ["最高払戻", `${results.maxPayout.toLocaleString()}円`],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>

          <section className={styles.members}>
            {results.members.map((member) => (
              <article key={member.label}>
                <h2>{member.label}</h2>
                <p>
                  {member.raceCount}R中 {member.hitCount}R的中
                </p>
                <b>的中率 {member.hitRate.toFixed(1)}%</b>
                <b>回収率 {member.recoveryRate.toFixed(1)}%</b>
              </article>
            ))}
          </section>

          <section className={styles.history}>
            <h2>今月の実績一覧</h2>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>担当</th>
                    <th>レース</th>
                    <th>買い目</th>
                    <th>投資</th>
                    <th>払戻</th>
                    <th>結果</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row) => {
                    const isHit =
                      Boolean(row.hit) || Number(row.payout || 0) > 0;
                    return (
                      <tr key={row.id}>
                        <td>{row.race_date}</td>
                        <td>{row.category}</td>
                        <td>
                          {row.place} {row.race_no}R
                        </td>
                        <td>{row.bet_text || "—"}</td>
                        <td>{Number(row.invest || 0).toLocaleString()}円</td>
                        <td>{Number(row.payout || 0).toLocaleString()}円</td>
                        <td>
                          <span className={isHit ? styles.hit : styles.miss}>
                            {isHit ? "的中" : "不的中"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

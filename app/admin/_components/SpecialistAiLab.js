import Link from "next/link";
import styles from "./SpecialistAiLab.module.css";

const LABELS = {
  overall: "全体",
  ranking_probability: "AI確率",
  rank_no: "候補順位",
  course: "場別",
  lane1_national_win_rate: "1号艇 全国勝率",
  lane1_motor_2_rate: "1号艇 モーター2連率",
  boat5_national_win_rate: "5号艇 全国勝率",
  boat5_motor_2_rate: "5号艇 モーター2連率",
  boat5_average_st: "5号艇 平均ST",
};

function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

function classify(row) {
  if (!row.sample_sufficient) return "insufficient";
  const recovery = Number(row.recovery_rate);
  const hit = Number(row.hit_rate);
  if (recovery >= 100 && hit >= 15) return "buy";
  if (recovery < 75) return "skip";
  return "watch";
}

function Card({ row, tone }) {
  return (
    <article className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.cardHead}>
        <strong>{LABELS[row.metric] || row.metric}</strong>
        <b>{row.bucket}</b>
      </div>
      <div className={styles.stats}>
        <div><span>回収率</span><strong>{pct(row.recovery_rate)}</strong></div>
        <div><span>的中率</span><strong>{pct(row.hit_rate)}</strong></div>
        <div><span>件数</span><strong>{row.races}R</strong></div>
      </div>
      <small>{row.sample_sufficient ? "100R以上" : "サンプル不足"}</small>
    </article>
  );
}

export default function SpecialistAiLab({ character, rows, latestDate, error }) {
  const isHatsune = character === "hatsune";
  const name = isHatsune ? "初音" : "キイナ";
  const subtitle = isHatsune ? "女子戦AI" : "5アタマAI";
  const overall = rows.find((r) => r.metric === "overall");
  const qualified = rows.filter((r) => r.metric !== "overall" && r.sample_sufficient);
  const buy = qualified.filter((r) => classify(r) === "buy").sort((a,b)=>Number(b.recovery_rate)-Number(a.recovery_rate)).slice(0,12);
  const watch = qualified.filter((r) => classify(r) === "watch").sort((a,b)=>Number(a.recovery_rate)-Number(b.recovery_rate)).slice(0,12);
  const skip = qualified.filter((r) => classify(r) === "skip").sort((a,b)=>Number(a.recovery_rate)-Number(b.recovery_rate)).slice(0,12);
  const insufficient = rows.filter((r) => r.metric !== "overall" && !r.sample_sufficient).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href="/admin">← 管理TOPへ</Link>
          <Link href="/admin/ai-bet-stats">AI買い目成績 →</Link>
        </div>
        <section className={`${styles.hero} ${isHatsune ? styles.hatsune : styles.kiina}`}>
          <div><span>{name.toUpperCase()} AI IMPROVEMENT LAB</span><h1>{name}AI 改善パネル</h1>
          <p>{subtitle}の公開済み公式買い目だけを30日ローリングで分析します。研究用表示で、本番ロジックは自動変更しません。</p></div>
          <div className={styles.dateBox}><span>最新分析日</span><strong>{latestDate || "—"}</strong></div>
        </section>

        {error ? <section className={styles.empty}><h2>分析データを読み込めません</h2><p>{error}</p></section> : <>
          <section className={styles.overview}>
            <div className={styles.heading}><div><span>30-DAY OVERVIEW</span><h2>現在の基準成績</h2></div><small>公式公開買い目のみ</small></div>
            {overall ? <div className={styles.overviewGrid}>
              <div><span>対象</span><strong>{overall.races}R</strong></div>
              <div><span>的中率</span><strong>{pct(overall.hit_rate)}</strong></div>
              <div><span>回収率</span><strong>{pct(overall.recovery_rate)}</strong></div>
              <div><span>平均点数</span><strong>{Number(overall.avg_tickets || 0).toFixed(2)}点</strong></div>
            </div> : <p>集計対象がありません。</p>}
          </section>

          <section className={styles.rule}>
            <strong>候補判定は100R以上から</strong>
            <p>買い候補=回収率100%以上かつ的中率15%以上、注意=回収率75〜99.99%、見送り候補=回収率75%未満。現在サンプル不足の条件は{insufficient}件です。</p>
          </section>

          {[
            ["BUY CANDIDATES","買い候補",buy,"buy"],
            ["WATCH LIST","注意候補",watch,"watch"],
            ["SKIP CANDIDATES","見送り候補",skip,"skip"],
          ].map(([eyebrow,title,list,tone]) => (
            <section className={styles.section} key={title}>
              <div className={styles.heading}><div><span>{eyebrow}</span><h2>{title}</h2></div><small>{list.length}条件</small></div>
              {list.length ? <div className={styles.grid}>{list.map((row)=><Card key={`${row.metric}-${row.bucket}`} row={row} tone={tone}/>)}</div>
                : <div className={styles.emptyMini}>100R以上の該当条件はまだありません。</div>}
            </section>
          ))}
        </>}
      </div>
    </main>
  );
}

import Image from "next/image";
import styles from "./IchikaMatePredictionPanel.module.css";

export default function IchikaMatePredictionPanel({ data, loading, picks, performance, stadiums, percent, formatDate }) {
  const timing = data?.rankingTiming === "after_exhibition" ? "展示後版の分析" : "前日版の分析";

  return (
    <section className={styles.panel} aria-label="一果といちまるの分析・予想">
      <header className={styles.header}>
        <span>ICHIKA × ICHIMARU</span>
        <h2>データを調べる相棒。<br />イン逃げを考える一果。</h2>
        <p>いちまるが分析 → 一果が考察・予想 → あなたが最終判断</p>
      </header>

      <section className={styles.check} aria-labelledby="ichimaru-data-check">
        <div className={styles.mateRow}>
          <Image src="/anime/ichimaru/03537EAC-91E6-45E9-AD64-5582CE3EF400.png" alt="いちまる" width={72} height={72} sizes="72px" />
          <div><span className={styles.step}>01 / 調査・整理</span><h3 id="ichimaru-data-check">いちまる DATA CHECK</h3><p>一果専属 AI MATE</p></div>
        </div>
        <p className={styles.speech}>イン逃げを考えるためのデータを整理して、一果に渡すよ！</p>
        <p className={styles.caption}>いちまるの調査テーマ</p>
        <ul className={styles.chips}>{["1号艇", "スタート", "当地成績", "機力", "進入", "相手艇"].map((label) => <li key={label}>{label}</li>)}</ul>
        <p className={styles.note}>調査テーマの紹介です。この画面では、既存エンジンの分析値と順位を表示します。個別項目の値や確認状況は表示していません。</p>
      </section>

      <div className={styles.arrow} aria-hidden="true">↓</div>
      <section className={styles.analysis} aria-labelledby="ichimaru-analysis">
        <div className={styles.sectionHeading}><div><span className={styles.step}>02 / データ分析</span><h3 id="ichimaru-analysis">いちまるの分析</h3></div>{data?.date && <time dateTime={data.date}>{formatDate(data.date)}</time>}</div>
        <p className={styles.caption}>{timing} · イン逃げ注目レース</p>
        {loading ? <p className={styles.empty} role="status">分析データを読み込み中…</p> : data?.error ? <p className={styles.empty} role="status">分析データを取得できませんでした。時間をおいてご確認ください。</p> : picks.length ? (
          <div className={styles.pickList}>
            {picks.map((pick) => <article className={styles.pick} key={`${pick.rankingType}-${pick.rankNo}-${pick.courseCode}-${pick.raceNo}`}>
              <div><small>分析ランク #{pick.rankNo}</small><h4>{stadiums[pick.courseCode] || `${pick.courseCode}場`} <span>{pick.raceNo}R</span></h4></div>
              <div className={styles.value}><span>イン逃げ期待度</span><strong>{pick.probability == null ? "—" : percent(pick.probability)}</strong></div>
            </article>)}
          </div>
        ) : <p className={styles.empty} role="status">本日の分析データは準備中です。</p>}
        <p className={styles.note}>分析値は一果が考えるための材料です。レース別の平均STや買い目など、取得していない情報は掲載していません。</p>
        <details className={styles.performance}><summary>分析ランキングの過去成績を見る</summary>{performance}<p className={styles.note}>イン逃げ注目ランキングに対し、1号艇が1着になった割合です。舟券の的中率や、一果の最終予想成績とは異なります。</p></details>
      </section>

      <div className={styles.arrow} aria-hidden="true">↓</div>
      <section className={styles.view} aria-labelledby="ichika-final-view">
        <span className={styles.step}>03 / 一果が考察・予想</span>
        <h3 id="ichika-final-view">一果の最終見解</h3>
        <div className={styles.characterRow}>
          <Image src="/anime/ichika/C402673C-5EB9-4B09-96CF-9FF4B6138382.png" alt="一果・イン逃げ研究担当" width={112} height={152} sizes="112px" />
          <div><b>一果</b><span>イン逃げ研究担当</span><p>いちまるの分析を入口に、進入・スタート・相手艇も重ねて考えるよ。1号艇だからと決めず、見送る判断も大切にしたいな！</p></div>
        </div>
        <p className={styles.note}>一果の考え方を紹介しています。レースごとの最終コメント・予想・買い目は、公開済みの一果新聞で確認できます。</p>
        <a className={styles.primaryLink} href="#ichika-published-predictions">一果の公開予想新聞を見る <span aria-hidden="true">→</span></a>
      </section>

      <div className={styles.arrow} aria-hidden="true">↓</div>
      <section className={styles.reader} aria-labelledby="ichika-reader-decision"><span className={styles.step}>04 / あなたが決める</span><h3 id="ichika-reader-decision">読者の最終判断</h3><p>分析と一果の見解を参考に、当日の公式情報やオッズも確認して、購入・見送りを自分で判断しましょう。</p><a className={styles.secondaryLink} href="/races">出走表を確認する →</a><p className={styles.note}>予想・分析は的中や利益を保証するものではありません。舟券の購入は20歳になってから。</p></section>
    </section>
  );
}

import styles from './trinity.module.css';

export const metadata = {
  title: '3人の作戦会議室 | BoatStrikers TRINITY',
  description: '一果・初音・キイナの専門分析を統合するBoatStrikers会員向けTRINITY作戦会議室。',
};

const specialists = [
  { key: 'ichika', icon: '🍀', name: '一果', role: '軸担当', text: 'イン逃げを中心に、1着軸の土台をつくる。' },
  { key: 'hatsune', icon: '🎀', name: '初音', role: '女子戦・相手担当', text: '女子戦では2・3着候補の評価を補正する。' },
  { key: 'kiina', icon: '⭐', name: 'キイナ', role: '穴・配当担当', text: '5号艇を中心に、相手穴や配当候補を探す。' },
];

export default function TrinityWarRoomPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>MEMBERS ONLY / BOATSTRIKERS TRINITY</p>
        <h1>3人の作戦会議室</h1>
        <p>一果・初音・キイナの専門分析をひとつの最終作戦へ。</p>
        <div className={styles.status}>TRINITY v2 検証中</div>
        <p className={styles.notice}>現在はバックテスト中です。未検証の買い目を実運用予想として公開していません。</p>
      </section>

      <section className={styles.summary} aria-label="今日のTRINITYサマリー">
        <div><strong>今日の作戦会議</strong><span>準備中</span></div>
        <div><strong>展示後更新</strong><span>未接続</span></div>
        <div><strong>結果精算</strong><span>未接続</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.heading}>
          <div><p>WAR ROOM</p><h2>3人の専門判断</h2></div>
          <span>前日版 / 展示後版に対応予定</span>
        </div>
        <div className={styles.specialists}>
          {specialists.map((item) => (
            <article className={`${styles.specialist} ${styles[item.key]}`} key={item.key}>
              <div className={styles.specialistTitle}><span>{item.icon}</span><div><h3>{item.name}</h3><p>{item.role}</p></div></div>
              <p>{item.text}</p>
              <div className={styles.placeholder}>当日の評価はTRINITY v2接続後に表示</div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCard}>
        <p className={styles.finalLabel}>🔥 TRINITY FINAL PLAN</p>
        <h2>3人の最終作戦</h2>
        <div className={styles.planGrid}>
          <div><span>本線</span><strong>—</strong></div>
          <div><span>対抗</span><strong>—</strong></div>
          <div><span>穴</span><strong>—</strong></div>
        </div>
        <div className={styles.pass}>現在は検証中のため買い目を公開していません</div>
        <p>バックテスト合格後、120通りの内部評価から「買い目」または「見送り」を表示します。</p>
      </section>

      <section className={styles.section}>
        <div className={styles.heading}><div><p>RESULT</p><h2>結果と振り返り</h2></div><span>予想履歴は上書きしない設計</span></div>
        <div className={styles.resultCard}>
          <div><span>前日作戦</span><strong>固定保存予定</strong></div>
          <div className={styles.arrow}>→</div>
          <div><span>展示後作戦</span><strong>別版で保存予定</strong></div>
          <div className={styles.arrow}>→</div>
          <div><span>レース結果</span><strong>自動精算予定</strong></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.heading}><div><p>PERFORMANCE</p><h2>TRINITY成績</h2></div><span>バックテスト / 公開後実績を分離予定</span></div>
        <div className={styles.metrics}>
          {['購入R','的中率','回収率','収支','平均点数','最大連敗','見送り率','高配当除外後'].map((label) => (
            <div key={label}><span>{label}</span><strong>—</strong></div>
          ))}
        </div>
        <p className={styles.footnote}>実績値はTRINITY v2のread-onlyバックテスト完了後に接続します。架空の成績値は表示しません。</p>
      </section>
    </main>
  );
}

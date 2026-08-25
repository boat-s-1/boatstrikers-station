import Link from "next/link";
import styles from "./membership.module.css";

export const metadata = {
  title: "BoatStrikers β Membership｜12月までPREMIUM無料",
  description:
    "BoatStrikers βメンバー募集中。2026年12月31日まで会員登録者にPLUS・PREMIUM相当の機能を無料開放します。",
};

const FEATURES = [
  ["本日の出走表", true, true, true],
  ["AI予想成績の公開", true, true, true],
  ["無料記事・初心者講座", true, true, true],
  ["一果・初音・キイナ攻略マガジン", false, true, true],
  ["24場攻略 完全版", false, true, true],
  ["データ研究記事・バックナンバー", false, true, true],
  ["🌙 前日版AI 全公開", false, false, true],
  ["⚡ 直前版AI 全公開", false, false, true],
  ["AI買い目・4モード分析", false, false, true],
  ["キャラクター別実戦予想", false, false, true],
  ["プレミアム通知", false, false, true],
];

const FAQ = [
  {q:"β期間は本当に無料ですか？",a:"はい。2026年12月31日まで、BoatStrikersに会員登録した方はβPREMIUM会員として扱います。登録だけで料金は発生しません。"},
  {q:"2027年になったら自動で課金されますか？",a:"いいえ。自動課金は行いません。有料プランへ移行する場合は事前に料金と内容をご案内し、ご自身で加入手続きをした方だけが課金対象になります。"},
  {q:"無料の出走表やAI成績は見られなくなりますか？",a:"いいえ。出走表、AI予想成績、無料記事など、BoatStrikersの基本コンテンツはFREEのまま利用できる設計です。"},
  {q:"β期間は何を検証するのですか？",a:"前日版・直前版AIの実績蓄積、利用される機能、サイトの使いやすさなどを検証し、正式サービスの内容改善に活用します。"},
];

function Check({active}){return <span className={active?styles.check:styles.dash}>{active?"✓":"—"}</span>;}

export default function MembershipPage(){
  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <p className={styles.eyebrow}>BOATSTRIKERS β MEMBERSHIP</p>
      <h1>AI育成期間につき、<br/><span>12月までPREMIUM無料。</span></h1>
      <p className={styles.lead}>BoatStrikers βメンバーを募集しています。<br/>会員登録だけで、PLUS・PREMIUM相当の機能を順次無料開放します。</p>
      <div className={styles.heroBadges}><span>🎟️ 登録料0円</span><span>🌙 前日版AI</span><span>⚡ 直前版AI</span></div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><p>BETA PROGRAM</p><h2>今は全プラン無料開放期間</h2><span>正式有料化前に、実績とデータを蓄積します</span></div>
      <div className={styles.planGrid}>
        <article className={`${styles.planCard} ${styles.free}`}><div className={styles.planTop}><span className={styles.planLabel}>FREE</span><h3>未登録でも使える</h3><div className={styles.price}><strong>¥0</strong><span>/ 月</span></div><p>出走表やAI成績など基本機能を利用。</p></div><ul><li>✓ 本日の出走表</li><li>✓ AI予想成績</li><li>✓ 無料記事・初心者講座</li></ul><Link className={styles.freeButton} href="/races">無料で使う</Link></article>
        <article className={`${styles.planCard} ${styles.plus}`}><div className={styles.planTop}><span className={styles.planLabel}>PLUS</span><h3>β期間は無料</h3><div className={styles.price}><strong>¥0</strong><span>12/31まで</span></div><p>攻略マガジン・データ研究・24場攻略を順次開放。</p></div><ul><li>✓ FREEの全機能</li><li>✓ 3人の攻略マガジン</li><li>✓ 24場攻略 完全版</li><li>✓ データ研究・バックナンバー</li></ul><Link className={styles.plusButton} href="/members">β会員登録する</Link></article>
        <article className={`${styles.planCard} ${styles.premium}`}><div className={styles.recommended}>12月まで無料</div><div className={styles.planTop}><span className={styles.planLabel}>β PREMIUM</span><h3>AI育成に参加する</h3><div className={styles.price}><strong>¥0</strong><span>12/31まで</span></div><p>前日版・直前版AIなどPREMIUM相当機能を順次開放。</p></div><ul><li>✓ PLUSの全機能</li><li>✓ 🌙 前日版AI</li><li>✓ ⚡ 直前版AI</li><li>✓ AI買い目・キャラ別予想</li><li>✓ 会員限定情報</li></ul><Link className={styles.premiumButton} href="/members">無料でβ会員になる</Link></article>
      </div>
    </section>

    <section className={styles.section}><div className={styles.sectionHeading}><p>COMPARE</p><h2>正式サービス予定の機能</h2><span>β期間は会員登録者へ順次無料開放します</span></div><div className={styles.tableWrap}><table className={styles.compareTable}><thead><tr><th>機能</th><th>FREE</th><th>PLUS</th><th>PREMIUM</th></tr></thead><tbody>{FEATURES.map(([label,free,plus,premium])=><tr key={label}><td>{label}</td><td><Check active={free}/></td><td><Check active={plus}/></td><td><Check active={premium}/></td></tr>)}</tbody></table></div></section>

    <section className={`${styles.section} ${styles.premiumSection}`}><div className={styles.sectionHeading}><p>PREMIUM AI</p><h2>会員登録して、<br/>AIの成長を一緒に検証。</h2></div><div className={styles.previewCard}><div className={styles.previewHead}><div><span>BoatStrikers AI</span><strong>β PREMIUM</strong></div><em>2026.12.31まで無料</em></div><div className={styles.previewMetrics}><div><span>前日版</span><strong>🌙 AI分析</strong></div><div><span>直前版</span><strong>⚡ 展示後分析</strong></div></div><div className={styles.lockBox}><span>🎟️ β MEMBER</span><strong>会員登録者へPREMIUM相当機能を順次開放</strong><p>利用状況とAI成績を蓄積し、正式サービス開始時の機能・料金設計に活かします。</p></div></div></section>

    <section className={styles.section}><div className={styles.sectionHeading}><p>FAQ</p><h2>よくある質問</h2></div><div className={styles.faqList}>{FAQ.map(item=><details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div></section>

    <section className={styles.finalCta}><p>BOATSTRIKERS β MEMBERSHIP</p><h2>今は、登録するだけ。<br/>12月までPREMIUM無料。</h2><span>将来有料化する場合も、自動で課金が始まることはありません。</span><div className={styles.ctaButtons}><Link href="/members">無料でβ会員登録</Link><a href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer">公式LINEも登録する</a></div></section>
  </main>;
}

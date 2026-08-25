import Link from "next/link";
import styles from "./membership.module.css";

export const metadata = {
  title: "BoatStrikers Membership｜会員プラン",
  description:
    "BoatStrikersのFREE・PLUS・PREMIUM会員プラン。攻略マガジン、前日版AI、直前版AI、キャラクター別予想などの特典を比較できます。",
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
  {
    q: "無料の出走表やAI成績は見られなくなりますか？",
    a: "いいえ。出走表、AI予想成績、無料記事など、BoatStrikersの基本コンテンツはFREEのまま利用できます。",
  },
  {
    q: "PLUSとPREMIUMの一番大きな違いは？",
    a: "PLUSは攻略マガジンやデータ研究を読むためのプラン、PREMIUMは前日版・直前版AIや実戦向け買い目まで確認できるプランです。",
  },
  {
    q: "前日版と直前版は同じ予想ですか？",
    a: "別集計です。前日版は前日時点の情報、直前版は展示後の情報を反映した予想として、それぞれ独立して公開・成績集計します。",
  },
  {
    q: "AI成績は会員限定になりますか？",
    a: "なりません。AI成績ページは今後も無料公開し、予想の実績を誰でも確認できる形を基本にします。",
  },
];

function Check({ active }) {
  return (
    <span className={active ? styles.check : styles.dash} aria-label={active ? "利用可" : "対象外"}>
      {active ? "✓" : "—"}
    </span>
  );
}

export default function MembershipPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.eyebrow}>BOATSTRIKERS MEMBERSHIP</p>
        <h1>
          もっと深く、もっと早く。
          <br />
          <span>BoatStrikersを使いこなす。</span>
        </h1>
        <p className={styles.lead}>
          出走表とAI成績は無料のまま。
          <br />
          攻略を学びたい人にはPLUS、実戦でAIを使いたい人にはPREMIUM。
        </p>
        <div className={styles.heroBadges}>
          <span>📘 攻略マガジン</span>
          <span>🌙 前日版AI</span>
          <span>⚡ 直前版AI</span>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>PLANS</p>
          <h2>3つの会員プラン</h2>
          <span>使い方に合わせて選べます</span>
        </div>

        <div className={styles.planGrid}>
          <article className={`${styles.planCard} ${styles.free}`}>
            <div className={styles.planTop}>
              <span className={styles.planLabel}>FREE</span>
              <h3>まずは無料で</h3>
              <div className={styles.price}><strong>¥0</strong><span>/ 月</span></div>
              <p>BoatStrikersの基本機能をそのまま利用。</p>
            </div>
            <ul>
              <li>✓ 本日の出走表</li>
              <li>✓ AI予想成績</li>
              <li>✓ 無料記事・初心者講座</li>
              <li>✓ 一部のAI評価</li>
            </ul>
            <Link className={styles.freeButton} href="/races">無料で使う</Link>
          </article>

          <article className={`${styles.planCard} ${styles.plus}`}>
            <div className={styles.planTop}>
              <span className={styles.planLabel}>PLUS</span>
              <h3>攻略を深く学ぶ</h3>
              <div className={styles.price}><strong>¥980</strong><span>/ 月</span></div>
              <p>雑誌・データ研究・24場攻略をまとめて読み放題。</p>
            </div>
            <ul>
              <li>✓ FREEの全機能</li>
              <li>✓ 3人の攻略マガジン</li>
              <li>✓ 24場攻略 完全版</li>
              <li>✓ データ研究・バックナンバー</li>
            </ul>
            <a className={styles.plusButton} href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer">先行案内を受け取る</a>
          </article>

          <article className={`${styles.planCard} ${styles.premium}`}>
            <div className={styles.recommended}>おすすめ</div>
            <div className={styles.planTop}>
              <span className={styles.planLabel}>PREMIUM</span>
              <h3>実戦でAIを使う</h3>
              <div className={styles.price}><strong>¥2,980</strong><span>/ 月</span></div>
              <p>前日版・直前版AIから最終買い目までフルアクセス。</p>
            </div>
            <ul>
              <li>✓ PLUSの全機能</li>
              <li>✓ 🌙 前日版AI 全公開</li>
              <li>✓ ⚡ 直前版AI 全公開</li>
              <li>✓ AI買い目・キャラ別予想</li>
              <li>✓ プレミアム通知</li>
            </ul>
            <a className={styles.premiumButton} href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer">PREMIUM先行案内</a>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>COMPARE</p>
          <h2>プラン比較</h2>
          <span>無料機能はこれからも残します</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.compareTable}>
            <thead>
              <tr><th>機能</th><th>FREE</th><th>PLUS</th><th>PREMIUM</th></tr>
            </thead>
            <tbody>
              {FEATURES.map(([label, free, plus, premium]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td><Check active={free} /></td>
                  <td><Check active={plus} /></td>
                  <td><Check active={premium} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${styles.section} ${styles.premiumSection}`}>
        <div className={styles.sectionHeading}>
          <p>PREMIUM AI</p>
          <h2>予想の存在は無料で見せる。<br />答えはPREMIUMで。</h2>
        </div>
        <div className={styles.previewCard}>
          <div className={styles.previewHead}>
            <div><span>蒲郡 12R</span><strong>一果AI 最終評価</strong></div>
            <em>⚡ 直前版</em>
          </div>
          <div className={styles.previewMetrics}>
            <div><span>イン逃げ期待度</span><strong>86%</strong></div>
            <div><span>展示評価</span><strong>★★★★★</strong></div>
          </div>
          <div className={styles.lockBox}>
            <span>🔒 PREMIUM</span>
            <strong>最終買い目・相手本線・危険艇・穴候補</strong>
            <p>無料ユーザーにもAI評価までは公開し、PREMIUMで実戦情報を開放する設計です。</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>CHARACTERS</p>
          <h2>3人の専門予想をひとつに</h2>
        </div>
        <div className={styles.characterGrid}>
          <article><span>🍊 ICHIKA</span><h3>一果</h3><strong>イン逃げ特化</strong><p>逃げイチ、危険イン、イン逃げ期待度AI。</p></article>
          <article><span>💚 HATSUNE</span><h3>初音</h3><strong>女子戦特化</strong><p>女子戦注目レース、高モーター、ヴィーナス攻略。</p></article>
          <article><span>💜 KIINA</span><h3>キイナ</h3><strong>5号艇・穴特化</strong><p>5アタマ警報、高配当候補、穴期待値ランキング。</p></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>FAQ</p>
          <h2>よくある質問</h2>
        </div>
        <div className={styles.faqList}>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <p>BOATSTRIKERS MEMBERSHIP</p>
        <h2>まずは無料で使って、<br />必要になったらアップグレード。</h2>
        <span>有料プランの受付開始情報は公式LINEで案内します。</span>
        <div className={styles.ctaButtons}>
          <Link href="/races">出走表を見る</Link>
          <a href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noopener noreferrer">公式LINEで先行案内</a>
        </div>
      </section>
    </main>
  );
}

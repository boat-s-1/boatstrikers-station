import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata = {
  title: "プライバシーポリシー｜BoatStrikers",
  description: "BoatStrikersにおける個人情報、Cookie、アクセス解析等の取り扱いについてご案内します。",
  alternates: { canonical: "/privacy" },
};

const sections = [
  ["01", "基本方針", <><p>BoatStrikers（以下「当サイト」といいます。）は、利用者の個人情報およびプライバシーを尊重し、個人情報の保護に関する法令その他の関連ルールを踏まえて、適切な取得・利用・管理に努めます。</p></>],
  ["02", "取得する情報", <><p>当サイトでは、利用状況に応じて次の情報を取得する場合があります。</p><ul><li>お問い合わせ時に入力された氏名・ニックネーム・メールアドレス・お問い合わせ内容</li><li>IPアドレス、ブラウザ、OS、端末種別、閲覧日時、閲覧ページなどのアクセス情報</li><li>Cookie、広告識別子その他これらに類する識別情報</li><li>当サイト上での操作履歴やサービス利用状況</li></ul></>],
  ["03", "情報の利用目的", <><ul><li>お問い合わせへの対応</li><li>当サイトおよび各種コンテンツ・サービスの提供、維持、改善</li><li>利用状況の分析、機能改善、表示内容の最適化</li><li>不正利用やセキュリティ上の問題の防止・調査</li><li>重要なお知らせ、規約・ポリシー変更などのご案内</li><li>広告や紹介コンテンツの効果測定</li><li>法令上必要な対応および権利保護</li></ul></>],
  ["04", "Cookie・アクセス解析について", <><p>当サイトでは、利便性の向上、利用状況の把握、サービス改善などのため、Cookieその他の類似技術を利用する場合があります。</p><div className={styles.cautionBox}><strong>Google Analyticsを利用しています</strong><span>当サイトではGoogle Analyticsを利用し、ページ閲覧などの利用状況を分析しています。取得される情報はGoogleの規約・プライバシーポリシーに基づいて管理されます。</span></div><p>利用者はブラウザの設定によりCookieを無効にできますが、一部機能が正常に利用できない場合があります。</p><ul><li><a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener noreferrer">Google プライバシーポリシー</a></li><li><a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noopener noreferrer">Google Analytics オプトアウト アドオン</a></li></ul></>],
  ["05", "外部サービスについて", <><p>当サイトでは、YouTube、LINE、note、SNS、Google Analyticsその他の外部サービスへのリンクや埋め込みコンテンツを利用する場合があります。外部サービスで取得される情報は、各サービス提供者のプライバシーポリシー等に基づいて取り扱われます。</p></>],
  ["06", "広告・アフィリエイトについて", <><p>当サイトでは、広告配信サービスやアフィリエイトプログラムを利用する場合があります。その際、広告の配信、表示回数の測定、成果計測などのためCookieその他の識別情報が利用されることがあります。</p></>],
  ["07", "第三者提供について", <><p>当サイトは、法令に基づく場合など正当な理由がある場合を除き、本人の同意なく個人情報を第三者へ提供しません。</p></>],
  ["08", "情報の安全管理", <><p>当サイトは、保有する個人情報への不正アクセス、漏えい、紛失、改ざん等を防ぐため、必要かつ適切な安全管理に努めます。</p></>],
  ["09", "開示・訂正・削除などのご希望", <><p>当サイトが保有する個人情報について、本人から開示、訂正、利用停止、削除等のお申し出があった場合は、本人確認を行ったうえで、法令に従い適切に対応します。</p><p><Link href="/contact">お問い合わせページ</Link>からご連絡ください。</p></>],
  ["10", "未成年者の利用について", <><p>当サイトにはボートレースに関する情報が含まれます。舟券の購入は20歳以上の方に限られています。未成年の方が当サイトを利用する場合は、必要に応じて保護者の方と一緒に内容をご確認ください。</p></>],
  ["11", "プライバシーポリシーの変更", <><p>当サイトは、法令、サービス内容、利用する外部サービス、運営方法等の変更に応じて、本プライバシーポリシーを必要に応じて変更することがあります。</p></>],
  ["12", "お問い合わせ窓口", <><p>本プライバシーポリシーや個人情報の取り扱いに関するお問い合わせは、<Link href="/contact">BoatStrikers お問い合わせページ</Link>からご連絡ください。</p></>],
];

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>BOAT<br /><span>STRIKERS</span></Link>
        <a href="https://lin.ee/Pf3FEEQ" className={styles.lineButton} target="_blank" rel="noopener noreferrer">LINE登録</a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroIcon}>🔐</div>
        <span>PRIVACY POLICY</span>
        <h1>プライバシーポリシー</h1>
        <p>BoatStrikersにおける個人情報・Cookie・<br className={styles.mobileBreak} />アクセス情報の取り扱いをご案内します。</p>
      </section>

      <section className={styles.summary}>
        <div className={styles.summaryIcon}>🛟</div>
        <div><h2>安心してご利用いただくために</h2><p>お問い合わせ情報やアクセス情報をどのように取得・利用・管理するか、Google AnalyticsやCookieを含めて掲載しています。</p></div>
      </section>

      <nav className={styles.tableOfContents} aria-label="プライバシーポリシーの目次">
        <h2>目次</h2><div className={styles.tocGrid}>{sections.map(([n,t],i)=><a key={n} href={`#privacy-${i+1}`}><span>{n}</span>{t}</a>)}</div>
      </nav>

      <div className={styles.sectionList}>{sections.map(([n,t,c],i)=><section id={`privacy-${i+1}`} key={n} className={`${styles.termsSection} ${n === "04" ? styles.importantSection : ""}`}><div className={styles.sectionHeading}><span>{n}</span><h2>{t}</h2></div><div className={styles.sectionContent}>{c}</div></section>)}</div>

      {/* ========================================
    通常フッターサイトマップ
======================================== */}
<footer className="siteFooter">
  <div className="siteFooterInner">
   

    <nav className="footerSitemap" aria-label="フッターサイトマップ">
      <div className="footerLinkGroup">
        <h2>予想を見る</h2>

        <a href="/">ホーム</a>
        <a href="/races">本日の出走表</a>
        <a href="/ichika">一果のイン逃げ予想</a>
        <a href="/hatsune">初音の女子戦攻略</a>
        <a href="/kiina">キイナの5号艇予想</a>
        <a href="/bsc2">BSC</a>
      </div>

      <div className="footerLinkGroup">
        <h2>学ぶ・楽しむ</h2>

        <a href="/library">一果図書館</a>
        <a href="/library/stadiums">全国24場攻略</a>
        <a href="/ichika-sensei">教えて！一果センセー</a>
        <a href="/comic">ふなけん研究部</a>
        <a href="/radio">ボート・ナイト・ニッポン</a>
        <a href="/schedule">番組表</a>
      </div>

      <div className="footerLinkGroup">
        <h2>サイト案内</h2>

        <a href="/about">BoatStrikersについて</a>
        <a href="/sitemap">サイトマップ</a>
        <a href="/contact">お問い合わせ</a>
        <a href="/privacy">プライバシーポリシー</a>
        <a href="/terms">利用規約</a>
        <a href="/disclaimer">免責事項</a>
      </div>
    </nav>

    <div className="footerNotice">
      <p>
        当サイトに掲載している予想や情報は、
        的中および利益を保証するものではありません。
      </p>

      <p>
        舟券の購入は20歳になってから。
        無理のない範囲でボートレースをお楽しみください。
      </p>
    </div>
  </div>
</footer>
    </main>
  );
}

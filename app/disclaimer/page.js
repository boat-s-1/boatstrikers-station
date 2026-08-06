import Link from "next/link";
import styles from "./disclaimer.module.css";

export const metadata = {
  title: "免責事項｜BoatStrikers",
  description:
    "BoatStrikersの予想情報、掲載データ、外部リンク、著作権、動画・レース映像などに関する免責事項をご案内します。",
  alternates: {
    canonical: "/disclaimer",
  },
  openGraph: {
    title: "免責事項｜BoatStrikers",
    description:
      "BoatStrikersをご利用いただく際の注意事項と、動画・レース映像の取り扱いについてご案内します。",
    url: "/disclaimer",
    type: "website",
  },
};

const disclaimerSections = [
  {
    number: "01",
    title: "掲載情報について",
    content: (
      <>
        <p>
          BoatStrikers（以下「当サイト」といいます。）では、
          ボートレースに関する出走情報、展示情報、選手・モーター情報、
          予想、解説、記事、動画その他のコンテンツを掲載しています。
        </p>
        <p>
          掲載にあたっては正確な情報を提供できるよう努めていますが、
          情報の正確性、完全性、最新性、有用性を保証するものではありません。
          開催状況、出走情報、オッズ、気象条件、レース結果などは、
          必ず主催者・公式発表もあわせてご確認ください。
        </p>
      </>
    ),
  },
  {
    number: "02",
    title: "予想・的中・利益について",
    content: (
      <>
        <p>
          当サイトに掲載する予想、評価、買い目、分析、指数、ランキング、
          シミュレーションなどは、的中や利益を保証するものではありません。
        </p>
        <p>
          過去の成績、的中率、回収率、払戻金などは、
          将来の結果を保証または示唆するものではありません。
          レース結果は、選手の状態、進入、スタート、天候、水面状況、
          事故その他さまざまな要因により変動します。
        </p>
      </>
    ),
  },
  {
    number: "03",
    title: "舟券の購入について",
    content: (
      <>
        <p>
          舟券の購入およびレースへの参加は、ご自身の判断と責任で行ってください。
          当サイトの情報を利用したことによって生じた損失、損害、トラブルについて、
          当サイトは法令上責任を負う場合を除き、責任を負いません。
        </p>

        <div className={styles.cautionBox}>
          <strong>舟券の購入は20歳になってから</strong>
          <span>
            生活に支障のない範囲で、無理のない資金と時間でお楽しみください。
          </span>
        </div>
      </>
    ),
  },
  {
    number: "04",
    title: "サービスの変更・停止",
    content: (
      <>
        <p>
          当サイトは、メンテナンス、システム障害、通信障害、
          外部サービスの仕様変更、災害その他の事情により、
          予告なくコンテンツの変更、公開停止、削除またはサービスの中断を行う場合があります。
        </p>
        <p>
          これらによって利用者に損害が生じた場合でも、
          当サイトは法令上責任を負う場合を除き、責任を負いません。
        </p>
      </>
    ),
  },
  {
    number: "05",
    title: "外部サイト・外部サービス",
    content: (
      <>
        <p>
          当サイトには、YouTube、LINE、note、SNSその他の外部サイトや
          外部サービスへのリンク、埋め込みコンテンツが含まれる場合があります。
        </p>
        <p>
          外部サイトで提供される情報、商品、サービス、広告などについては、
          各運営者が責任を負います。
          当サイトは、リンク先の内容、安全性、利用条件などを保証するものではありません。
        </p>
      </>
    ),
  },
  {
    number: "06",
    title: "広告・アフィリエイトについて",
    content: (
      <>
        <p>
          当サイトでは、広告配信サービスやアフィリエイトプログラムを利用する場合があります。
          広告や紹介リンクを経由して商品・サービスを申し込まれた場合、
          契約は利用者と販売者またはサービス提供者との間で成立します。
        </p>
        <p>
          商品・サービスの価格、内容、保証、返品、解約その他の条件は、
          必ず販売者またはサービス提供者の案内をご確認ください。
        </p>
      </>
    ),
  },
  {
    number: "07",
    title: "著作権・知的財産権",
    content: (
      <>
        <p>
          当サイトに掲載している文章、デザイン、ロゴ、キャラクター、
          イラスト、画像、動画、音声、データの編集物その他のコンテンツに関する権利は、
          当サイトまたは正当な権利者に帰属します。
        </p>
        <p>
          法令で認められる場合を除き、権利者の許可なく転載、複製、改変、
          再配布、販売、公衆送信その他の利用を行うことは禁止します。
        </p>
      </>
    ),
  },
  {
    number: "08",
    title: "動画・レース映像について",
    content: (
      <>
        <p>
          BoatStrikersの動画コンテンツで使用しているレース映像は、
          必要な使用許可を得たうえで、
          各ボートレース場および関係団体が定める規約・ガイドラインに従って
          編集・配信しています。
        </p>
        <p>
          レース映像の著作権その他の権利は、
          各ボートレース場、施行者、映像提供者その他の権利者に帰属します。
        </p>
        <p>
          当サイトおよび当チャンネルで配信している動画、画像、音声などを、
          許可なく転載、複製、再配布、編集して利用することは禁止します。
        </p>
        <p>
          映像の使用状況や掲載内容は、
          許諾条件や各場の規約・ガイドラインの変更などにより、
          予告なく変更する場合があります。
        </p>

        <div className={styles.videoNote}>
          <span aria-hidden="true">🎬</span>
          <p>
            動画ごとにクレジット表記などの条件が指定されている場合は、
            当該条件に従って動画内または概要欄などへ表示します。
          </p>
        </div>
      </>
    ),
  },
  {
    number: "09",
    title: "コメント・投稿内容",
    content: (
      <>
        <p>
          当サイトや関連する動画・SNSなどに投稿されたコメントについて、
          法令違反、権利侵害、誹謗中傷、迷惑行為、不適切な宣伝などに該当すると
          当サイトが判断した場合は、予告なく非表示または削除する場合があります。
        </p>
        <p>
          投稿内容に関する責任は投稿者本人が負うものとし、
          投稿によって第三者との間に生じた問題については、
          当事者間で解決していただく場合があります。
        </p>
      </>
    ),
  },
  {
    number: "10",
    title: "免責事項の変更",
    content: (
      <>
        <p>
          当サイトは、法令、サービス内容、運営方法などの変更に応じて、
          本免責事項を予告なく変更する場合があります。
        </p>
        <p>
          変更後の内容は、このページへ掲載した時点から適用されます。
          ご利用の際は、最新の内容をご確認ください。
        </p>
      </>
    ),
  },
];

export default function DisclaimerPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="BoatStrikers ホーム">
          BOAT
          <br />
          <span>STRIKERS</span>
        </Link>

        <a
          href="https://lin.ee/Pf3FEEQ"
          className={styles.lineButton}
          target="_blank"
          rel="noopener noreferrer"
        >
          LINE登録
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroIcon} aria-hidden="true">
          ⚠️
        </div>
        <span>DISCLAIMER</span>
        <h1>免責事項</h1>
        <p>
          BoatStrikersをご利用いただく際の注意事項と、
          <br className={styles.mobileBreak} />
          動画・レース映像の取り扱いについてご案内します。
        </p>
      </section>

      <section className={styles.summary}>
        <div className={styles.summaryIcon} aria-hidden="true">
          ⚓
        </div>
        <div>
          <h2>情報をご利用になる前にご確認ください</h2>
          <p>
            当サイトの情報は、ボートレースを学び、楽しむための参考情報です。
            予想の的中や利益を保証するものではありません。
          </p>
        </div>
      </section>

      <nav className={styles.tableOfContents} aria-label="免責事項の目次">
        <h2>目次</h2>
        <div className={styles.tocGrid}>
          {disclaimerSections.map((section, index) => (
            <a key={section.number} href={`#disclaimer-${index + 1}`}>
              <span>{section.number}</span>
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className={styles.sectionList}>
        {disclaimerSections.map((section, index) => (
          <section
            id={`disclaimer-${index + 1}`}
            key={section.number}
            className={`${styles.disclaimerSection} ${
              section.number === "08" ? styles.videoSection : ""
            }`}
          >
            <div className={styles.sectionHeading}>
              <span>{section.number}</span>
              <h2>{section.title}</h2>
            </div>

            <div className={styles.sectionContent}>{section.content}</div>
          </section>
        ))}
      </div>

      <section className={styles.contactSection}>
        <div className={styles.contactIcon} aria-hidden="true">
          ✉️
        </div>
        <div>
          <span>CONTACT</span>
          <h2>掲載内容に関するお問い合わせ</h2>
          <p>
            権利関係、掲載内容、動画・レース映像などに関するご連絡は、
            お問い合わせページからお願いいたします。
          </p>
        </div>
        <Link href="/contact" className={styles.contactButton}>
          お問い合わせへ
        </Link>
      </section>

      <section className={styles.revision}>
        <p>
          <span>制定日</span>
          2026年8月6日
        </p>
        <p>
          <span>最終改定日</span>
          2026年8月6日
        </p>
        <p>
          <span>運営</span>
          BoatStrikers運営事務局
        </p>
      </section>

      <div className={styles.backLinks}>
        <Link href="/privacy">プライバシーポリシーへ</Link>
        <Link href="/sitemap">サイトマップへ</Link>
        <Link href="/">トップページへ</Link>
      </div>

      <footer className={styles.footer}>
        <nav aria-label="フッター">
          <Link href="/">ホーム</Link>
          <Link href="/about">BoatStrikersについて</Link>
          <Link href="/sitemap">サイトマップ</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/disclaimer">免責事項</Link>
        </nav>
        <p>© BoatStrikers</p>
      </footer>
    </main>
  );
}

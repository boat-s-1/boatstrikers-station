import Link from "next/link";
import styles from "./terms.module.css";

export const metadata = {
  title: "利用規約｜BoatStrikers",
  description:
    "BoatStrikersのサービス、掲載情報、禁止事項、知的財産権、免責、規約変更など、ご利用条件をご案内します。",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "利用規約｜BoatStrikers",
    description:
      "BoatStrikersをご利用いただく際のルールと条件をご案内します。",
    url: "/terms",
    type: "website",
  },
};

const termsSections = [
  {
    number: "01",
    title: "本規約について",
    content: (
      <>
        <p>
          この利用規約（以下「本規約」といいます。）は、
          BoatStrikers（以下「当サイト」といいます。）が提供する
          ウェブサイト、記事、出走情報、予想、動画、音声、画像その他の
          コンテンツおよびサービス（以下「本サービス」といいます。）の
          利用条件を定めるものです。
        </p>
        <p>
          利用者は、本サービスを利用することにより、
          本規約の内容を確認し、同意したものとみなされます。
        </p>
      </>
    ),
  },
  {
    number: "02",
    title: "本サービスの内容",
    content: (
      <>
        <p>
          当サイトでは、ボートレースに関する情報を、
          学ぶ・見る・聴く・楽しむためのコンテンツとして提供します。
        </p>
        <ul>
          <li>開催場、出走表、展示情報などのレース情報</li>
          <li>キャラクターによる予想、評価、買い目、解説</li>
          <li>初心者講座、全国24場攻略、記事、電子コンテンツ</li>
          <li>漫画、動画、ラジオ、音声などのエンターテインメント</li>
          <li>その他、当サイトが随時提供するサービス</li>
        </ul>
        <p>
          本サービスの内容、名称、仕様、公開期間および提供方法は、
          必要に応じて変更する場合があります。
        </p>
      </>
    ),
  },
  {
    number: "03",
    title: "利用者の責任",
    content: (
      <>
        <p>
          利用者は、自らの責任において本サービスを利用するものとし、
          本サービスの利用に必要な端末、通信環境、ソフトウェアその他の
          環境を自ら用意するものとします。
        </p>
        <p>
          当サイトに掲載される情報を利用して行う判断、舟券購入、
          外部サービスの利用その他の行為は、利用者自身の判断と責任で行ってください。
        </p>
      </>
    ),
  },
  {
    number: "04",
    title: "予想情報と舟券購入",
    content: (
      <>
        <p>
          当サイトに掲載する予想、評価、指数、分析、買い目、
          的中率、回収率その他の情報は、参考情報として提供するものであり、
          的中、利益または特定の結果を保証するものではありません。
        </p>

        <div className={styles.cautionBox}>
          <strong>舟券の購入は20歳になってから</strong>
          <span>
            舟券を購入する場合は、生活に支障のない範囲で、
            ご自身の判断と責任によりお楽しみください。
          </span>
        </div>

        <p>
          利用者は、開催状況、出走情報、オッズ、レース結果その他の重要な情報を、
          主催者や公式発表でも確認するものとします。
        </p>
      </>
    ),
  },
  {
    number: "05",
    title: "禁止事項",
    content: (
      <>
        <p>
          利用者は、本サービスの利用にあたり、次の行為をしてはなりません。
        </p>
        <ul>
          <li>法令、公序良俗または本規約に違反する行為</li>
          <li>当サイトまたは第三者の権利、名誉、信用、プライバシーを侵害する行為</li>
          <li>コンテンツを無断で転載、複製、改変、再配布、販売する行為</li>
          <li>当サイトの運営を妨害し、または過度な負荷を与える行為</li>
          <li>不正アクセス、脆弱性の探索、データの不正取得を行う行為</li>
          <li>自動化された手段で大量の情報を収集する行為</li>
          <li>当サイトまたは第三者になりすます行為</li>
          <li>虚偽の情報を送信または投稿する行為</li>
          <li>誹謗中傷、迷惑行為、スパム、無断広告、勧誘を行う行為</li>
          <li>本サービスを違法な賭博や不正行為に利用する行為</li>
          <li>その他、当サイトが不適切と合理的に判断する行為</li>
        </ul>
      </>
    ),
  },
  {
    number: "06",
    title: "知的財産権",
    content: (
      <>
        <p>
          本サービスに掲載される文章、ロゴ、キャラクター、デザイン、
          イラスト、画像、動画、音声、編集データその他のコンテンツに関する
          著作権、商標権その他の知的財産権は、
          当サイトまたは正当な権利を有する第三者に帰属します。
        </p>
        <p>
          私的使用など法令で認められる範囲を除き、
          権利者の許可なく利用することはできません。
        </p>
      </>
    ),
  },
  {
    number: "07",
    title: "動画・レース映像",
    content: (
      <>
        <p>
          本サービスで使用するレース映像は、
          必要な使用許可を得たうえで、
          各ボートレース場および関係団体が定める
          規約・ガイドラインに従って編集・配信します。
        </p>
        <p>
          レース映像に関する著作権その他の権利は、
          各ボートレース場、施行者、映像提供者その他の
          正当な権利者に帰属します。
        </p>
        <p>
          当サイトや関連チャンネルの動画、画像、音声を、
          許可なく転載、複製、切り抜き、再配布、再編集することは禁止します。
        </p>
      </>
    ),
  },
  {
    number: "08",
    title: "コメント・投稿",
    content: (
      <>
        <p>
          当サイトまたは関連する動画・SNSなどへコメントその他の内容を
          投稿できる場合、投稿者は、その内容について必要な権利を有し、
          第三者の権利を侵害していないことを保証するものとします。
        </p>
        <p>
          法令違反、誹謗中傷、権利侵害、迷惑行為、
          不適切な広告・勧誘などに該当すると当サイトが合理的に判断した場合、
          予告なく投稿を非表示または削除することがあります。
        </p>
      </>
    ),
  },
  {
    number: "09",
    title: "外部サービス",
    content: (
      <>
        <p>
          本サービスには、YouTube、LINE、note、SNS、
          広告配信サービスその他の外部サービスへのリンクや
          埋め込みコンテンツが含まれる場合があります。
        </p>
        <p>
          外部サービスの利用には、それぞれの運営者が定める
          利用規約やプライバシーポリシーが適用されます。
          当サイトは、外部サービスの内容、継続性、安全性を保証するものではありません。
        </p>
      </>
    ),
  },
  {
    number: "10",
    title: "広告・紹介リンク",
    content: (
      <>
        <p>
          当サイトでは、広告、アフィリエイトリンク、
          商品またはサービスの紹介を掲載する場合があります。
        </p>
        <p>
          広告または紹介先の商品・サービスに関する契約は、
          利用者と販売者またはサービス提供者との間で成立します。
          購入や申込みの前に、価格、条件、返品、解約、保証などを
          必ず提供元のページでご確認ください。
        </p>
      </>
    ),
  },
  {
    number: "11",
    title: "サービスの変更・停止",
    content: (
      <>
        <p>
          当サイトは、次の場合に、本サービスの全部または一部を
          予告なく変更、中断または終了することがあります。
        </p>
        <ul>
          <li>システムの点検、更新または保守を行う場合</li>
          <li>通信障害、システム障害、不正アクセスなどが発生した場合</li>
          <li>災害、停電、感染症その他の不可抗力が生じた場合</li>
          <li>外部サービスの停止または仕様変更があった場合</li>
          <li>その他、運営上必要と合理的に判断した場合</li>
        </ul>
      </>
    ),
  },
  {
    number: "12",
    title: "保証の否認・責任の範囲",
    content: (
      <>
        <p>
          当サイトは、本サービスについて、
          正確性、完全性、最新性、有用性、特定目的への適合性、
          継続的な提供、エラーや障害が発生しないことを保証しません。
        </p>
        <p>
          当サイトの責任は、適用される法令の範囲で判断されます。
          当サイトの故意または重大な過失による場合など、
          法令上免責が認められない責任を排除するものではありません。
        </p>
      </>
    ),
  },
  {
    number: "13",
    title: "個人情報の取り扱い",
    content: (
      <>
        <p>
          利用者の個人情報および利用情報の取り扱いについては、
          当サイトの
          <Link href="/privacy">プライバシーポリシー</Link>
          に従います。
        </p>
      </>
    ),
  },
  {
    number: "14",
    title: "本規約の変更",
    content: (
      <>
        <p>
          当サイトは、法令、サービス内容または運営方法の変更などに応じて、
          必要かつ合理的な範囲で本規約を変更することがあります。
        </p>
        <p>
          変更する場合は、変更内容および適用時期を、
          当サイト上への掲載その他の適切な方法でお知らせします。
          変更後の規約は、告知した適用日から効力を生じます。
        </p>
      </>
    ),
  },
  {
    number: "15",
    title: "準拠法・裁判管轄",
    content: (
      <>
        <p>
          本規約および本サービスには、日本法を準拠法として適用します。
        </p>
        <p>
          本サービスに関連して紛争が生じた場合は、
          当事者間で誠実に協議し、解決に努めるものとします。
          協議によって解決しない場合の裁判管轄は、
          適用される法令に従って定められるものとします。
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
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
          📘
        </div>
        <span>TERMS OF USE</span>
        <h1>利用規約</h1>
        <p>
          BoatStrikersをご利用いただく際の
          <br className={styles.mobileBreak} />
          ルールと条件をご案内します。
        </p>
      </section>

      <section className={styles.summary}>
        <div className={styles.summaryIcon} aria-hidden="true">
          ⚓
        </div>
        <div>
          <h2>楽しく、安心してご利用いただくために</h2>
          <p>
            本サービスをご利用になる前に、本規約をご確認ください。
            特に、予想情報、舟券購入、禁止事項、著作権について大切な内容を掲載しています。
          </p>
        </div>
      </section>

      <nav className={styles.tableOfContents} aria-label="利用規約の目次">
        <h2>目次</h2>
        <div className={styles.tocGrid}>
          {termsSections.map((section, index) => (
            <a key={section.number} href={`#terms-${index + 1}`}>
              <span>{section.number}</span>
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className={styles.sectionList}>
        {termsSections.map((section, index) => (
          <section
            id={`terms-${index + 1}`}
            key={section.number}
            className={`${styles.termsSection} ${
              section.number === "04" ? styles.importantSection : ""
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
        <a href="/program">番組表</a>
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

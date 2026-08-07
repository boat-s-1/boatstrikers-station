import Link from "next/link";
import ContactForm from "./ContactForm";
import styles from "./contact.module.css";

export const metadata = {
  title: "お問い合わせ｜BoatStrikers",
  description:
    "BoatStrikersへのご質問、ご意見、掲載内容、権利関係、動画・レース映像、広告・お仕事のご相談はこちらからお送りください。",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "お問い合わせ｜BoatStrikers",
    description:
      "BoatStrikersへのお問い合わせ窓口です。",
    url: "/contact",
    type: "website",
  },
};

const inquiryTypes = [
  {
    icon: "💬",
    title: "ご質問・ご意見",
    text: "サイトの使い方、コンテンツへのご意見、ご要望など。",
  },
  {
    icon: "📝",
    title: "掲載内容について",
    text: "掲載情報の誤り、修正依頼、削除依頼など。",
  },
  {
    icon: "🎬",
    title: "動画・権利関係",
    text: "動画、レース映像、画像、音声、著作権に関するご連絡。",
  },
  {
    icon: "🤝",
    title: "広告・お仕事",
    text: "広告掲載、タイアップ、制作、取材などのご相談。",
  },
];

const faqItems = [
  {
    question: "予想や舟券について個別に相談できますか？",
    answer:
      "個別レースの買い目指定や、的中・利益を保証するご相談には対応していません。公開中の予想情報を参考情報としてご利用ください。",
  },
  {
    question: "掲載内容の修正を依頼したいです",
    answer:
      "対象ページのURL、修正が必要な箇所、正しい内容をフォームにご記入ください。確認できる資料がある場合は、その内容もお知らせください。",
  },
  {
    question: "返信までどのくらいかかりますか？",
    answer:
      "内容を確認したうえで順次対応します。お問い合わせの内容によっては、返信まで数日かかる場合や、個別に返信できない場合があります。",
  },
];

export default function ContactPage() {
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
          ✉️
        </div>
        <span>CONTACT</span>
        <h1>お問い合わせ</h1>
        <p>
          ご質問、ご意見、掲載内容や権利関係など、
          <br className={styles.mobileBreak} />
          BoatStrikersへのご連絡はこちらからお送りください。
        </p>
      </section>

      <section className={styles.intro}>
        <div className={styles.introIcon} aria-hidden="true">
          ⚓
        </div>
        <div>
          <h2>お問い合わせの前に</h2>
          <p>
            内容を確認しやすくするため、対象ページがある場合はURLを、
            動画に関するご連絡の場合は動画タイトルやURLをご記入ください。
          </p>
        </div>
      </section>

      <section className={styles.typeSection}>
        <div className={styles.sectionHeading}>
          <span>INQUIRY TYPE</span>
          <h2>このようなお問い合わせを受け付けています</h2>
        </div>

        <div className={styles.typeGrid}>
          {inquiryTypes.map((item) => (
            <div key={item.title} className={styles.typeCard}>
              <span aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.formHeading}>
          <span>CONTACT FORM</span>
          <h2>お問い合わせフォーム</h2>
          <p>
            必須項目をご入力のうえ、内容をご確認して送信してください。
          </p>
        </div>

        <ContactForm />
      </section>

      <section className={styles.lineSection}>
        <div className={styles.lineIcon} aria-hidden="true">
          LINE
        </div>

        <div>
          <span>OFFICIAL LINE</span>
          <h2>公式LINEからのお知らせ</h2>
          <p>
            前日版・直前版などの配信情報は、BoatStrikers公式LINEでご案内しています。
            お問い合わせ内容によっては、フォームからのご連絡をお願いする場合があります。
          </p>
        </div>

        <a
          href="https://lin.ee/Pf3FEEQ"
          className={styles.lineCta}
          target="_blank"
          rel="noopener noreferrer"
        >
          公式LINEを開く
        </a>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionHeading}>
          <span>FAQ</span>
          <h2>よくあるお問い合わせ</h2>
        </div>

        <div className={styles.faqList}>
          {faqItems.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>
                <span>Q</span>
                {item.question}
              </summary>
              <div>
                <span>A</span>
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.noticeSection}>
        <h2>お問い合わせに関する注意事項</h2>
        <ul>
          <li>営業・勧誘目的の内容には返信しない場合があります。</li>
          <li>返信内容の無断転載・公開はご遠慮ください。</li>
          <li>緊急のご連絡には対応できません。</li>
          <li>入力された情報は、お問い合わせ対応の目的で利用します。</li>
        </ul>

        <p>
          個人情報の取り扱いについては、
          <Link href="/privacy">プライバシーポリシー</Link>
          をご確認ください。
        </p>
      </section>

      

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

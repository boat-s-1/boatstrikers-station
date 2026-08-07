import Image from "next/image";
import Link from "next/link";
import styles from "./about.module.css";

export const metadata = {
  title: "BoatStrikersについて｜BoatStrikers",
  description:
    "BoatStrikersは、出走表、展示情報、キャラクター予想、初心者講座、漫画、ラジオ、全国24場攻略を楽しめるボートレース情報サイトです。",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "BoatStrikersについて",
    description:
      "ボートレースを　もっと楽しくもっと分かりやすく。BoatStrikersのコンセプトやコンテンツをご紹介します。",
    url: "/about",
    type: "website",
  },
};

const members = [
  {
    name: "一果",
    role: "イン逃げ担当",
    description:
      "1号艇の信頼度やイン逃げの条件を中心に、初心者にも分かりやすくレースの見方を紹介します。",
    href: "/ichika",
    image: "/results/icons/ichika.jpg",
    color: "green",
    number: "1",
  },
  {
    name: "初音",
    role: "女子戦担当",
    description:
      "女子戦の選手情報、モーター、展示、レース傾向などを整理して、狙い方を楽しく紹介します。",
    href: "/hatsune",
    image: "/results/icons/hatsune.jpg",
    color: "purple",
    number: "4",
  },
  {
    name: "キイナ",
    role: "5アタマ担当",
    description:
      "5号艇が頭になる条件や高配当を狙うための考え方など、穴党向けの情報をお届けします。",
    href: "/kiina",
    image: "/results/icons/kiina.jpg",
    color: "yellow",
    number: "5",
  },
];

const contents = [
  {
    icon: "📋",
    title: "出走表・開催情報",
    text: "当日の開催場や出走表を、スマートフォンでも見やすく確認できます。",
    href: "/races",
  },
  {
    icon: "📰",
    title: "予想新聞",
    text: "一果・初音・キイナ、それぞれの得意分野に合わせた予想情報を配信します。",
    href: "/",
  },
  {
    icon: "📚",
    title: "一果図書館",
    text: "初心者講座、週刊誌、全国24場攻略など、学べるコンテンツをまとめています。",
    href: "/library",
  },
  {
    icon: "🎬",
    title: "漫画・動画",
    text: "『ふなけん研究部』や『教えて！一果センセー』を気軽に楽しめます。",
    href: "/comic",
  },
  {
    icon: "🎙️",
    title: "ラジオ",
    text: "3人のキャラクターがお届けするボート・ナイト・ニッポンを配信しています。",
    href: "/radio",
  },
  {
    icon: "🏁",
    title: "全国24場攻略",
    text: "各ボートレース場の特徴や水面傾向を、場ごとに分かりやすく紹介します。",
    href: "/library/stadiums",
  },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="BoatStrikers ホーム">
          BOAT
          <br />
          <span>STRIKERS</span>
        </Link>

        <a
          className={styles.lineButton}
          href="https://lin.ee/Pf3FEEQ"
          target="_blank"
          rel="noopener noreferrer"
        >
          LINE登録
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>ABOUT BOATSTRIKERS</span>
          <h1>BoatStrikersについて</h1>
          <p className={styles.heroCopy}>
            ボートレースをもっと
            <br className={styles.mobileBreak} />
            楽しくもっと分かりやすく
          </p>

          <p className={styles.heroDescription}>
            予想だけではなく、学ぶ・見る・聴くまで。
            <br />
            3人のキャラクターと一緒にボートレースを楽しむ情報サイトです。
          </p>
        </div>

        <div className={styles.heroImageWrap}>
          <Image
            src="/hero.jpg"
            alt="一果・初音・キイナのBoatStrikersメンバー"
            width={1536}
            height={864}
            priority
            className={styles.heroImage}
          />
        </div>
      </section>

      <section className={styles.introSection}>
        <div className={styles.sectionHeading}>
          <span>OUR CONCEPT</span>
          <h2>BoatStrikersが目指すこと</h2>
        </div>

        <div className={styles.introCard}>
          <p>
            BoatStrikersは、ボートレースを初めて見る方にも、
            すでに舟券を楽しんでいる方にも、
            「分かりやすく、見やすく、続けて楽しめる」情報を届けることを目指しています。
          </p>

          <p>
            一果のイン逃げ予想、初音の女子戦攻略、
            キイナの5号艇・穴狙い情報を中心に、
            出走表、展示情報、予想新聞、全国24場攻略、漫画、動画、ラジオなどを配信しています。
          </p>

          <div className={styles.messageBox}>
            <strong>「なんとなく買う」から「考えて楽しむ」へ</strong>
            <span>
              選手・モーター・スタート・展示・水面状況など、
              レースを見るためのヒントを親しみやすくお届けします。
            </span>
          </div>
        </div>
      </section>

      <section className={styles.membersSection}>
        <div className={styles.sectionHeading}>
          <span>OUR MEMBERS</span>
          <h2>メンバー</h2>
          <p>それぞれの得意分野から、ボートレースの楽しみ方をご案内します。</p>
        </div>

        <div className={styles.memberGrid}>
          {members.map((member) => (
            <Link
              key={member.name}
              href={member.href}
              className={`${styles.memberCard} ${styles[`memberCard_${member.color}`]}`}
            >
              <div className={styles.memberTop}>
                <span className={styles.boatNumber}>{member.number}</span>
                <Image
                  src={member.image}
                  alt={`${member.name}のアイコン`}
                  width={104}
                  height={104}
                  className={styles.memberImage}
                />
              </div>

              <div className={styles.memberBody}>
                <div className={styles.memberNameRow}>
                  <h3>{member.name}</h3>
                  <span>{member.role}</span>
                </div>

                <p>{member.description}</p>
                <b>{member.name}の部屋を見る ›</b>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.contentsSection}>
        <div className={styles.sectionHeading}>
          <span>CONTENTS</span>
          <h2>BoatStrikersで楽しめること</h2>
        </div>

        <div className={styles.contentsGrid}>
          {contents.map((content) => (
            <Link key={content.title} href={content.href} className={styles.contentCard}>
              <span className={styles.contentIcon} aria-hidden="true">
                {content.icon}
              </span>

              <div>
                <h3>{content.title}</h3>
                <p>{content.text}</p>
                <b>詳しく見る ›</b>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.policySection}>
        <div className={styles.policyCard}>
          <div className={styles.policyIcon} aria-hidden="true">
            ⚓
          </div>

          <div>
            <span className={styles.policyLabel}>OUR POLICY</span>
            <h2>安心して楽しむために</h2>

            <p>
              当サイトに掲載している予想、データ、解説などは、
              的中や利益を保証するものではありません。
              情報は舟券購入を強制または推奨するものではなく、
              ボートレースを楽しむための参考情報として掲載しています。
            </p>

            <p>
              舟券の購入は20歳になってから。
              購入される場合は、無理のない範囲でお楽しみください。
            </p>
          </div>
        </div>
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

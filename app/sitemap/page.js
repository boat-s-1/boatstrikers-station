import Link from "next/link";
import styles from "./sitemap.module.css";

export const metadata = {
  title: "サイトマップ｜BoatStrikers",
  description:
    "BoatStrikersの主要コンテンツを一覧でご案内します。出走表、キャラクター予想、図書館、全国24場攻略、漫画、ラジオなど、目的のページをこちらから探せます。",
  alternates: {
    canonical: "/sitemap",
  },
  openGraph: {
    title: "サイトマップ｜BoatStrikers",
    description:
      "BoatStrikersの主要ページを、目的別に分かりやすくご案内します。",
    url: "/sitemap",
    type: "website",
  },
};

const sitemapGroups = [
  {
    title: "予想・レース情報",
    english: "RACE & FORECAST",
    icon: "🏁",
    color: "blue",
    links: [
      {
        title: "ホーム",
        description: "今日の予定、開催場、最新情報などをまとめて確認できます。",
        href: "/",
      },
      {
        title: "本日の出走表",
        description: "当日の開催場と各レースの出走情報を確認できます。",
        href: "/races",
      },
      {
        title: "一果のイン逃げ予想",
        description: "1号艇とイン逃げを中心に、レースの狙い方を紹介します。",
        href: "/ichika",
      },
      {
        title: "初音の女子戦攻略",
        description: "女子戦の選手情報や展示、レース傾向を紹介します。",
        href: "/hatsune",
      },
      {
        title: "キイナの5号艇予想",
        description: "5号艇が頭になる条件や穴狙い情報を紹介します。",
        href: "/kiina",
      },
      {
        title: "BoatStrikers Challenge",
        description: "BoatStrikersの予想・分析コンテンツを確認できます。",
        href: "/bsc2",
      },
    ],
  },
  {
    title: "学ぶ・調べる",
    english: "LEARN & RESEARCH",
    icon: "📚",
    color: "pink",
    links: [
      {
        title: "一果図書館",
        description: "攻略本、週刊誌、講座、バックナンバーをまとめています。",
        href: "/library",
      },
      {
        title: "全国24場攻略",
        description: "全国24ボートレース場の特徴や水面傾向を場ごとに紹介します。",
        href: "/library/stadiums",
      },
      {
        title: "一果のイン逃げ鉄板ゼミ",
        description: "イン逃げを見極めるための知識を学べます。",
        href: "/library/ichika-seminar",
      },
      {
        title: "初音の女子戦攻略マガジン",
        description: "女子戦を楽しむための情報をまとめています。",
        href: "/library/hatsune-seminar",
      },
      {
        title: "キイナの穴党塾",
        description: "高配当や穴狙いの考え方を学べます。",
        href: "/library/kiina-seminar",
      },
      {
        title: "教えて！一果センセー",
        description: "ボートレースの基本を動画で分かりやすく解説します。",
        href: "/ichika-sensei",
      },
    ],
  },
  {
    title: "見る・聴く",
    english: "WATCH & LISTEN",
    icon: "🎬",
    color: "purple",
    links: [
      {
        title: "ふなけん研究部",
        description: "学校を舞台にしたボートレース漫画・ショート動画です。",
        href: "/comic",
      },
      {
        title: "ボート・ナイト・ニッポン",
        description: "一果・初音・キイナが届けるラジオ番組です。",
        href: "/radio",
      },
      {
        title: "番組表",
        description: "動画、ラジオ、noteなどの配信予定を確認できます。",
        href: "/program",
      },
    ],
  },
  {
    title: "サイト案内",
    english: "INFORMATION",
    icon: "⚓",
    color: "green",
    links: [
      {
        title: "BoatStrikersについて",
        description: "サイトのコンセプトや3人の担当メンバーをご紹介します。",
        href: "/about",
      },
      {
        title: "サイトマップ",
        description: "BoatStrikersの主要ページを一覧でご案内します。",
        href: "/sitemap",
      },
      {
        title: "お問い合わせ",
        description: "ご質問やご連絡はこちらからお送りください。",
        href: "/contact",
      },
      {
        title: "プライバシーポリシー",
        description: "個人情報やアクセス情報の取り扱いについてご案内します。",
        href: "/privacy",
      },
      {
        title: "利用規約",
        description: "BoatStrikersをご利用いただく際の規約です。",
        href: "/terms",
      },
      {
        title: "免責事項",
        description: "予想情報や掲載データに関する注意事項です。",
        href: "/disclaimer",
      },
    ],
  },
];

export default function SitemapPage() {
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
        <div className={styles.heroDecoration} aria-hidden="true">
          <span>★</span>
          <span>⚓</span>
          <span>★</span>
        </div>

        <span className={styles.eyebrow}>SITE MAP</span>
        <h1>サイトマップ</h1>
        <p>
          BoatStrikersのコンテンツを、
          <br className={styles.mobileBreak} />
          目的別に分かりやすくご案内します。
        </p>
      </section>

      <nav className={styles.quickNav} aria-label="サイトマップ内メニュー">
        {sitemapGroups.map((group, index) => (
          <a key={group.title} href={`#group-${index}`}>
            <span aria-hidden="true">{group.icon}</span>
            {group.title}
          </a>
        ))}
      </nav>

      <div className={styles.groupList}>
        {sitemapGroups.map((group, groupIndex) => (
          <section
            id={`group-${groupIndex}`}
            key={group.title}
            className={`${styles.groupSection} ${styles[`groupSection_${group.color}`]}`}
          >
            <div className={styles.groupHeading}>
              <div className={styles.groupIcon} aria-hidden="true">
                {group.icon}
              </div>

              <div>
                <span>{group.english}</span>
                <h2>{group.title}</h2>
              </div>
            </div>

            <div className={styles.linkGrid}>
              {group.links.map((link) => (
                <Link key={link.title} href={link.href} className={styles.linkCard}>
                  <div className={styles.linkCardText}>
                    <h3>{link.title}</h3>
                    <p>{link.description}</p>
                  </div>

                  <span className={styles.arrow} aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className={styles.guideSection}>
        <div className={styles.guideCard}>
          <div className={styles.guideIcon} aria-hidden="true">
            🔍
          </div>

          <div>
            <span>迷ったときは</span>
            <h2>まずはトップページをご覧ください</h2>
            <p>
              今日の予定、開催場、最新の予想新聞、メンバー紹介など、
              BoatStrikersの最新情報をまとめて確認できます。
            </p>
          </div>

          <Link href="/" className={styles.homeButton}>
            トップページへ
          </Link>
        </div>
      </section>

      <section className={styles.noticeSection}>
        <h2>ご利用にあたって</h2>
        <p>
          当サイトに掲載している予想、データ、解説などは、
          的中や利益を保証するものではありません。
          舟券の購入は20歳になってから、無理のない範囲でお楽しみください。
        </p>
      </section>

      <footer className={styles.footer}>
        <nav aria-label="フッター">
          <Link href="/">ホーム</Link>
          <Link href="/about">BoatStrikersについて</Link>
          <Link href="/library">図書館</Link>
          <Link href="/radio">ラジオ</Link>
        </nav>

        <p>© BoatStrikers</p>
      </footer>
    </main>
  );
}

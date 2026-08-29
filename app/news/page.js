import Link from "next/link";
import { getHatsuneNews, formatHatsuneNewsDate } from "../hatsune/newsData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers NEWS | ボートレース最新ニュース",
  description: "女子戦、優勝、SG・G1、モーター、明日の注目まで。BoatStrikersがボートレースの最新ニュースを見やすくまとめます。",
};

const TABS = [
  { key: "all", label: "主要" },
  { key: "women", label: "女子" },
  { key: "grade", label: "SG・G1" },
  { key: "win", label: "優勝" },
  { key: "motor", label: "モーター" },
  { key: "tomorrow", label: "明日の注目" },
];

function textOf(item) {
  return `${item?.title || ""} ${item?.summary || ""} ${item?.category || ""}`;
}

function bucket(item) {
  const t = textOf(item);
  const c = String(item?.category || "");
  if (c === "motor" || /モーター|機力|展示|2連対率|勝率/.test(t)) return "motor";
  if (c === "tomorrow" || /明日|翌日|あす/.test(t)) return "tomorrow";
  if (c === "win" || /優勝|優出|V達成|初優勝/.test(t)) return "win";
  if (c === "grade" || /SG|G1|GⅠ|G2|GⅡ|グランプリ|周年/.test(t)) return "grade";
  if (["women", "suijinsai"].includes(c) || /女子|ヴィーナス|オールレディース|レディース/.test(t)) return "women";
  return "all";
}

function categoryLabel(item) {
  return {
    women: "女子",
    grade: "SG・G1",
    win: "優勝",
    motor: "モーター",
    tomorrow: "明日の注目",
    all: "ニュース",
  }[bucket(item)];
}

function matches(item, category, q) {
  const categoryOk = category === "all" || bucket(item) === category;
  const keyword = String(q || "").trim().toLowerCase();
  if (!keyword) return categoryOk;
  return categoryOk && textOf(item).toLowerCase().includes(keyword);
}

function isNew(item) {
  const published = new Date(item?.published_at || 0).getTime();
  if (!published) return false;
  return Date.now() - published < 24 * 60 * 60 * 1000;
}

function categoryClass(item) {
  return styles[`cat_${bucket(item)}`] || styles.cat_all;
}

export default async function NewsTopPage({ searchParams }) {
  const params = await searchParams;
  const category = TABS.some((x) => x.key === params?.category) ? params.category : "all";
  const q = String(params?.q || "");
  const allNews = await getHatsuneNews({ limit: 100, category: "all" });
  const news = allNews.filter((item) => matches(item, category, q));
  const featured = news.find((item) => item.is_featured) || news[0] || null;
  const latest = news.filter((item) => item.id !== featured?.id).slice(0, 14);
  const women = news.filter((item) => bucket(item) === "women").slice(0, 6);
  const grades = news.filter((item) => bucket(item) === "grade").slice(0, 6);
  const motors = news.filter((item) => bucket(item) === "motor").slice(0, 6);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS MEDIA</span>
            <h1>BoatStrikers NEWS</h1>
            <p>ボートレースの最新情報を、見出しで素早くチェック。</p>
          </div>
          <Link href="/" className={styles.homeLink}>TOP</Link>
        </header>

        <form className={styles.search} method="get">
          <input type="hidden" name="category" value={category} />
          <span>⌕</span>
          <input name="q" defaultValue={q} placeholder="選手名・場名・キーワードで検索" />
          <button type="submit">検索</button>
        </form>

        <nav className={styles.tabs} aria-label="ニュースカテゴリ">
          {TABS.map((tab) => {
            const href = `/news?category=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            return <Link key={tab.key} href={href} className={category === tab.key ? styles.activeTab : ""}>{tab.label}</Link>;
          })}
        </nav>

        {featured && (
          <section className={styles.breaking}>
            <div className={styles.breakingLabel}>注目</div>
            <Link href={`/news/${featured.id}`} className={styles.breakingLink}>
              <div className={styles.breakingMeta}>
                <span className={`${styles.categoryBadge} ${categoryClass(featured)}`}>{categoryLabel(featured)}</span>
                <time>{formatHatsuneNewsDate(featured.published_at)}</time>
                {isNew(featured) && <span className={styles.newBadge}>NEW</span>}
              </div>
              <h2>{featured.title}</h2>
              {featured.summary && <p>{featured.summary}</p>}
            </Link>
          </section>
        )}

        <section className={styles.latestSection}>
          <div className={styles.sectionHeading}>
            <h2>最新ニュース</h2>
            <span>{news.length}件</span>
          </div>
          <div className={styles.headlineList}>
            {latest.map((item) => (
              <Link key={item.id} href={`/news/${item.id}`} className={styles.headlineRow}>
                <time>{formatHatsuneNewsDate(item.published_at)}</time>
                <span className={`${styles.categoryBadge} ${categoryClass(item)}`}>{categoryLabel(item)}</span>
                <strong>{item.title}</strong>
                {isNew(item) && <span className={styles.newBadge}>NEW</span>}
                <span className={styles.arrow}>›</span>
              </Link>
            ))}
          </div>
        </section>

        {news.length === 0 && <div className={styles.empty}>該当するニュースはありません。</div>}

        {category === "all" && (
          <>
            {women.length > 0 && <HeadlineSection title="女子ボートNEWS" emoji="🌸" items={women} />}
            {grades.length > 0 && <HeadlineSection title="SG・G1" emoji="🚤" items={grades} />}
            {motors.length > 0 && <HeadlineSection title="モーター・機力" emoji="⚙️" items={motors} />}
          </>
        )}

        <section className={styles.cta}>
          <div>
            <span>BOATSTRIKERS AI</span>
            <strong>今日のレースもチェック</strong>
          </div>
          <Link href="/races">出走表・AI予想を見る →</Link>
        </section>
      </div>
    </main>
  );
}

function HeadlineSection({ title, emoji, items }) {
  return (
    <section className={styles.topicSection}>
      <div className={styles.sectionHeading}>
        <h2>{emoji} {title}</h2>
      </div>
      <div className={styles.topicList}>
        {items.map((item) => (
          <Link href={`/news/${item.id}`} key={item.id} className={styles.topicRow}>
            <span className={`${styles.categoryDot} ${categoryClass(item)}`} />
            <strong>{item.title}</strong>
            <time>{formatHatsuneNewsDate(item.published_at)}</time>
            <span className={styles.arrow}>›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

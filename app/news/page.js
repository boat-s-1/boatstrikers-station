import Link from "next/link";
import { formatHatsuneNewsDate } from "../hatsune/newsData";
import { NEWS_TABS, formatNewsShortDate, isNewNews, newsBucketLabel, normalizeNewsTab } from "../../lib/newsTaxonomy";
import { getNewsListing, parseNewsPage } from "./newsQueries";
import NewsHeadlineRow, { categoryClass } from "./NewsHeadlineRow";
import NewsLoadMore from "./NewsLoadMore";
import { newsListHref } from "./newsLinks";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers NEWS | ボートレース最新ニュース",
  description: "BoatStrikersオリジナル、女子、グレードレース、注目レース、結果、選手情報、公式YouTubeまで。ボートレース情報を目的別にチェック。",
};

const SECTION_TITLES = { women: "女子戦＆女子ニュース", focus: "注目レース", result: "今日の結果" };

export default async function NewsTopPage({ searchParams }) {
  const params = await searchParams;
  const category = normalizeNewsTab(params?.category);
  const q = String(params?.q || "").slice(0, 200);
  const page = parseNewsPage(params?.page);
  const showSections = category === "all" && !q.trim() && page === 1;
  const listing = await getNewsListing({ category, q, page, includeSections: showSections });
  const { featured, items, sections, total, totalPages } = listing;
  const now = Date.now();
  const sectionTitle = category === "all" ? "最新ニュース" : NEWS_TABS.find((x) => x.key === category)?.label;

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><div><span className={styles.eyebrow}>BOATSTRIKERS MEDIA</span><h1>BoatStrikers NEWS</h1><p>ボートレースの最新情報を、見出しで素早くチェック。</p></div><Link href="/" className={styles.homeLink}>TOP</Link></header>
    <form className={styles.search} method="get"><input type="hidden" name="category" value={category} /><span>⌕</span><input name="q" defaultValue={q} placeholder="選手名・場名・キーワードで検索" /><button type="submit">検索</button></form>
    <nav className={styles.tabs}>{NEWS_TABS.map((tab) => { const href = tab.href || newsListHref({ category: tab.key, q }); return <Link key={tab.key} href={href} className={!tab.href && category === tab.key ? styles.activeTab : ""}>{tab.label}</Link>; })}</nav>
    {featured && <section className={styles.breaking}><div className={styles.breakingLabel}>注目</div><Link href={`/news/${featured.id}`} className={styles.breakingLink}><div className={styles.breakingMeta}><span className={`${styles.categoryBadge} ${categoryClass(featured.bucket)}`}>{newsBucketLabel(featured.bucket)}</span><time>{formatHatsuneNewsDate(featured.publishedAt)}</time>{isNewNews(featured.publishedAt, now) && <span className={styles.newBadge}>NEW</span>}</div><h2>{featured.headline}</h2>{featured.summary && <p>{featured.summary}</p>}</Link></section>}
    <section className={styles.latestSection}>
      <div className={styles.sectionHeading}><h2>{sectionTitle}</h2><span>{q.trim() ? `「${q.trim()}」 ` : ""}{total}件{page > 1 ? `・${page}ページ目` : ""}</span></div>
      {items.length > 0 && <div className={styles.headlineList}>{items.map((item) => <NewsHeadlineRow key={item.id} item={item} now={now} />)}</div>}
      <NewsLoadMore key={`${category}:${q}:${page}`} category={category} q={q} initialPage={page} totalPages={totalPages} />
    </section>
    {listing.searchFailed && <div className={styles.empty}>検索に失敗しました。時間をおいて再度お試しください。</div>}
    {!listing.searchFailed && total === 0 && <div className={styles.empty}>該当するニュースはありません。</div>}
    {total > 0 && !featured && items.length === 0 && <div className={styles.empty}>このページに記事はありません。<Link href={newsListHref({ category, q })}>1ページ目へ</Link></div>}
    {showSections && ["women", "focus", "result"].map((key) => sections[key]?.length > 0 && <HeadlineSection key={key} title={SECTION_TITLES[key]} items={sections[key]} href={newsListHref({ category: key })} />)}
    <section className={styles.cta}><div><span>BOATSTRIKERS AI</span><strong>今日のレースもチェック</strong></div><Link href="/races">出走表・AI予想を見る →</Link></section>
  </div></main>;
}

function HeadlineSection({ title, items, href }) {
  return <section className={styles.topicSection}><div className={styles.sectionHeading}><h2>{title}</h2><Link href={href} className={styles.sectionMore}>すべて見る ›</Link></div><div className={styles.topicList}>{items.map((item) => <Link href={`/news/${item.id}`} key={item.id} className={styles.topicRow}><span className={`${styles.categoryDot} ${categoryClass(item.bucket)}`} /><strong>{item.headline}</strong><time dateTime={item.publishedAt || undefined}>{formatNewsShortDate(item.publishedAt)}</time><span className={styles.arrow}>›</span></Link>)}</div></section>;
}


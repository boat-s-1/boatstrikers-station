import Link from "next/link";
import { getHatsuneNews, formatHatsuneNewsDate } from "../hatsune/newsData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers NEWS | ボートレース最新ニュース",
  description: "BoatStrikersオリジナル、女子、グレードレース、注目レース、結果、選手情報、公式YouTubeまで。ボートレース情報を目的別にチェック。",
};

const TABS = [
  { key: "all", label: "メイン" },
  { key: "bs", label: "BS記事" },
  { key: "women", label: "女子" },
  { key: "grade", label: "SG・G1" },
  { key: "focus", label: "注目レース" },
  { key: "result", label: "今日の結果" },
  { key: "racer", label: "選手情報" },
  { key: "media", label: "メディア", href: "/news/media" },
];

function textOf(item) {
  return `${item?.list_headline || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.category || ""} ${item?.source_name || ""}`;
}
function headlineOf(item) { return String(item?.list_headline || item?.title || "ニュース").trim(); }

function bucket(item) {
  const t = textOf(item);
  const c = String(item?.category || "");
  const source = String(item?.source_name || "");
  if (/BoatStrikers|AI編集部|BSオリジナル/i.test(source) || /BoatStrikers独自|独自分析|独自記事/.test(t)) return "bs";
  if (["result", "win"].includes(c) || /結果|優勝|優出|V達成|初優勝|レース後|払戻|着順/.test(t)) return "result";
  if (["motor", "tomorrow"].includes(c) || /明日|翌日|あす|注目レース|高モーター|モーター|機力|展示|2連対率|優勝戦|初日/.test(t)) return "focus";
  if (c === "grade" || /SG|G1|GⅠ|G2|GⅡ|グランプリ|周年|グレードレース/.test(t)) return "grade";
  if (["women"].includes(c) || /女子|ヴィーナス|オールレディース|レディース|クイーンズ/.test(t)) return "women";
  if (["suijinsai"].includes(c) || /選手|レーサー|水神祭|昇級|A1|A2|インタビュー|トークショー|結婚|引退|復帰|記録達成/.test(t)) return "racer";
  return "all";
}

function categoryLabel(item) {
  return { bs:"BS記事", women:"女子", grade:"SG・G1", focus:"注目", result:"結果", racer:"選手", all:"ニュース" }[bucket(item)];
}
function matches(item, category, q) {
  const categoryOk = category === "all" || bucket(item) === category;
  const keyword = String(q || "").trim().toLowerCase();
  return categoryOk && (!keyword || textOf(item).toLowerCase().includes(keyword));
}
function isNew(item) {
  const published = new Date(item?.published_at || 0).getTime();
  return !!published && Date.now() - published < 24 * 60 * 60 * 1000;
}
function categoryClass(item) { return styles[`cat_${bucket(item)}`] || styles.cat_all; }

export default async function NewsTopPage({ searchParams }) {
  const params = await searchParams;
  const category = TABS.some((x) => !x.href && x.key === params?.category) ? params.category : "all";
  const q = String(params?.q || "");
  const allNews = await getHatsuneNews({ limit: 100, category: "all" });
  const news = allNews.filter((item) => matches(item, category, q));
  const featured = news.find((item) => item.is_featured) || news[0] || null;
  const latest = news.filter((item) => item.id !== featured?.id).slice(0, 14);
  const women = allNews.filter((item) => bucket(item) === "women").slice(0, 6);
  const focus = allNews.filter((item) => bucket(item) === "focus").slice(0, 6);
  const results = allNews.filter((item) => bucket(item) === "result").slice(0, 6);

  return (
    <main className={styles.page}><div className={styles.shell}>
      <header className={styles.header}><div><span className={styles.eyebrow}>BOATSTRIKERS MEDIA</span><h1>BoatStrikers NEWS</h1><p>ボートレースの最新情報を、見出しで素早くチェック。</p></div><Link href="/" className={styles.homeLink}>TOP</Link></header>
      <form className={styles.search} method="get"><input type="hidden" name="category" value={category} /><span>⌕</span><input name="q" defaultValue={q} placeholder="選手名・場名・キーワードで検索" /><button type="submit">検索</button></form>
      <nav className={styles.tabs} aria-label="ニュースカテゴリ">{TABS.map((tab) => { const href = tab.href || `/news?category=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`; return <Link key={tab.key} href={href} className={!tab.href && category === tab.key ? styles.activeTab : ""}>{tab.label}</Link>; })}</nav>
      {featured && <section className={styles.breaking}><div className={styles.breakingLabel}>注目</div><Link href={`/news/${featured.id}`} className={styles.breakingLink}><div className={styles.breakingMeta}><span className={`${styles.categoryBadge} ${categoryClass(featured)}`}>{categoryLabel(featured)}</span><time>{formatHatsuneNewsDate(featured.published_at)}</time>{isNew(featured) && <span className={styles.newBadge}>NEW</span>}</div><h2>{headlineOf(featured)}</h2>{featured.summary && <p>{featured.summary}</p>}</Link></section>}
      <section className={styles.latestSection}><div className={styles.sectionHeading}><h2>{category === "all" ? "最新ニュース" : TABS.find((x)=>x.key===category)?.label}</h2><span>{news.length}件</span></div><div className={styles.headlineList}>{latest.map((item) => <Link key={item.id} href={`/news/${item.id}`} className={styles.headlineRow}><time>{formatHatsuneNewsDate(item.published_at)}</time><span className={`${styles.categoryBadge} ${categoryClass(item)}`}>{categoryLabel(item)}</span><strong>{headlineOf(item)}</strong>{isNew(item) && <span className={styles.newBadge}>NEW</span>}<span className={styles.arrow}>›</span></Link>)}</div></section>
      {news.length === 0 && <div className={styles.empty}>該当するニュースはありません。</div>}
      {category === "all" && <>{women.length > 0 && <HeadlineSection title="女子戦＆女子ニュース" items={women} />}{focus.length > 0 && <HeadlineSection title="注目レース" items={focus} />}{results.length > 0 && <HeadlineSection title="今日の結果" items={results} />}</>}
      <section className={styles.cta}><div><span>BOATSTRIKERS AI</span><strong>今日のレースもチェック</strong></div><Link href="/races">出走表・AI予想を見る →</Link></section>
    </div></main>
  );
}

function HeadlineSection({ title, items }) {
  return <section className={styles.topicSection}><div className={styles.sectionHeading}><h2>{title}</h2></div><div className={styles.topicList}>{items.map((item) => <Link href={`/news/${item.id}`} key={item.id} className={styles.topicRow}><span className={`${styles.categoryDot} ${categoryClass(item)}`} /><strong>{headlineOf(item)}</strong><time>{formatHatsuneNewsDate(item.published_at)}</time><span className={styles.arrow}>›</span></Link>)}</div></section>;
}

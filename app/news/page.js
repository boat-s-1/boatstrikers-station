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
  { key: "all", label: "メイン" }, { key: "bs", label: "BS記事" }, { key: "women", label: "女子" }, { key: "grade", label: "SG・G1" },
  { key: "focus", label: "注目レース" }, { key: "result", label: "今日の結果" }, { key: "racer", label: "選手情報" }, { key: "media", label: "メディア", href: "/news/media" },
];

function textOf(item) {
  return `${item?.list_headline || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.category || ""} ${item?.source_name || ""}`;
}
function headlineOf(item) { return String(item?.list_headline || item?.title || "ニュース").trim(); }

const GRADE_RE = /(?:^|[\s・／/【\[(（])(?:SG|G\s*[123]|GⅠ|GⅡ|GⅢ|GI|GII|GIII)(?:$|[\s・／/】\])）])|グランプリ|チャレンジカップ|ボートレース(?:クラシック|オールスター|メモリアル|ダービー)|グランドチャンピオン|オーシャンカップ|ヤングダービー|周年記念|周年競走|地区選手権|グレードレース/i;
const RESULT_RE = /結果を更新|レース結果|払戻|着順|確定|優勝(?:した|を飾|決定|達成)|優出決定|V達成|初優勝|レース後|決着|万舟|高配当/;
const RACER_RE = /水神祭|昇級|A1昇格|A2昇格|級別|インタビュー|トークショー|結婚|引退|復帰|欠場|追加斡旋|斡旋|登録|記録達成|選手特集|レーサー特集|デビュー|連勝|予選\d*位通過|予選トップ|前走地|近況|当地初|通算\d+勝|節目|フライング休み|復帰戦|選手が|レーサーが/;
const WOMEN_RE = /女子戦|女子レーサー|ヴィーナス|オールレディース|レディース|クイーンズ|女子ボート/;
const FOCUS_RE = /明日|翌日|あす|注目レース|高モーター|モーター|機力|展示|2連対率|優勝戦前|開催初日|初日注目|ドリーム戦|予選注目|好枠|絶好枠/;

function bucket(item) {
  const t = textOf(item);
  const c = String(item?.category || "").toLowerCase();
  const source = String(item?.source_name || "");

  // 具体的なテーマを先に判定する。女子記事でもSG/G1や選手ニュースなら専用タブへ振り分ける。
  if (c === "grade" || GRADE_RE.test(t)) return "grade";
  if (["result", "win"].includes(c) || RESULT_RE.test(t)) return "result";
  if (c === "suijinsai" || RACER_RE.test(t)) return "racer";
  if (["motor", "tomorrow"].includes(c) || FOCUS_RE.test(t)) return "focus";
  if (c === "women" || WOMEN_RE.test(t)) return "women";

  if (/BoatStrikers AI編集部|BoatStrikers編集部|BSオリジナル/i.test(source) || /BoatStrikers独自|独自分析|独自記事|AI分析|データ研究/.test(t)) return "bs";
  return "all";
}

function categoryLabel(item) { return { bs: "BS記事", women: "女子", grade: "SG・G1", focus: "注目", result: "結果", racer: "選手", all: "ニュース" }[bucket(item)]; }
function matches(item, category, q) { const ok = category === "all" || bucket(item) === category, k = String(q || "").trim().toLowerCase(); return ok && (!k || textOf(item).toLowerCase().includes(k)); }
function isNew(item) { const p = new Date(item?.published_at || 0).getTime(); return !!p && Date.now() - p < 86400000; }
function categoryClass(item) { return styles[`cat_${bucket(item)}`] || styles.cat_all; }
function shortDate(value) { const d = new Date(value); if (Number.isNaN(d.getTime())) return ""; return `${d.getMonth() + 1}/${d.getDate()}`; }
function ageHours(item) { const p = new Date(item?.published_at || 0).getTime(); return p ? Math.max(0, (Date.now() - p) / 3600000) : 9999; }

function featuredScore(item) {
  const age = ageHours(item);
  const recency = age <= 6 ? 60 : age <= 12 ? 52 : age <= 24 ? 44 : age <= 36 ? 34 : age <= 48 ? 24 : age <= 72 ? 12 : 0;
  const typeWeight = { bs: 18, grade: 16, focus: 14, women: 12, racer: 9, result: 7, all: 5 }[bucket(item)] || 0;
  const manualFeatured = item?.is_featured && age <= 72 ? 28 : 0;
  const priority = Math.max(0, Math.min(10, Number(item?.priority || 0))) * 3;
  const headlineBonus = item?.list_headline ? 4 : 0;
  return recency + typeWeight + manualFeatured + priority + headlineBonus;
}

function selectFeatured(items) {
  if (!items.length) return null;
  const within36h = items.filter((item) => ageHours(item) <= 36);
  const pool = within36h.length ? within36h : items.filter((item) => ageHours(item) <= 72);
  const candidates = pool.length ? pool : items.slice(0, 10);
  return [...candidates].sort((a, b) => featuredScore(b) - featuredScore(a) || new Date(b.published_at || 0) - new Date(a.published_at || 0))[0] || null;
}

export default async function NewsTopPage({ searchParams }) {
  const params = await searchParams;
  const category = TABS.some((x) => !x.href && x.key === params?.category) ? params.category : "all";
  const q = String(params?.q || "");
  const allNews = await getHatsuneNews({ limit: 100, category: "all" });
  const news = allNews.filter((i) => matches(i, category, q));
  const featured = selectFeatured(news);
  const latest = news.filter((i) => i.id !== featured?.id).slice(0, 14);
  const women = allNews.filter((i) => bucket(i) === "women").slice(0, 6);
  const focus = allNews.filter((i) => bucket(i) === "focus").slice(0, 6);
  const results = allNews.filter((i) => bucket(i) === "result").slice(0, 6);

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><div><span className={styles.eyebrow}>BOATSTRIKERS MEDIA</span><h1>BoatStrikers NEWS</h1><p>ボートレースの最新情報を、見出しで素早くチェック。</p></div><Link href="/" className={styles.homeLink}>TOP</Link></header>
    <form className={styles.search} method="get"><input type="hidden" name="category" value={category} /><span>⌕</span><input name="q" defaultValue={q} placeholder="選手名・場名・キーワードで検索" /><button type="submit">検索</button></form>
    <nav className={styles.tabs}>{TABS.map((tab) => { const href = tab.href || `/news?category=${tab.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`; return <Link key={tab.key} href={href} className={!tab.href && category === tab.key ? styles.activeTab : ""}>{tab.label}</Link>; })}</nav>
    {featured && <section className={styles.breaking}><div className={styles.breakingLabel}>注目</div><Link href={`/news/${featured.id}`} className={styles.breakingLink}><div className={styles.breakingMeta}><span className={`${styles.categoryBadge} ${categoryClass(featured)}`}>{categoryLabel(featured)}</span><time>{formatHatsuneNewsDate(featured.published_at)}</time>{isNew(featured) && <span className={styles.newBadge}>NEW</span>}</div><h2>{headlineOf(featured)}</h2>{featured.summary && <p>{featured.summary}</p>}</Link></section>}
    <section className={styles.latestSection}><div className={styles.sectionHeading}><h2>{category === "all" ? "最新ニュース" : TABS.find((x) => x.key === category)?.label}</h2><span>{news.length}件</span></div><div className={styles.headlineList}>{latest.map((item) => <Link key={item.id} href={`/news/${item.id}`} className={styles.headlineRow}><time>{shortDate(item.published_at)}</time><strong>{headlineOf(item)}</strong><span className={styles.rowTags}>{isNew(item) && <span className={styles.newBadge}>NEW</span>}<span className={`${styles.categoryBadge} ${categoryClass(item)}`}>{categoryLabel(item)}</span></span><span className={styles.arrow}>›</span></Link>)}</div></section>
    {news.length === 0 && <div className={styles.empty}>該当するニュースはありません。</div>}
    {category === "all" && <>{women.length > 0 && <HeadlineSection title="女子戦＆女子ニュース" items={women} />}{focus.length > 0 && <HeadlineSection title="注目レース" items={focus} />}{results.length > 0 && <HeadlineSection title="今日の結果" items={results} />}</>}
    <section className={styles.cta}><div><span>BOATSTRIKERS AI</span><strong>今日のレースもチェック</strong></div><Link href="/races">出走表・AI予想を見る →</Link></section>
  </div></main>;
}

function HeadlineSection({ title, items }) {
  return <section className={styles.topicSection}><div className={styles.sectionHeading}><h2>{title}</h2></div><div className={styles.topicList}>{items.map((item) => <Link href={`/news/${item.id}`} key={item.id} className={styles.topicRow}><span className={`${styles.categoryDot} ${categoryClass(item)}`} /><strong>{headlineOf(item)}</strong><time>{shortDate(item.published_at)}</time><span className={styles.arrow}>›</span></Link>)}</div></section>;
}

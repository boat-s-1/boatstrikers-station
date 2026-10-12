import Link from "next/link";
import { notFound } from "next/navigation";
import theme from "../newsTheme.module.css";
import styles from "./detail.module.css";
import relatedStyles from "./related.module.css";
import {
  getHatsuneNewsById,
  getHatsuneNews,
  formatHatsuneNewsDate,
} from "../../hatsune/newsData";
import {
  NEWS_CHARACTERS,
  assignNewsCharacter,
  classifyNewsBucket,
  cleanNewsHeadline,
  describeNewsCharacterReason,
  isBsDataNews,
  newsBucketLabel,
  newsCharacterNote,
  toNewsListItem,
} from "../../../lib/newsTaxonomy";
import NewsHeadlineRow, { categoryClass } from "../NewsHeadlineRow";
import { NewsCharacterBust } from "../NewsCharacterFace";
import { newsListHref } from "../newsLinks";
import { getOfficialYoutubeUpdates } from "../media/mediaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);
  if (!item) return { title: "BoatStrikers NEWS", robots: { index: false, follow: true } };

  const summary = cleanSummary(item);
  const body = !isGenericCopy(item.article_body) ? String(item.article_body || "").replace(/\s+/g, " ").trim() : "";
  const hasEditorialValue =
    (String(item.source_type || "").toLowerCase() === "bs_data" && (summary.length >= 40 || body.length >= 80)) ||
    summary.length >= 80 ||
    body.length >= 180;

  return {
    title: `${item.title} | BoatStrikers NEWS`,
    description: summary || "BoatStrikersがボートレースの最新ニュースをわかりやすくまとめます。",
    alternates: { canonical: `/news/${item.id}` },
    robots: hasEditorialValue ? { index: true, follow: true } : { index: false, follow: true },
  };
}

function words(item) {
  return `${item?.list_headline || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.article_body || ""} ${item?.place || ""}`;
}

// 見出し末尾の「／戸田」「／三国G1」などから開催場を取り出す（place が空の報道記事向け）。
function headlineVenue(item) {
  const match = cleanNewsHeadline(item?.title).match(/／([^／」]{1,8})$/);
  return match ? match[1].replace(/(?:SG|G[123]|PG1|ミッド|3Days)$/, "").trim() : "";
}

function relatedScore(base, candidate) {
  let score = 0;
  const venue = headlineVenue(base);
  if (venue && venue === headlineVenue(candidate)) score += 6;
  if (classifyNewsBucket(base) === classifyNewsBucket(candidate)) score += 4;
  const a = words(base);
  const b = words(candidate);
  if (base.place && candidate.place && base.place === candidate.place) score += 8;
  if (base.category && candidate.category && base.category === candidate.category) score += 5;
  const terms = ["女子", "ヴィーナス", "オールレディース", "モーター", "優勝", "結果", "SG", "G1", "GⅠ", "水神祭", "A1", "A2"];
  for (const term of terms) if (a.includes(term) && b.includes(term)) score += 2;
  const published = new Date(candidate.published_at || 0).getTime();
  if (published) score += Math.max(0, 3 - (Date.now() - published) / 86400000 / 7);
  return score;
}

function shortMediaTitle(title) {
  const clean = String(title || "公式YouTube更新").replace(/[【\[].*?[】\]]/g, " ").replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 33)}…` : clean;
}

function isGenericCopy(value) {
  return /公開されたボートレース関連ニュースです|元記事を転載せず|記事をBoatStrikers NEWSが確認しました|詳細は出典元の記事をご確認ください/.test(String(value || ""));
}

function cleanSummary(item) {
  const value = String(item?.summary || "").replace(/\s+/g, " ").trim();
  if (!value || isGenericCopy(value)) return "";
  return value;
}

function renderArticleBody(body) {
  const lines = String(body || "").split(/\r?\n/);
  const nodes = [];
  let paragraph = [];
  let bullets = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(" ")}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(<ul key={`ul-${nodes.length}`}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushBullets(); continue; }
    if (/^##\s+/.test(line)) {
      flushParagraph(); flushBullets();
      const title = line.replace(/^##\s+/, "").trim();
      const isCheck = /CHECK/i.test(title);
      nodes.push(<h3 key={`h-${nodes.length}`} className={isCheck ? styles.checkHeading : undefined}>{title}</h3>);
      continue;
    }
    if (/^[-・]\s*/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-・]\s*/, ""));
      continue;
    }
    flushBullets();
    paragraph.push(line);
  }
  flushParagraph(); flushBullets();
  return nodes;
}

export default async function BoatStrikersNewsDetailPage({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);
  if (!item) notFound();

  const bucket = classifyNewsBucket(item);
  const label = newsBucketLabel(bucket);
  const summary = cleanSummary(item);
  const articleBody = !isGenericCopy(item.article_body) ? String(item.article_body || "").trim() : "";
  const assignment = assignNewsCharacter(item);
  const character = assignment ? NEWS_CHARACTERS[assignment.key] : null;
  const note = assignment ? newsCharacterNote(assignment.key) : null;
  const now = Date.now();

  const [allNews, media] = await Promise.all([
    getHatsuneNews({ limit: 80, category: "all" }),
    getOfficialYoutubeUpdates({ limit: 60 }),
  ]);

  const relatedNews = allNews
    .filter((candidate) => String(candidate.id) !== String(item.id))
    .map((candidate) => ({ ...candidate, _score: relatedScore(item, candidate) }))
    .filter((candidate) => candidate._score > 0)
    .sort((a, b) => b._score - a._score || new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 5)
    .map((candidate) => toNewsListItem(candidate));

  const baseText = words(item);
  const isWomen = /女子|ヴィーナス|オールレディース|レディース/.test(baseText);
  const relatedMedia = media
    .filter((video) => (item.place && video.place === item.place) || (isWomen && video.womenRelated))
    .slice(0, 2);

  return (
    <main className={theme.theme}><div className={theme.shell}>
      <header className={theme.band}>
        <Link href="/news" className={theme.logo}><b>BoatStrikers</b><span>NEWS</span></Link>
        <div className={theme.bandMeta}><Link href="/news" className={styles.bandBack}>ニュース一覧 ›</Link></div>
      </header>
      <nav className={styles.crumb} aria-label="パンくずリスト">
        <Link href="/news">NEWS</Link><span>›</span>
        {bucket === "all" ? <span>{label}</span> : <Link href={newsListHref({ category: bucket })}>{label}</Link>}
      </nav>

      <article className={styles.article}>
        <div className={styles.kicker}>
          {bucket === "all" ? <span className={`${theme.chip} ${categoryClass(bucket)}`}>{label}</span> : <Link href={newsListHref({ category: bucket })} className={`${theme.chip} ${categoryClass(bucket)}`}>{label}</Link>}
          {isBsDataNews(item) && <span className={theme.bsMark}>BS DATA</span>}
          <time dateTime={item.published_at || undefined}>{formatHatsuneNewsDate(item.published_at)}</time>
          {item.place && <span>{item.place}</span>}
          {item.source_name && <span>出典：{item.source_name}</span>}
        </div>

        <h1>{cleanNewsHeadline(item.title)}</h1>

        {summary && <div className={styles.lead}><span>要約</span><p>{summary}</p></div>}

        {item.image_url && (
          <figure className={styles.articlePhoto}>
            <img src={item.image_url} alt={`${item.title} 関連画像`} loading="eager" decoding="async" referrerPolicy="no-referrer" />
            {item.source_name && <figcaption>画像：{item.source_name}</figcaption>}
          </figure>
        )}

        {articleBody && <div className={styles.bodyContent}>{renderArticleBody(articleBody)}</div>}

        {!summary && !articleBody && (
          <p className={styles.summaryPending}>このニュースは現在、公開情報をもとに要約を整理しています。</p>
        )}

        {item.source_url && (
          <div className={styles.sourceBox}>
            <div><small>SOURCE</small><b>{item.source_name || "出典・関連情報"}</b><span>詳しい内容は出典元で確認できます。</span></div>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer">元記事を見る ↗</a>
          </div>
        )}

        <p className={styles.notice}>BoatStrikers NEWSは公開情報をもとに要点を整理しています。出典元の記事本文は転載していません。</p>
      </article>

      {character ? (
        <aside className={`${styles.guide} ${styles[`guide_${character.key}`]}`} aria-label="編集部の案内">
          <NewsCharacterBust character={character.key} />
          <div className={styles.guideMain}>
            <div className={styles.guideHead}><span className={theme.guideLabel}>{note.label}</span><b>{character.name}</b><small>{character.role} 担当</small></div>
            <p>{note.text}</p>
            <div className={styles.guideLinks}>
              <Link href={newsListHref({ character: character.key })}>{character.name}担当のニュース ›</Link>
              <Link href="/races">今日の出走表 ›</Link>
            </div>
            <p className={styles.guideReason}>担当の理由：{describeNewsCharacterReason(assignment)}</p>
          </div>
        </aside>
      ) : (
        <aside className={styles.nextBox} aria-label="次にチェックしたい情報">
          <b>次にチェックしたい情報</b>
          <p>{item.place ? `${item.place}の開催・出走表、続報、展示・直前情報もBoatStrikers内で続けて確認できます。` : "このニュースの続報や次走情報、展示・直前情報もBoatStrikers NEWSで続けて確認できます。"}</p>
        </aside>
      )}

      {relatedNews.length > 0 && (
        <section className={styles.related}>
          <div className={theme.listHead}><h2>関連記事</h2><span>同じ場・同じカテゴリー</span></div>
          <div className={theme.list}>{relatedNews.map((news) => <NewsHeadlineRow key={news.id} item={news} now={now} timeMode="date" showNew={false} />)}</div>
          {bucket !== "all" && <Link href={newsListHref({ category: bucket })} className={styles.moreLink}>{label}の記事をもっと見る ›</Link>}
        </section>
      )}

      {relatedMedia.length > 0 && (
        <section className={relatedStyles.relatedSection}>
          <div className={theme.listHead}><h2>関連動画</h2><span>公式YouTube</span></div>
          <div className={relatedStyles.mediaGrid}>
            {relatedMedia.map((video) => (
              <Link key={video.id} href={`/news/media/${video.videoId}`} className={relatedStyles.mediaCard}>
                {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}
                <div>
                  <span>{video.place}公式</span>
                  <strong>{shortMediaTitle(video.title)}</strong>
                  <small>BoatStrikersで内容を見る →</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link href="/races" className={theme.raceCta}><span>RACE</span><b>{item.place ? `${item.place}の開催・出走表をチェック` : "今日の出走表・AI予想を見る"}</b><i>›</i></Link>

      <div className={styles.bottomLinks}>
        <Link href="/news">‹ ニュース一覧へ</Link>
        <Link href="/races">今日の出走表へ ›</Link>
      </div>
    </div></main>
  );
}

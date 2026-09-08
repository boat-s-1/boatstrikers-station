import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./detail.module.css";
import relatedStyles from "./related.module.css";
import {
  getHatsuneNewsById,
  getHatsuneNews,
  HATSUNE_NEWS_LABELS,
  formatHatsuneNewsDate,
} from "../../hatsune/newsData";
import { getOfficialYoutubeUpdates } from "../media/mediaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);
  if (!item) return { title: "BoatStrikers NEWS" };
  return {
    title: `${item.title} | BoatStrikers NEWS`,
    description: item.summary || "BoatStrikersがボートレースの最新ニュースをわかりやすくまとめます。",
  };
}

function words(item) {
  return `${item?.list_headline || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.article_body || ""} ${item?.place || ""}`;
}

function relatedScore(base, candidate) {
  let score = 0;
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

function shortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);
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

function getCheckLabel(item) {
  const text = words(item);
  if (/女子|ヴィーナス|オールレディース|レディース/.test(text)) return "初音 CHECK";
  if (/イン逃げ|1コース|イン戦/.test(text)) return "一果 CHECK";
  if (/5号艇|穴狙い|カド攻め/.test(text)) return "キイナ CHECK";
  return "BoatStrikers CHECK";
}

export default async function BoatStrikersNewsDetailPage({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);
  if (!item) notFound();

  const label = HATSUNE_NEWS_LABELS[item.category] || HATSUNE_NEWS_LABELS.topic;
  const summary = cleanSummary(item);
  const articleBody = !isGenericCopy(item.article_body) ? String(item.article_body || "").trim() : "";
  const checkLabel = getCheckLabel(item);

  const [allNews, media] = await Promise.all([
    getHatsuneNews({ limit: 80, category: "all" }),
    getOfficialYoutubeUpdates({ limit: 60 }),
  ]);

  const relatedNews = allNews
    .filter((candidate) => String(candidate.id) !== String(item.id))
    .map((candidate) => ({ ...candidate, _score: relatedScore(item, candidate) }))
    .filter((candidate) => candidate._score > 0)
    .sort((a, b) => b._score - a._score || new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 3);

  const baseText = words(item);
  const isWomen = /女子|ヴィーナス|オールレディース|レディース/.test(baseText);
  const relatedMedia = media
    .filter((video) => (item.place && video.place === item.place) || (isWomen && video.womenRelated))
    .slice(0, 2);

  return (
    <main className={styles.page}>
      <div className={styles.topLinks}>
        <Link href="/news">← NEWS一覧</Link>
        <Link href="/">BoatStrikers TOP</Link>
      </div>

      <article className={styles.article}>
        <div className={styles.tags}>
          <span className={styles.tag}>{label}</span>
          {item.source_type === "bs_data" && <span className={styles.bsTag}>BS DATA</span>}
        </div>

        <h1>{item.title}</h1>

        <div className={styles.meta}>
          {item.place && <span>{item.place}</span>}
          <span>{formatHatsuneNewsDate(item.published_at)}</span>
          {item.source_name && <span>{item.source_name}</span>}
        </div>

        {summary && (
          <section className={styles.summaryLead}>
            <span>NEWS SUMMARY</span>
            <h2>この記事の要約</h2>
            <p>{summary}</p>
          </section>
        )}

        {item.image_url && (
          <figure className={styles.articlePhoto}>
            <img src={item.image_url} alt={`${item.title} 関連画像`} loading="eager" decoding="async" referrerPolicy="no-referrer" />
            {item.source_name && <figcaption>画像：{item.source_name}</figcaption>}
          </figure>
        )}

        {articleBody && (
          <section className={styles.articleBody}>
            <span>BOATSTRIKERS EDIT</span>
            <h2>ニュースを詳しく</h2>
            <div className={styles.bodyContent}>{renderArticleBody(articleBody)}</div>
          </section>
        )}

        {!summary && !articleBody && (
          <section className={styles.summaryPending}>
            <span>NEWS SUMMARY</span>
            <p>このニュースは現在、公開情報をもとに要約を整理しています。</p>
          </section>
        )}

        <section className={styles.checkBox}>
          <span>{checkLabel}</span>
          <strong>次にチェックしたい情報</strong>
          <p>{item.place ? `${item.place}の開催・出走表、続報、展示・直前情報もBoatStrikers内で続けて確認できます。` : "このニュースの続報や次走情報、展示・直前情報もBoatStrikers NEWSで続けて確認できます。"}</p>
        </section>

        {item.source_url && (
          <section className={styles.sourceBox}>
            <div>
              <span>SOURCE</span>
              <h2>{item.source_name || "出典・関連情報"}</h2>
              <p>詳しい内容は出典元で確認できます。</p>
            </div>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer">元記事を見る ↗</a>
          </section>
        )}

        <p className={styles.notice}>BoatStrikers NEWSは公開情報をもとに要点を整理しています。出典元の記事本文は転載していません。</p>
      </article>

      {relatedNews.length > 0 && (
        <section className={relatedStyles.relatedSection}>
          <div className={relatedStyles.heading}><h2>関連記事</h2><span>このニュースに近い記事</span></div>
          <div className={relatedStyles.newsList}>
            {relatedNews.map((news) => (
              <Link key={news.id} href={`/news/${news.id}`} className={relatedStyles.newsRow}>
                <time>{shortDate(news.published_at)}</time>
                <strong>{news.list_headline || news.title}</strong>
                <span>›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {relatedMedia.length > 0 && (
        <section className={relatedStyles.relatedSection}>
          <div className={relatedStyles.heading}><h2>関連動画</h2><span>公式YouTube</span></div>
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

      {item.place && (
        <section className={relatedStyles.relatedSection}>
          <Link href="/races" className={relatedStyles.raceLink}>
            <div><span>RACE INFORMATION</span><strong>{item.place}の開催・出走表をチェック</strong></div>
            <b>出走表へ →</b>
          </Link>
        </section>
      )}

      <div className={styles.bottomLinks}>
        <Link href="/news">ニュース一覧へ戻る</Link>
        <Link href="/races">今日の出走表へ</Link>
      </div>
    </main>
  );
}

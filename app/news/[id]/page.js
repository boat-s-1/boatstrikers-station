import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../../hatsune/news/[id]/page.module.css";
import relatedStyles from "./related.module.css";
import {
  getHatsuneNewsById,
  getHatsuneNews,
  getHatsuneNewsImage,
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
  return `${item?.list_headline || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.place || ""}`;
}

function relatedScore(base, candidate) {
  let score = 0;
  const a = words(base);
  const b = words(candidate);
  if (base.place && candidate.place && base.place === candidate.place) score += 8;
  if (base.category && candidate.category && base.category === candidate.category) score += 5;
  const terms = ["女子", "ヴィーナス", "オールレディース", "モーター", "優勝", "結果", "SG", "G1", "水神祭", "A1", "A2"];
  for (const term of terms) if (a.includes(term) && b.includes(term)) score += 2;
  const published = new Date(candidate.published_at || 0).getTime();
  if (published) score += Math.max(0, 3 - (Date.now() - published) / 86400000 / 7);
  return score;
}

function shortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function shortMediaTitle(title) {
  const clean = String(title || "公式YouTube更新").replace(/[【\[].*?[】\]]/g, " ").replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 34 ? `${clean.slice(0, 33)}…` : clean;
}

export default async function BoatStrikersNewsDetailPage({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);
  if (!item) notFound();

  const label = HATSUNE_NEWS_LABELS[item.category] || HATSUNE_NEWS_LABELS.topic;
  const heroImage = getHatsuneNewsImage(item);

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
        <Link href="/news">← BoatStrikers NEWS</Link>
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
        </div>

        <div className={styles.heroImage}>
          <img src={heroImage} alt={`${item.title} 見出し画像`} decoding="async" />
        </div>

        <section className={styles.summary}>
          <span>BOATSTRIKERS NEWS</span>
          <h2>ニュース概要</h2>
          <p>{item.summary || "このニュースの詳細情報を確認しています。"}</p>
        </section>

        {item.article_body && (
          <section className={styles.articleBody}>
            <span>BOATSTRIKERS EDIT</span>
            <h2>詳しく見る</h2>
            <p>{item.article_body}</p>
          </section>
        )}

        {item.image_url && (
          <figure className={styles.articlePhoto}>
            <img src={item.image_url} alt={`${item.title} 関連画像`} loading="lazy" decoding="async" />
          </figure>
        )}

        <section className={styles.infoBox}>
          <h2>この記事について</h2>
          <dl>
            {item.place && <div><dt>開催場</dt><dd>{item.place}</dd></div>}
            <div><dt>カテゴリ</dt><dd>{label.replace(/^\S+\s*/, "")}</dd></div>
            <div><dt>情報区分</dt><dd>{item.source_type === "bs_data" ? "BoatStrikers独自データ" : "ニュース・公式情報"}</dd></div>
            {item.source_name && <div><dt>出典</dt><dd>{item.source_name}</dd></div>}
          </dl>
        </section>

        {item.source_url && (
          <section className={styles.sourceBox}>
            <div>
              <span>LINK / SOURCE</span>
              <h2>{item.source_name || "関連情報を見る"}</h2>
              <p>関連ページや公式情報をあわせて確認できます。</p>
            </div>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.source_name || "関連情報"}を見る ↗</a>
          </section>
        )}
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
        <Link href="/hatsune">初音ページへ</Link>
      </div>
    </main>
  );
}

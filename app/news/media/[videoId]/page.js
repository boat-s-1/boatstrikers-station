import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfficialYoutubeUpdates, formatMediaDate } from "../mediaData";
import { getMediaEditorial, getMediaEditorialMap } from "../../../../lib/mediaEditorialData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = "https://www.boat-strike.online";

function fallbackHeadline(title) {
  const clean = String(title || "公式YouTube更新").replace(/[【\[].*?[】\]]/g, " ").replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
}

function fallbackIntro(item) {
  const women = item.womenRelated ? "女子戦・女子レーサーに関する公式動画です。" : "ボートレース場公式チャンネルの最新動画です。";
  return `${item.place}公式YouTubeが公開した動画をBoatStrikers MEDIAで紹介します。${women}開催場と公開情報を整理してから、公式YouTubeで本編を確認できます。`;
}

async function loadMedia(videoId) {
  const updates = await getOfficialYoutubeUpdates({ limit: 100 });
  return { updates, item: updates.find((x) => x.videoId === videoId) || null };
}

export async function generateMetadata({ params }) {
  const { videoId } = await params;
  const { item } = await loadMedia(videoId);
  if (!item) return { title: "MEDIA | BoatStrikers NEWS" };
  const editorial = await getMediaEditorial(videoId);
  const headline = editorial?.short_headline || fallbackHeadline(item.title);
  const description = editorial?.intro || fallbackIntro(item);
  const canonical = `${SITE_URL}/news/media/${videoId}`;
  return {
    title: `${headline} | BoatStrikers MEDIA`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "video.other",
      title: headline,
      description,
      url: canonical,
      siteName: "BoatStrikers",
      images: item.thumbnailUrl ? [{ url: item.thumbnailUrl, width: 1280, height: 720, alt: headline }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: headline,
      description,
      images: item.thumbnailUrl ? [item.thumbnailUrl] : [],
    },
  };
}

export default async function MediaDetailPage({ params }) {
  const { videoId } = await params;
  const { updates, item } = await loadMedia(videoId);
  if (!item) notFound();
  const related = updates.filter((x) => x.videoId !== videoId && (x.place === item.place || (item.womenRelated && x.womenRelated))).slice(0, 4);
  const [editorial, relatedEditorialMap] = await Promise.all([
    getMediaEditorial(videoId),
    getMediaEditorialMap(related.map((x) => x.videoId)),
  ]);
  const headline = editorial?.short_headline || fallbackHeadline(item.title);
  const intro = editorial?.intro || fallbackIntro(item);
  const highlights = editorial?.highlights?.length ? editorial.highlights : [
    `${item.place}公式チャンネルが公開した一次情報です。`,
    item.womenRelated ? "女子戦・女子レーサー関連として整理しています。" : "開催場の最新情報として確認できます。",
    "出演者や競技情報の最終確認は公式動画で行えます。",
  ];
  const canonical = `${SITE_URL}/news/media/${videoId}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: item.title,
    headline,
    description: intro,
    thumbnailUrl: item.thumbnailUrl ? [item.thumbnailUrl] : undefined,
    uploadDate: item.publishedAt || undefined,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    url: canonical,
    mainEntityOfPage: canonical,
    publisher: {
      "@type": "Organization",
      name: "BoatStrikers",
      url: SITE_URL,
    },
    isFamilyFriendly: true,
    inLanguage: "ja-JP",
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className={styles.article}>
        <div className={styles.topline}><Link href="/news/media">← MEDIA</Link><span>{item.place}公式YouTube</span></div>
        <div className={styles.badges}><b>公式動画</b>{item.womenRelated && <b className={styles.women}>女子</b>}<time>{formatMediaDate(item.publishedAt)}</time></div>
        <h1>{headline}</h1>
        <p className={styles.officialTitle}>正式タイトル：{item.title}</p>

        {item.thumbnailUrl && <img className={styles.hero} src={item.thumbnailUrl} alt={`${headline} 公式動画サムネイル`} />}

        <section>
          <h2>この動画について</h2>
          <p>{intro}</p>
        </section>

        <section className={styles.contextSection}>
          <h2>視聴前にチェック</h2>
          <div className={styles.contextGrid}>
            <div><span>配信元</span><strong>{item.place}公式YouTube</strong></div>
            <div><span>公開</span><strong>{formatMediaDate(item.publishedAt)}</strong></div>
            <div><span>分類</span><strong>{item.womenRelated ? "女子関連" : "公式最新動画"}</strong></div>
            <div><span>BoatStrikers</span><strong>要点を整理して紹介</strong></div>
          </div>
          <p className={styles.contextNote}>BoatStrikersでは、公式タイトルと公開情報をもとに要点を整理しています。動画内の発言・結果・出演情報は本編を一次情報として確認してください。</p>
        </section>

        <section>
          <h2>BoatStrikers 注目ポイント</h2>
          <ul>{highlights.slice(0, 3).map((point, index) => <li key={index}>{point}</li>)}</ul>
        </section>

        {editorial?.editor_note && (
          <section>
            <h2>BoatStrikers 編集部メモ</h2>
            <p>{editorial.editor_note}</p>
          </section>
        )}

        <section className={styles.nextSection}>
          <h2>あわせてチェック</h2>
          <div className={styles.nextLinks}>
            <Link href={item.womenRelated ? "/news?category=women" : "/news?category=focus"}>{item.womenRelated ? "女子ニュースを見る" : "注目レースを見る"} →</Link>
            <Link href="/races">今日の出走表・AI予想を見る →</Link>
            <Link href="/news/media">公式動画一覧を見る →</Link>
          </div>
        </section>

        <a className={styles.youtubeButton} href={item.url} target="_blank" rel="noreferrer">▶ 公式YouTubeで本編を見る ↗</a>

        {related.length > 0 && (
          <section className={styles.related}>
            <h2>関連動画</h2>
            <div className={styles.relatedList}>
              {related.map((video) => (
                <Link key={video.id} href={`/news/media/${video.videoId}`} className={styles.relatedRow}>
                  {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}
                  <div><span>{video.place}公式</span><strong>{relatedEditorialMap[video.videoId]?.short_headline || fallbackHeadline(video.title)}</strong><time>{formatMediaDate(video.publishedAt)}</time></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className={styles.note}>出典：{item.place}公式YouTube。BoatStrikersは公式動画を転載せず、公式情報への導線と独自の整理・紹介を提供しています。</div>
      </article>
    </main>
  );
}

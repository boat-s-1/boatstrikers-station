import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfficialYoutubeUpdates, formatMediaDate } from "../mediaData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function shortHeadline(title) {
  const clean = String(title || "公式YouTube更新")
    .replace(/[【\[].*?[】\]]/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
}

function editorialSummary(item) {
  const women = item.womenRelated ? "女子戦・女子レーサーに関する公式動画です。" : "ボートレース場公式チャンネルの最新動画です。";
  return `${item.place}公式YouTubeが公開した動画をBoatStrikers MEDIAで紹介します。${women}内容を確認してから、公式YouTubeで本編を視聴できます。`;
}

export default async function MediaDetailPage({ params }) {
  const { videoId } = await params;
  const updates = await getOfficialYoutubeUpdates({ limit: 24 });
  const item = updates.find((x) => x.videoId === videoId);
  if (!item) notFound();
  const related = updates.filter((x) => x.videoId !== videoId && (x.place === item.place || (item.womenRelated && x.womenRelated))).slice(0, 4);

  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <div className={styles.topline}><Link href="/news/media">← MEDIA</Link><span>{item.place}公式YouTube</span></div>
        <div className={styles.badges}><b>公式動画</b>{item.womenRelated && <b className={styles.women}>女子</b>}<time>{formatMediaDate(item.publishedAt)}</time></div>
        <h1>{shortHeadline(item.title)}</h1>
        <p className={styles.officialTitle}>正式タイトル：{item.title}</p>

        {item.thumbnailUrl && <img className={styles.hero} src={item.thumbnailUrl} alt="" />}

        <section>
          <h2>この動画について</h2>
          <p>{editorialSummary(item)}</p>
        </section>

        <section>
          <h2>BoatStrikers 注目ポイント</h2>
          <ul>
            <li>{item.place}公式チャンネルが公開した一次情報です。</li>
            <li>{item.womenRelated ? "女子戦・女子レーサー関連として初音ページにも掲載対象です。" : "開催場の最新情報を確認したい方におすすめです。"}</li>
            <li>動画の内容・出演者・最新情報は公式動画で確認できます。</li>
          </ul>
        </section>

        <a className={styles.youtubeButton} href={item.url} target="_blank" rel="noreferrer">▶ 公式YouTubeで本編を見る ↗</a>

        {related.length > 0 && (
          <section className={styles.related}>
            <h2>関連動画</h2>
            <div className={styles.relatedList}>
              {related.map((video) => (
                <Link key={video.id} href={`/news/media/${video.videoId}`} className={styles.relatedRow}>
                  {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}
                  <div><span>{video.place}公式</span><strong>{shortHeadline(video.title)}</strong><time>{formatMediaDate(video.publishedAt)}</time></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className={styles.note}>出典：{item.place}公式YouTube。BoatStrikersは公式動画への導線と独自の整理・紹介を提供しています。</div>
      </article>
    </main>
  );
}

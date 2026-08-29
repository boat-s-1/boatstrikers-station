import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../../hatsune/news/[id]/page.module.css";
import {
  getHatsuneNewsById,
  getHatsuneNewsImage,
  HATSUNE_NEWS_LABELS,
  formatHatsuneNewsDate,
} from "../../hatsune/newsData";

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

export default async function BoatStrikersNewsDetailPage({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);
  if (!item) notFound();

  const label = HATSUNE_NEWS_LABELS[item.category] || HATSUNE_NEWS_LABELS.topic;
  const heroImage = getHatsuneNewsImage(item);

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

      <div className={styles.bottomLinks}>
        <Link href="/news">ニュース一覧へ戻る</Link>
        <Link href="/hatsune">初音ページへ</Link>
      </div>
    </main>
  );
}

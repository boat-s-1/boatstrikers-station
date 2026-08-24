import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import {
  getHatsuneNewsById,
  HATSUNE_NEWS_LABELS,
  formatHatsuneNewsDate,
} from "../../newsData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);

  if (!item) {
    return { title: "初音 女子ボートNEWS | BoatStrikers" };
  }

  return {
    title: `${item.title} | 初音 女子ボートNEWS`,
    description: item.summary || "女子ボートレースの最新ニュースを初音がわかりやすくまとめます。",
  };
}

export default async function HatsuneNewsDetailPage({ params }) {
  const { id } = await params;
  const item = await getHatsuneNewsById(id);

  if (!item) notFound();

  const label = HATSUNE_NEWS_LABELS[item.category] || HATSUNE_NEWS_LABELS.topic;

  return (
    <main className={styles.page}>
      <div className={styles.topLinks}>
        <Link href="/hatsune/news">← 女子ボートNEWS</Link>
        <Link href="/hatsune">初音TOP</Link>
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

        {item.image_url && (
          <div className={styles.heroImage}>
            <img src={item.image_url} alt="" />
          </div>
        )}

        <section className={styles.summary}>
          <span>HATSUNE NEWS</span>
          <h2>ニュース概要</h2>
          <p>{item.summary || "このニュースの詳細情報を確認しています。"}</p>
        </section>

        <section className={styles.infoBox}>
          <h2>この記事について</h2>
          <dl>
            {item.place && (
              <div>
                <dt>開催場</dt>
                <dd>{item.place}</dd>
              </div>
            )}
            <div>
              <dt>カテゴリ</dt>
              <dd>{label.replace(/^\S+\s*/, "")}</dd>
            </div>
            <div>
              <dt>情報区分</dt>
              <dd>{item.source_type === "bs_data" ? "BoatStrikers独自データ" : "ニュース・公式情報"}</dd>
            </div>
            {item.source_name && (
              <div>
                <dt>出典</dt>
                <dd>{item.source_name}</dd>
              </div>
            )}
          </dl>
        </section>

        {item.source_url && (
          <section className={styles.sourceBox}>
            <div>
              <span>SOURCE</span>
              <h2>元情報を確認する</h2>
              <p>詳細・正式発表は、元の公式情報・報道ページもあわせてご確認ください。</p>
            </div>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer">
              {item.source_name || "元情報"}を見る ↗
            </a>
          </section>
        )}
      </article>

      <div className={styles.bottomLinks}>
        <Link href="/hatsune/news">ニュース一覧へ戻る</Link>
        <Link href="/hatsune">初音ページへ</Link>
      </div>
    </main>
  );
}

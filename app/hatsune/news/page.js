import Link from "next/link";
import styles from "./page.module.css";
import {
  getHatsuneNews,
  HATSUNE_NEWS_CATEGORIES,
  HATSUNE_NEWS_LABELS,
  formatHatsuneNewsDate,
} from "../newsData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function NewsRow({ item }) {
  const label = HATSUNE_NEWS_LABELS[item.category] || HATSUNE_NEWS_LABELS.topic;

  return (
    <a
      className={styles.newsRow}
      href={item.source_url || "#"}
      target={item.source_url ? "_blank" : undefined}
      rel={item.source_url ? "noopener noreferrer" : undefined}
    >
      <div className={styles.imageBox}>
        {item.image_url ? (
          <img src={item.image_url} alt="" />
        ) : (
          <div className={styles.imageFallback}>HATSUNE NEWS</div>
        )}
      </div>

      <div className={styles.rowBody}>
        <div className={styles.tags}>
          <span className={styles.tag}>{label}</span>
          {item.source_type === "bs_data" && (
            <span className={styles.bsTag}>BS DATA</span>
          )}
        </div>

        <h2>{item.title}</h2>

        {item.summary && <p>{item.summary}</p>}

        <div className={styles.meta}>
          {item.place && <span>{item.place}</span>}
          {item.source_name && <span>{item.source_name}</span>}
          <span>{formatHatsuneNewsDate(item.published_at)}</span>
        </div>
      </div>
    </a>
  );
}

export default async function HatsuneNewsPage({ searchParams }) {
  const params = await searchParams;
  const requested = params?.category || "all";
  const valid = HATSUNE_NEWS_CATEGORIES.some((item) => item.key === requested);
  const category = valid ? requested : "all";
  const news = await getHatsuneNews({ limit: 50, category });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/hatsune" className={styles.back}>← 初音TOP</Link>
        <div>
          <span>HATSUNE</span>
          <h1>女子ボートNEWS</h1>
          <p>今日の女子ボート界と、明日の注目情報。</p>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="ニュースカテゴリー">
        {HATSUNE_NEWS_CATEGORIES.map((item) => (
          <Link
            key={item.key}
            href={item.key === "all" ? "/hatsune/news" : `/hatsune/news?category=${item.key}`}
            className={`${styles.tab} ${category === item.key ? styles.active : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className={styles.summaryBar}>
        <div>
          <strong>{news.length}</strong>
          <span>件</span>
        </div>
        <p>NEWS＝公式・報道情報 / BS DATA＝BoatStrikers独自データ</p>
      </section>

      {news.length > 0 ? (
        <section className={styles.list}>
          {news.map((item) => <NewsRow key={item.id} item={item} />)}
        </section>
      ) : (
        <section className={styles.empty}>
          <div>📰</div>
          <h2>ニュース収集の接続準備中です</h2>
          <p>
            毎晩の自動収集を接続すると、女子戦結果・水神祭・優勝・級別・高モーター・翌日情報がここへ自動で蓄積されます。
          </p>
        </section>
      )}

      <footer className={styles.footer}>
        <Link href="/hatsune">初音ページへ戻る</Link>
      </footer>
    </main>
  );
}

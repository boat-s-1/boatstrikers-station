import Link from "next/link";
import { notFound } from "next/navigation";
import { dataLabArticles, getDataLabArticle } from "../allArticles";
import styles from "./article.module.css";

export function generateStaticParams() {
  return dataLabArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = getDataLabArticle(slug);
  if (!article) return {};

  return {
    title: `${article.title}｜BoatStrikers DATA LAB`,
    description: article.description,
    alternates: { canonical: `/data-lab/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `/data-lab/${article.slug}`,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
  };
}

export default async function DataLabArticlePage({ params }) {
  const { slug } = await params;
  const article = getDataLabArticle(slug);
  if (!article) notFound();

  const related = dataLabArticles.filter((item) => item.slug !== article.slug).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: "BoatStrikers" },
    publisher: { "@type": "Organization", name: "BoatStrikers" },
    mainEntityOfPage: `https://www.boat-strike.online/data-lab/${article.slug}`,
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="BoatStrikers ホーム">
          BOAT<br /><span>STRIKERS</span>
        </Link>
        <Link href="/data-lab" className={styles.backLink}>DATA LAB一覧</Link>
      </header>

      <article className={styles.article}>
        <nav className={styles.breadcrumb} aria-label="パンくず">
          <Link href="/">ホーム</Link><span>›</span><Link href="/data-lab">DATA LAB</Link><span>›</span><span>{article.category}</span>
        </nav>

        <header className={styles.articleHeader}>
          <span className={styles.category}>{article.category}</span>
          <h1>{article.title}</h1>
          <p className={styles.description}>{article.description}</p>
          <div className={styles.meta}>
            <span>執筆：{article.author}</span>
            <span>公開：{article.publishedAt.replaceAll("-", ".")}</span>
            <span>更新：{article.updatedAt.replaceAll("-", ".")}</span>
          </div>
        </header>

        <p className={styles.lead}>{article.lead}</p>

        {article.stats?.length > 0 && (
          <section className={styles.statsSection} aria-labelledby="summary-heading">
            <h2 id="summary-heading">検証概要</h2>
            <dl className={styles.statsGrid}>
              {article.stats.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>
        )}

        <div className={styles.pointBox}>
          <span>BoatStrikers POINT</span>
          <p>{article.point}</p>
        </div>

        <div className={styles.body}>
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>

        <aside className={styles.disclaimer}>
          <strong>データ・舟券について</strong>
          <p>{article.disclaimer}</p>
          <p>舟券の購入は20歳になってから。無理のない範囲でお楽しみください。</p>
        </aside>

        <section className={styles.related}>
          <h2>関連記事</h2>
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <Link key={item.slug} href={`/data-lab/${item.slug}`}>
                <span>{item.category}</span><strong>{item.title}</strong><b>読む →</b>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}

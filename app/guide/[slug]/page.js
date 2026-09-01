import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import styles from "./article.module.css";
import { CHARACTERS, GUIDE_ARTICLES, GUIDE_UPDATED_AT, getGuideArticle } from "../guideData";

export function generateStaticParams() {
  return GUIDE_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) return {};
  return {
    title: `${article.title}｜ボートレース初心者ガイド`,
    description: article.description,
    alternates: { canonical: `/guide/${article.slug}` },
    openGraph: {
      title: `${article.title}｜BoatStrikers`,
      description: article.description,
      url: `/guide/${article.slug}`,
      type: "article",
      modifiedTime: GUIDE_UPDATED_AT,
    },
  };
}

export default async function GuideArticlePage({ params }) {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) notFound();
  const guideCharacter = CHARACTERS[article.character];
  const currentIndex = GUIDE_ARTICLES.findIndex((item) => item.slug === slug);
  const previous = GUIDE_ARTICLES[currentIndex - 1];
  const next = GUIDE_ARTICLES[currentIndex + 1];

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="パンくずリスト">
        <Link href="/">ホーム</Link><span>›</span><Link href="/guide">ボートレースガイド</Link><span>›</span><span>{article.title}</span>
      </nav>

      <article className={styles.article}>
        <header className={styles.hero}>
          <div>
            <span>BEGINNER&apos;S GUIDE {article.number}</span>
            <h1>{article.title}</h1>
            <p>{article.description}</p>
          </div>
          <div className={styles.guideCharacter}>
            <Image src={guideCharacter.image} alt={guideCharacter.name} width={88} height={88} />
            <strong>{guideCharacter.name}</strong>
            <small>{guideCharacter.role}</small>
          </div>
        </header>

        <section className={styles.conclusion} aria-labelledby="article-conclusion">
          <span>最初に結論</span>
          <h2 id="article-conclusion">{article.lead}</h2>
        </section>

        <nav className={styles.toc} aria-label="この記事の内容">
          <strong>この記事で分かること</strong>
          <ol>
            {article.sections.map((section, index) => (
              <li key={section.title}><a href={`#section-${index + 1}`}>{section.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className={styles.body}>
          {article.sections.map((section, index) => (
            <section id={`section-${index + 1}`} className={styles.section} key={section.title}>
              <span className={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.points && (
                <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>
              )}
              {section.comment && (() => {
                const character = CHARACTERS[section.comment.character];
                return (
                  <aside className={styles.comment}>
                    <Image src={character.image} alt={character.name} width={54} height={54} />
                    <div><strong>{character.name}のポイント</strong><p>{section.comment.text}</p></div>
                  </aside>
                );
              })()}
            </section>
          ))}
        </div>

        <section className={styles.references}>
          <h2>参考情報</h2>
          <p>基本ルールや制度は、BOAT RACE公式情報を確認して構成しています。</p>
          <ul>{article.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a></li>)}</ul>
        </section>

        <aside className={styles.disclaimer}>
          <strong>注意事項</strong>
          <p>この記事はボートレースの仕組みを学ぶための情報です。舟券の購入は20歳になってから。掲載情報は的中や利益を保証するものではありません。</p>
        </aside>

        <footer className={styles.editorial}>
          <span>編集：BoatStrikers編集部</span>
          <time dateTime={GUIDE_UPDATED_AT}>更新日：2026年9月2日</time>
        </footer>
      </article>

      <nav className={styles.articleNav} aria-label="ガイド記事の移動">
        {previous ? <Link href={`/guide/${previous.slug}`}><small>前の記事</small><strong>‹ {previous.title}</strong></Link> : <span />}
        {next ? <Link href={`/guide/${next.slug}`}><small>次の記事</small><strong>{next.title} ›</strong></Link> : <Link href="/guide"><small>一覧へ</small><strong>ガイドトップ ›</strong></Link>}
      </nav>

      <section className={styles.related}>
        <h2>次に見るコンテンツ</h2>
        <div><Link href="/races">本日の出走表</Link><Link href="/ichika-sensei">動画・画像で学ぶ</Link><Link href="/library/stadiums">全国24場攻略</Link></div>
      </section>
    </main>
  );
}

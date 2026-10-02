import Link from "next/link";
import GuideChapter from "../GuideChapter";
import { GuideCast, GuideTalk } from "../GuideConversation";
import { notFound } from "next/navigation";
import { spokenText } from "../spokenText";
import styles from "./article.module.css";
import { GUIDE_ARTICLES, GUIDE_UPDATED_AT, getGuideArticle } from "../guideData";

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
            <GuideTalk character="hatsune" pose="welcome"><p>{article.description}</p></GuideTalk>
          </div>
          <GuideCast />
        </header>

        <section className={styles.conclusion} aria-labelledby="article-conclusion">
          <span>最初に結論</span>
          <h2 id="article-conclusion">3人で押さえる、このテーマの基本</h2>
          <GuideTalk character={article.character} pose="recap"><p>{spokenText(article.lead, article.character)}</p></GuideTalk>
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
            <GuideChapter key={section.title} section={section} index={index} topic={article.slug} nextTitle={article.sections[index + 1]?.title} />
          ))}
        </div>

        <section className={styles.references}>
          <h2>参考情報</h2>
          <p>基本ルールや制度は、BOAT RACE公式情報を確認して構成しています。</p>
          <ul>{article.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a></li>)}</ul>
        </section>

        <aside className={styles.disclaimer}>
          <strong>注意事項</strong>
          <GuideTalk character="hatsune" pose="think"><p>この記事はボートレースの仕組みを学ぶための情報です。舟券の購入は20歳になってから。掲載情報は的中や利益を保証するものではありません。</p></GuideTalk>
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

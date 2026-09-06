import Link from "next/link";
import styles from "./seoArticle.module.css";

export default function SeoArticle({ eyebrow, title, description, summary, sections, references = [], related = [] }) {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="パンくずリスト">
        <Link href="/">ホーム</Link><span>›</span><Link href="/guide">ボートレースガイド</Link><span>›</span><span>{title}</span>
      </nav>

      <article className={styles.article}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        <section className={styles.summary}>
          <span>最初に結論</span>
          <strong>{summary}</strong>
        </section>

        <nav className={styles.toc} aria-label="この記事の内容">
          <strong>この記事で分かること</strong>
          <ol>{sections.map((section, index) => <li key={section.title}><a href={`#section-${index + 1}`}>{section.title}</a></li>)}</ol>
        </nav>

        <div className={styles.body}>
          {sections.map((section, index) => (
            <section className={styles.section} id={`section-${index + 1}`} key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.subsections?.map((subsection) => (
                <div key={subsection.title}>
                  <h3>{subsection.title}</h3>
                  {subsection.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              ))}
              {section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
              {section.point && <aside className={styles.point}>{section.point}</aside>}
            </section>
          ))}
        </div>

        <section className={styles.related}>
          <h2>関連して読む</h2>
          <div>{related.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}</div>
        </section>

        {references.length > 0 && (
          <section className={styles.references}>
            <h2>参考情報</h2>
            <p>制度や基本ルールはBOAT RACE公式情報を確認したうえで構成しています。</p>
            <ul>{references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a></li>)}</ul>
          </section>
        )}

        <aside className={styles.notice}>
          <strong>注意事項</strong>
          <p>舟券の購入は20歳になってから。掲載内容はレースの見方を学ぶための情報で、的中や利益を保証するものではありません。無理のない範囲でお楽しみください。</p>
        </aside>

        <footer className={styles.editorial}>
          <span>編集：BoatStrikers編集部</span>
          <time dateTime="2026-09-07">更新日：2026年9月7日</time>
        </footer>
      </article>
    </main>
  );
}

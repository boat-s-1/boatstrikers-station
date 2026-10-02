import Link from "next/link";
import GuideChapter from "./GuideChapter";
import { GuideCast, GuideTalk } from "./GuideConversation";
import { spokenText } from "./spokenText";
import styles from "./seoArticle.module.css";

export default function SeoArticle({ topic, eyebrow, title, description, summary, sections, references = [], related = [] }) {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="パンくずリスト">
        <Link href="/">ホーム</Link><span>›</span><Link href="/guide">ボートレースガイド</Link><span>›</span><span>{title}</span>
      </nav>

      <article className={styles.article}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <GuideCast />
          <GuideTalk character="hatsune" pose="welcome"><p>{description}</p></GuideTalk>
        </header>

        <section className={styles.summary}>
          <span>最初に結論</span>
          <GuideTalk character="ichika" pose="recap"><p>{spokenText(summary, "ichika")}</p></GuideTalk>
          <GuideTalk character="kiina" pose="ask"><p>言葉の意味だけじゃなく、実際にどこを見ればいいかも知りたいな！</p></GuideTalk>
        </section>

        <nav className={styles.toc} aria-label="この記事の内容">
          <strong>この記事で分かること</strong>
          <ol>{sections.map((section, index) => <li key={section.title}><a href={`#section-${index + 1}`}>{section.title}</a></li>)}</ol>
        </nav>

        <div className={styles.body}>
          {sections.map((section, index) => (
            <GuideChapter key={section.title} section={section} index={index} topic={topic} nextTitle={sections[index + 1]?.title} />
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
          <GuideTalk character="hatsune" pose="think"><p>舟券の購入は20歳になってから。掲載内容はレースの見方を学ぶための情報で、的中や利益を保証するものではありません。無理のない範囲でお楽しみください。</p></GuideTalk>
        </aside>

        <footer className={styles.editorial}>
          <span>編集：BoatStrikers編集部</span>
          <time dateTime="2026-09-07">更新日：2026年9月7日</time>
        </footer>
      </article>
    </main>
  );
}

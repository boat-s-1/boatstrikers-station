import styles from "./BookArticle.module.css";

export default function BookArticle({ article }) {
  if (!article) return null;

  return (
    <section className={styles.article} aria-label="本の詳しい解説">
      <div className={styles.heading}>
        <span>TEXT GUIDE</span>
        <h2>{article.kicker || "詳しい解説"}</h2>
        {article.lead ? <p>{article.lead}</p> : null}
      </div>
      <div className={styles.sections}>
        {(article.sections || []).map((section, index) => (
          <article className={styles.card} key={`${section.heading}-${index}`}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

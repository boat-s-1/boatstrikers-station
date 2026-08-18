import Link from "next/link";
import Image from "next/image";
import styles from "./SeminarMagazineShelf.module.css";

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(value));
}

export default function SeminarMagazineShelf({ magazine }) {
  return (
    <main className={`${styles.page} ${styles[magazine.accent]}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>BOAT<br /><span>STRIKERS</span></Link>
        <Link href="/library" className={styles.libraryLink}>図書館へ戻る</Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCoverWrap}>
          <Image src={magazine.hero} alt={magazine.name} fill sizes="(max-width: 720px) 38vw, 230px" className={styles.heroCover} priority />
        </div>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{magazine.eyebrow}</span>
          <h1>{magazine.name}</h1>
          <p>{magazine.description}</p>
          <div className={styles.swipeNote}>表紙をタップして読む →</div>
        </div>
      </section>

      <section className={styles.shelfSection}>
        <div className={styles.sectionTitle}>
          <div>
            <span>MAGAZINE ARCHIVE</span>
            <h2>バックナンバー</h2>
          </div>
          <p>{magazine.issues.length}冊</p>
        </div>

        <div className={styles.grid}>
          {magazine.issues.map((issue, index) => (
            <Link href={`/library/${magazine.slug}/${issue.id}`} className={styles.issueCard} key={issue.id}>
              <div className={styles.coverWrap}>
                {index === 0 && <span className={styles.newBadge}>NEW</span>}
                <Image src={issue.cover} alt={`${magazine.name} ${issue.number}`} fill sizes="(max-width: 640px) 44vw, 220px" className={styles.cover} />
                <span className={styles.readBadge}>読む</span>
              </div>
              <div className={styles.issueInfo}>
                <span>{issue.number}</span>
                <h3>{issue.title}</h3>
                <time>{formatDate(issue.date)}</time>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.guide}>
        <strong>雑誌の読み方</strong>
        <p>表紙をタップするとビューアが開きます。スマホは左右スワイプ、PCは左右ボタン・矢印キーでページを送れます。</p>
      </section>
    </main>
  );
}

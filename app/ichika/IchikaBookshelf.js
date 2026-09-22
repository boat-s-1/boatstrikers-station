import Link from "next/link";
import styles from "./IchikaBookshelf.module.css";

const BOOKS = [
  {
    title: "一果予想新聞",
    subtitle: "前日版・直前版",
    href: "/library/news/ichika",
    cover: "/C53B3EAC-3CBA-411D-BCFF-4C67354CC424.png",
    tag: "NEWSPAPER",
  },
  {
    title: "一果ゼミ",
    subtitle: "イン逃げ研究",
    href: "/library/ichika-seminar",
    cover: "/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png",
    tag: "SEMINAR",
  },
  {
    title: "イン逃げ攻略",
    subtitle: "1号艇の見方",
    href: "/guide/inside-course",
    cover: "/0624D4E1-6C05-4F40-9439-2A093A1B0F0D.png",
    tag: "GUIDE",
  },
  {
    title: "DATA LAB",
    subtitle: "数字で検証する",
    href: "/data-lab",
    cover: "/A0021C32-58D9-488E-B0E2-F99E8718DB03.png",
    tag: "RESEARCH",
  },
];

export default function IchikaBookshelf() {
  return (
    <section className={styles.section} aria-labelledby="ichika-bookshelf-title">
      <div className={styles.heading}>
        <div>
          <span>ICHIKA RESEARCH SHELF</span>
          <h2 id="ichika-bookshelf-title">一果の研究書棚</h2>
          <p>新聞・ゼミ・攻略・検証を、本棚から選ぶように読めます。</p>
        </div>
        <small>横にスワイプ →</small>
      </div>

      <div className={styles.shelfViewport}>
        <div className={styles.shelfTrack}>
          {BOOKS.map((book) => (
            <Link className={styles.book} href={book.href} key={book.title}>
              <div className={styles.bookCover}>
                <img src={book.cover} alt={book.title} />
                <span>{book.tag}</span>
              </div>
              <div className={styles.bookMeta}>
                <strong>{book.title}</strong>
                <small>{book.subtitle}</small>
              </div>
            </Link>
          ))}
        </div>
        <div className={styles.woodShelf} aria-hidden="true">
          <div className={styles.shelfTop} />
          <div className={styles.shelfFront} />
        </div>
      </div>

      <div className={styles.note}>
        <strong>デザイン確認用</strong>
        <p>現在は既存ページへリンクしています。見た目が良ければ、今後は一果専用の新聞・研究・検証記事をこの棚にまとめる想定です。</p>
      </div>
    </section>
  );
}

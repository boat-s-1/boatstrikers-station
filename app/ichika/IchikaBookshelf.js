import Link from "next/link";
import styles from "./IchikaBookshelf.module.css";

const BOOKS = [
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
  {
    title: "教えて！一果センセー",
    subtitle: "初心者向け講座",
    href: "/ichika-sensei",
    cover: "/59F96330-6F99-4736-8083-6D6508FCD861.png",
    tag: "BEGINNER",
  },
];

export default function IchikaBookshelf() {
  return (
    <section className={styles.section} aria-label="一果の研究書棚">
      <div className={styles.bannerCrop}>
        <img
          src="/D38AD8E9-7516-494E-AD62-0F830BBCC4EE.png"
          alt="一果の研究書棚"
          className={styles.banner}
        />
      </div>
      <div className={styles.heading}>
        <p>ゼミ・攻略・検証・初心者講座を、本棚から選ぶように読めます。</p>
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

    </section>
  );
}

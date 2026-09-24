"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./IchikaBookshelf.module.css";

const BOOKS = [
  {
    title: "イン逃げゼミ",
    subtitle: "イン逃げ研究",
    href: "/library/ichika-seminar",
    cover: "/ichika-book-innige-zemi.svg",
    tag: "SEMINAR",
  },
  {
    title: "一果センセー",
    subtitle: "初心者向け講座",
    href: "/ichika-sensei",
    cover: "/ichika-book-sensei.svg",
    tag: "BEGINNER",
  },
  {
    title: "インツヨ名鑑",
    subtitle: "1号艇の見方",
    href: "/guide/inside-course",
    cover: "/ichika-book-intsuyo-meikan.svg",
    tag: "MEIKAN",
  },
  {
    title: "DATE LAB",
    subtitle: "数字で検証する",
    href: "/data-lab",
    cover: "/ichika-book-date-lab.svg",
    tag: "RESEARCH",
  },
];

export default function IchikaBookshelf() {
  const router = useRouter();
  const [openingHref, setOpeningHref] = useState(null);

  const openBook = (event, href) => {
    event.preventDefault();
    if (openingHref) return;

    setOpeningHref(href);
    window.setTimeout(() => {
      router.push(href);
    }, 1200);
  };

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
        <p>ゼミ・講座・名鑑・データ研究を、本棚から選ぶように読めます。</p>
        <small>横にスワイプ →</small>
      </div>

      <div className={styles.shelfViewport}>
        <div className={styles.shelfTrack}>
          {BOOKS.map((book) => {
            const isOpening = openingHref === book.href;

            return (
              <a
                className={`${styles.book} ${isOpening ? styles.openBook : ""}`}
                href={book.href}
                onClick={(event) => openBook(event, book.href)}
                aria-label={`${book.title}を開く`}
                aria-busy={isOpening}
                key={book.title}
              >
                <div className={styles.openPage} aria-hidden="true">
                  <span>📖</span>
                  <b>OPEN...</b>
                </div>
                <div className={styles.bookCover}>
                  <img src={book.cover} alt={book.title} />
                  <span>{book.tag}</span>
                </div>
                <div className={styles.bookMeta}>
                  <strong>{book.title}</strong>
                  <small>{book.subtitle}</small>
                </div>
              </a>
            );
          })}
        </div>
        <div className={styles.woodShelf} aria-hidden="true">
          <div className={styles.shelfTop} />
          <div className={styles.shelfFront} />
        </div>
      </div>
    </section>
  );
}

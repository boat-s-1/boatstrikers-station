"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

export default function MagazineSwipeViewer({ magazine, issue }) {
  const [page, setPage] = useState(0);
  const scroller = useRef(null);
  const slides = issue.freePages || [];
  const totalSlides = slides.length;

  const goTo = useCallback((next) => {
    if (!totalSlides) return;
    const target = Math.max(0, Math.min(totalSlides - 1, next));
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setPage(target);
  }, [totalSlides]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft") goTo(page - 1);
      if (event.key === "ArrowRight") goTo(page + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, goTo]);

  const handleScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const nextPage = Math.round(el.scrollLeft / el.clientWidth);
    if (nextPage !== page) setPage(nextPage);
  };

  if (!totalSlides) {
    return (
      <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
        <header className={styles.topbar}>
          <Link href={`/library/${magazine.slug}`} className={styles.back}>‹ 一覧</Link>
          <div className={styles.title}><strong>{magazine.shortName}</strong><span>{issue.number}</span></div>
        </header>
        <div className={styles.stage}><p>この号の画像はまだ登録されていません。</p></div>
      </main>
    );
  }

  return (
    <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
      <header className={styles.topbar}>
        <Link href={`/library/${magazine.slug}`} className={styles.back}>‹ 一覧</Link>
        <div className={styles.title}>
          <strong>{magazine.shortName}</strong>
          <span>{issue.number}</span>
        </div>
        <span className={styles.counter}>{page + 1} / {totalSlides}</span>
      </header>

      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          aria-label="前のページ"
        >‹</button>

        <div className={styles.scroller} ref={scroller} onScroll={handleScroll}>
          {slides.map((src, index) => (
            <section className={styles.slide} key={`${src}-${index}`}>
              <div className={styles.pagePaper}>
                <Image
                  src={src}
                  alt={`${issue.title} ${index + 1}ページ`}
                  fill
                  sizes="(max-width: 800px) 100vw, 760px"
                  className={styles.pageImage}
                  priority={index === 0}
                />
              </div>
            </section>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          onClick={() => goTo(page + 1)}
          disabled={page === totalSlides - 1}
          aria-label="次のページ"
        >›</button>
      </div>

      <footer className={styles.controls}>
        <div className={styles.dots}>
          {slides.map((_, index) => (
            <button
              type="button"
              key={index}
              className={index === page ? styles.activeDot : ""}
              onClick={() => goTo(index)}
              aria-label={`${index + 1}ページへ`}
            />
          ))}
        </div>
        <p>← 左右にスワイプ →</p>
      </footer>
    </main>
  );
}

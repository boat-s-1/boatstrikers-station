"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

export default function MagazineSwipeViewer({ magazine, issue }) {
  const [page, setPage] = useState(0);
  const scroller = useRef(null);
  const totalSlides = issue.pages.length + 1;

  const goTo = useCallback((next) => {
    const target = Math.max(0, Math.min(totalSlides - 1, next));
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setPage(target);
  }, [totalSlides]);

  useEffect(() => {
    const key = (event) => {
      if (event.key === "ArrowLeft") goTo(page - 1);
      if (event.key === "ArrowRight") goTo(page + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [page, goTo]);

  const handleScroll = () => {
    const el = scroller.current;
    if (!el?.clientWidth) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
      <header className={styles.topbar}>
        <Link href={`/library/${magazine.slug}`} className={styles.back}>‹ 一覧</Link>
        <div className={styles.title}><strong>{magazine.shortName}</strong><span>{issue.number}</span></div>
        <span className={styles.counter}>{page + 1} / {totalSlides}</span>
      </header>

      <div className={styles.stage}>
        <button className={`${styles.arrow} ${styles.left}`} onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="前のページ">‹</button>

        <div className={styles.scroller} ref={scroller} onScroll={handleScroll}>
          {issue.pages.map((src, index) => (
            <section className={styles.slide} key={`${src}-${index}`}>
              <div className={styles.pagePaper}>
                <Image src={src} alt={`${issue.title} ${index + 1}ページ`} fill sizes="(max-width: 800px) 100vw, 760px" className={styles.pageImage} priority={index === 0} />
              </div>
            </section>
          ))}

          <section className={styles.slide}>
            <div className={styles.lockPage}>
              <div className={styles.lockIcon}>🔒</div>
              <span>MEMBERS ONLY</span>
              <h2>ここから先は<br />BoatStrikers Premium</h2>
              <p>この先のページはメンバー限定で公開するためのロック画面です。</p>
              <div className={styles.benefits}>
                <b>この号の続き</b>
                <small>詳細データ・実戦での考え方・注目ポイント</small>
              </div>
              <button type="button" className={styles.memberButton}>メンバー認証（次段階で接続）</button>
              <Link href={`/library/${magazine.slug}`} className={styles.returnLink}>バックナンバーへ戻る</Link>
            </div>
          </section>
        </div>

        <button className={`${styles.arrow} ${styles.right}`} onClick={() => goTo(page + 1)} disabled={page === totalSlides - 1} aria-label="次のページ">›</button>
      </div>

      <footer className={styles.controls}>
        <div className={styles.dots}>
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button key={index} className={index === page ? styles.activeDot : ""} onClick={() => goTo(index)} aria-label={`${index + 1}ページへ`} />
          ))}
        </div>
        <p>← 左右にスワイプ →</p>
      </footer>
    </main>
  );
}

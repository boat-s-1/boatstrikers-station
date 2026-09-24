"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

export default function BookSwipeViewer({ series, issue }) {
  const pages = issue.freePages || [];
  const [page, setPage] = useState(0);
  const scroller = useRef(null);
  const total = pages.length;
  const progress = total ? ((page + 1) / total) * 100 : 0;

  const goTo = useCallback((next) => {
    if (!total) return;
    const target = Math.max(0, Math.min(total - 1, next));
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setPage(target);
  }, [total]);

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
    if (!el?.clientWidth) return;
    const nextPage = Math.round(el.scrollLeft / el.clientWidth);
    if (nextPage !== page) setPage(nextPage);
  };

  return (
    <main className={`${styles.viewer} ${styles[series.accent]}`}>
      <header className={styles.topbar}>
        <Link href={series.basePath} className={styles.back}>← 本の一覧</Link>
        <div className={styles.titleBlock}><span>{issue.number}</span><strong>{issue.title}</strong></div>
        <span className={styles.counter}>{String(page + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
      </header>
      <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <div className={styles.stage}>
        <button type="button" className={`${styles.arrow} ${styles.left}`} onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="前のページ"><span>‹</span><small>PREV</small></button>
        <div className={styles.scroller} ref={scroller} onScroll={handleScroll}>
          {pages.map((src, index) => (
            <section className={styles.slide} key={`${src}-${index}`} aria-label={`${index + 1}ページ目`}>
              <div className={styles.pageWrap}>
                <div className={styles.pagePaper}><img src={src} alt={`${issue.title} ${index + 1}ページ`} className={styles.pageImage} /></div>
                <div className={styles.pageNumber}>{index + 1}</div>
              </div>
            </section>
          ))}
        </div>
        <button type="button" className={`${styles.arrow} ${styles.right}`} onClick={() => goTo(page + 1)} disabled={page === total - 1} aria-label="次のページ"><span>›</span><small>NEXT</small></button>
      </div>
      <footer className={styles.controls}>
        <div className={styles.controlMain}>
          <button type="button" className={styles.mobileNav} onClick={() => goTo(page - 1)} disabled={page === 0}>‹</button>
          <div className={styles.centerControls}>
            <div className={styles.dots}>{pages.map((_, index) => <button type="button" key={index} className={index === page ? styles.activeDot : ""} onClick={() => goTo(index)} aria-label={`${index + 1}ページへ`} />)}</div>
            <p>左右にスワイプしてマンガを読めます</p>
          </div>
          <button type="button" className={styles.mobileNav} onClick={() => goTo(page + 1)} disabled={page === total - 1}>›</button>
        </div>
      </footer>
    </main>
  );
}

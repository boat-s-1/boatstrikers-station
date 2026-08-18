"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

export default function MagazineSwipeViewer({ magazine, issue }) {
  const [page, setPage] = useState(0);
  const scroller = useRef(null);
  const slides = issue.freePages || [];
  const freeCount = slides.length;
  const hasPremiumGate = freeCount > 0;
  const totalSlides = freeCount + (hasPremiumGate ? 1 : 0);
  const premiumGateIndex = freeCount;
  const isPremiumGate = hasPremiumGate && page === premiumGateIndex;
  const progress = totalSlides ? ((page + 1) / totalSlides) * 100 : 0;
  const membershipUrl = issue.membershipUrl || magazine.membershipUrl || null;

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

  if (!freeCount) {
    return (
      <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
        <header className={styles.topbar}>
          <Link href={`/library/${magazine.slug}`} className={styles.back}>← 雑誌一覧</Link>
          <div className={styles.titleBlock}>
            <span>{issue.number}</span>
            <strong>{issue.title || magazine.shortName}</strong>
          </div>
          <span className={styles.counter}>-- / --</span>
        </header>
        <div className={styles.emptyStage}>
          <div className={styles.emptyCard}>
            <span>BOATSTRIKERS MAGAZINE</span>
            <h2>この号の画像はまだ登録されていません。</h2>
            <Link href={`/library/${magazine.slug}`}>雑誌一覧へ戻る</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
      <header className={styles.topbar}>
        <Link href={`/library/${magazine.slug}`} className={styles.back}>← 雑誌一覧</Link>
        <div className={styles.titleBlock}>
          <span>{issue.number}</span>
          <strong>{issue.title || magazine.shortName}</strong>
        </div>
        <span className={styles.counter}>{String(page + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}</span>
      </header>

      <div className={styles.progressTrack} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          aria-label="前のページ"
        >
          <span>‹</span>
          <small>PREV</small>
        </button>

        <div className={styles.scroller} ref={scroller} onScroll={handleScroll}>
          {slides.map((src, index) => (
            <section className={styles.slide} key={`${src}-${index}`} aria-label={`${index + 1}ページ目`}>
              <div className={styles.pageWrap}>
                <div className={styles.pagePaper}>
                  <Image
                    src={src}
                    alt={`${issue.title} ${index + 1}ページ`}
                    fill
                    sizes="(max-width: 800px) 96vw, 760px"
                    className={styles.pageImage}
                    priority={index === 0}
                  />
                </div>
                <div className={styles.pageNumber}>{index + 1}</div>
              </div>
            </section>
          ))}

          <section className={`${styles.slide} ${styles.premiumSlide}`} aria-label="Premium案内">
            <div className={styles.premiumGate}>
              <div className={styles.premiumLock}>🔒</div>
              <span className={styles.premiumEyebrow}>BOATSTRIKERS PREMIUM</span>
              <h2>ここから先は<br />メンバー限定です</h2>
              <p>
                無料公開はここまでです。<br />
                続きの詳しいデータ・狙い方・実戦ポイントは、Premium版で公開します。
              </p>

              <div className={styles.premiumBenefits}>
                <span>✓ 詳細データ</span>
                <span>✓ 狙い条件</span>
                <span>✓ 実戦ポイント</span>
              </div>

              {membershipUrl ? (
                <a className={styles.premiumButton} href={membershipUrl} target="_blank" rel="noreferrer">
                  メンバーシップを見る
                </a>
              ) : (
                <div className={styles.premiumButtonMuted}>メンバーシップ連携は次の段階で追加</div>
              )}

              <Link className={styles.premiumBack} href={`/library/${magazine.slug}`}>雑誌一覧へ戻る</Link>
              <small className={styles.premiumNote}>※この画面では認証処理を行わないため、既存ビューアの安定動作に影響しません。</small>
            </div>
          </section>
        </div>

        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          onClick={() => goTo(page + 1)}
          disabled={page === totalSlides - 1}
          aria-label="次のページ"
        >
          <span>›</span>
          <small>NEXT</small>
        </button>
      </div>

      <footer className={styles.controls}>
        <div className={styles.controlMain}>
          <button type="button" className={styles.mobileNav} onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="前のページ">‹</button>

          <div className={styles.centerControls}>
            <div className={styles.dots} aria-label="ページ選択">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  type="button"
                  key={index}
                  className={index === page ? styles.activeDot : ""}
                  onClick={() => goTo(index)}
                  aria-label={index === premiumGateIndex ? "Premium案内へ" : `${index + 1}ページへ`}
                />
              ))}
            </div>
            <p>{isPremiumGate ? "この先はPremiumコンテンツです" : "左右にスワイプしてページをめくれます"}</p>
          </div>

          <button type="button" className={styles.mobileNav} onClick={() => goTo(page + 1)} disabled={page === totalSlides - 1} aria-label="次のページ">›</button>
        </div>
      </footer>
    </main>
  );
}

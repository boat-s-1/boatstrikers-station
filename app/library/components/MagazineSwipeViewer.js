"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

export default function MagazineSwipeViewer({ magazine, issue }) {
  const [page, setPage] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    let active = true;
    fetch("/api/magazine-auth", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setAuthenticated(Boolean(data.authenticated));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthChecked(true);
      });
    return () => { active = false; };
  }, []);

  const premiumPages = useMemo(() => {
    if (!authenticated) return [];
    return Array.from({ length: issue.premiumPageCount }, (_, index) => {
      const pageNumber = issue.freePages.length + index + 1;
      return `/api/magazine-page?magazine=${encodeURIComponent(magazine.key)}&issue=${encodeURIComponent(issue.id)}&page=${pageNumber}`;
    });
  }, [authenticated, issue.freePages.length, issue.id, issue.premiumPageCount, magazine.key]);

  const slides = useMemo(() => {
    const free = issue.freePages.map((src, index) => ({ type: "page", src, pageNumber: index + 1, premium: false }));
    if (!authenticated) return [...free, { type: "lock" }];
    return [
      ...free,
      ...premiumPages.map((src, index) => ({
        type: "page",
        src,
        pageNumber: issue.freePages.length + index + 1,
        premium: true
      }))
    ];
  }, [authenticated, issue.freePages, premiumPages]);

  const totalSlides = slides.length;

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

  useEffect(() => {
    if (page > totalSlides - 1) goTo(totalSlides - 1);
  }, [page, totalSlides, goTo]);

  const handleScroll = () => {
    const el = scroller.current;
    if (!el?.clientWidth) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const unlock = async (event) => {
    event.preventDefault();
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch("/api/magazine-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "認証に失敗しました。");

      setAuthenticated(true);
      setPassword("");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => goTo(issue.freePages.length));
      });
    } catch (error) {
      setAuthError(error.message || "認証に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const currentLabel = slides[page]?.type === "lock"
    ? `${issue.freePages.length + 1} / ${issue.freePages.length + issue.premiumPageCount}`
    : `${slides[page]?.pageNumber || 1} / ${issue.freePages.length + issue.premiumPageCount}`;

  return (
    <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
      <header className={styles.topbar}>
        <Link href={`/library/${magazine.slug}`} className={styles.back}>‹ 一覧</Link>
        <div className={styles.title}>
          <strong>{magazine.shortName}</strong>
          <span>{issue.number}{authenticated ? " · PREMIUM OPEN" : ""}</span>
        </div>
        <span className={styles.counter}>{currentLabel}</span>
      </header>

      <div className={styles.stage}>
        <button className={`${styles.arrow} ${styles.left}`} onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="前のページ">‹</button>

        <div className={styles.scroller} ref={scroller} onScroll={handleScroll}>
          {slides.map((slide, index) => {
            if (slide.type === "lock") {
              return (
                <section className={styles.slide} key="premium-lock">
                  <div className={styles.lockPage}>
                    <div className={styles.lockIcon}>🔒</div>
                    <span>BOATSTRIKERS PREMIUM</span>
                    <h2>ここから先は<br />メンバー限定です</h2>
                    <p>4ページまでは無料で読めます。メンバーの方はパスワードを入力すると、この号の続きがすべて解放されます。</p>
                    <div className={styles.benefits}>
                      <b>この号のPremiumページ</b>
                      <small>残り {issue.premiumPageCount} ページを横スワイプで閲覧できます</small>
                    </div>

                    {!authChecked ? (
                      <div className={styles.checking}>メンバー状態を確認しています…</div>
                    ) : (
                      <form className={styles.passwordForm} onSubmit={unlock}>
                        <label htmlFor="magazine-password">メンバーパスワード</label>
                        <div className={styles.passwordRow}>
                          <input
                            id="magazine-password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="パスワードを入力"
                            autoComplete="current-password"
                          />
                          <button type="submit" disabled={submitting || !password.trim()}>
                            {submitting ? "確認中…" : "続きを読む"}
                          </button>
                        </div>
                        {authError ? <p className={styles.authError}>{authError}</p> : null}
                      </form>
                    )}

                    <p className={styles.memberGuide}>パスワードはYouTubeメンバー限定投稿などで案内する想定です。</p>
                    <Link href={`/library/${magazine.slug}`} className={styles.returnLink}>バックナンバーへ戻る</Link>
                  </div>
                </section>
              );
            }

            return (
              <section className={styles.slide} key={`${slide.src}-${index}`}>
                <div className={styles.pagePaper}>
                  {slide.premium ? <span className={styles.premiumBadge}>PREMIUM</span> : null}
                  <Image
                    src={slide.src}
                    alt={`${issue.title} ${slide.pageNumber}ページ`}
                    fill
                    unoptimized={slide.premium}
                    sizes="(max-width: 800px) 100vw, 760px"
                    className={styles.pageImage}
                    priority={slide.pageNumber === 1}
                  />
                </div>
              </section>
            );
          })}
        </div>

        <button className={`${styles.arrow} ${styles.right}`} onClick={() => goTo(page + 1)} disabled={page === totalSlides - 1} aria-label="次のページ">›</button>
      </div>

      <footer className={styles.controls}>
        <div className={styles.dots}>
          {slides.map((_, index) => (
            <button key={index} className={index === page ? styles.activeDot : ""} onClick={() => goTo(index)} aria-label={`${index + 1}ページへ`} />
          ))}
        </div>
        <p>← 左右にスワイプ →</p>
      </footer>
    </main>
  );
}

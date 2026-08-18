"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

export default function MagazineSwipeViewer({ magazine, issue }) {
  const [page, setPage] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [authState, setAuthState] = useState("idle");
  const [authMessage, setAuthMessage] = useState("");
  const scroller = useRef(null);

  const freePages = issue.freePages || [];
  const freeCount = freePages.length;
  const premiumStartPage = Number(issue.premiumStartPage || freeCount + 1);
  const premiumCount = Number(issue.premiumPageCount || 0);
  const hasPremium = premiumCount > 0;
  const lockedTotal = freeCount + (hasPremium ? 1 : 0);
  const unlockedTotal = freeCount + premiumCount;
  const totalSlides = unlocked ? unlockedTotal : lockedTotal;
  const gateIndex = freeCount;
  const isGate = !unlocked && hasPremium && page === gateIndex;
  const progress = totalSlides ? ((page + 1) / totalSlides) * 100 : 0;

  const premiumPages = Array.from({ length: premiumCount }, (_, index) => {
    const pageNumber = premiumStartPage + index;
    return {
      pageNumber,
      src: `/api/magazine-premium-page?magazine=${encodeURIComponent(magazine.key)}&issue=${encodeURIComponent(issue.id)}&page=${pageNumber}`,
    };
  });

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

  const unlock = async (event) => {
    event.preventDefault();
    if (!password || authState === "loading") return;

    setAuthState("loading");
    setAuthMessage("");

    try {
      const response = await fetch("/api/magazine-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        setAuthState("error");
        setAuthMessage(result.message || "認証できませんでした。");
        return;
      }

      setUnlocked(true);
      setAuthState("success");
      setAuthMessage("認証しました。続きを表示します。");
      setPassword("");
      requestAnimationFrame(() => {
        const el = scroller.current;
        if (!el) return;
        el.scrollTo({ left: gateIndex * el.clientWidth, behavior: "auto" });
        setPage(gateIndex);
      });
    } catch (error) {
      console.error("[MagazineSwipeViewer unlock]", error);
      setAuthState("error");
      setAuthMessage("通信エラーが発生しました。もう一度お試しください。");
    }
  };

  if (!freeCount) {
    return (
      <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
        <header className={styles.topbar}>
          <Link href={`/library/${magazine.slug}`} className={styles.back}>← 雑誌一覧</Link>
          <div className={styles.titleBlock}><span>{issue.number}</span><strong>{issue.title || magazine.shortName}</strong></div>
          <span className={styles.counter}>-- / --</span>
        </header>
        <div className={styles.emptyStage}><div className={styles.emptyCard}><span>BOATSTRIKERS MAGAZINE</span><h2>この号の画像はまだ登録されていません。</h2><Link href={`/library/${magazine.slug}`}>雑誌一覧へ戻る</Link></div></div>
      </main>
    );
  }

  return (
    <main className={`${styles.viewer} ${styles[magazine.accent]}`}>
      <header className={styles.topbar}>
        <Link href={`/library/${magazine.slug}`} className={styles.back}>← 雑誌一覧</Link>
        <div className={styles.titleBlock}><span>{issue.number}</span><strong>{issue.title || magazine.shortName}</strong></div>
        <span className={styles.counter}>{String(page + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}</span>
      </header>

      <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

      <div className={styles.stage}>
        <button type="button" className={`${styles.arrow} ${styles.left}`} onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="前のページ"><span>‹</span><small>PREV</small></button>

        <div className={styles.scroller} ref={scroller} onScroll={handleScroll}>
          {freePages.map((src, index) => (
            <section className={styles.slide} key={`${src}-${index}`} aria-label={`${index + 1}ページ目`}>
              <div className={styles.pageWrap}>
                <div className={styles.pagePaper}>
                  <Image src={src} alt={`${issue.title} ${index + 1}ページ`} fill sizes="(max-width: 800px) 96vw, 760px" className={styles.pageImage} priority={index === 0} />
                </div>
                <div className={styles.pageNumber}>{index + 1}</div>
              </div>
            </section>
          ))}

          {!unlocked && hasPremium && (
            <section className={`${styles.slide} ${styles.premiumSlide}`} aria-label="Premium認証">
              <div className={styles.premiumGate}>
                <div className={styles.premiumLock}>🔒</div>
                <span className={styles.premiumEyebrow}>BOATSTRIKERS PREMIUM</span>
                <h2>ここから先は<br />メンバー限定です</h2>
                <p>メンバーの方は、案内されたパスワードを入力すると続きを読めます。</p>

                <form className={styles.unlockForm} onSubmit={unlock}>
                  <label htmlFor="magazine-password">閲覧パスワード</label>
                  <div className={styles.unlockRow}>
                    <input id="magazine-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="パスワードを入力" />
                    <button type="submit" disabled={!password || authState === "loading"}>{authState === "loading" ? "確認中…" : "続きを読む"}</button>
                  </div>
                  {authMessage && <div className={`${styles.authMessage} ${authState === "error" ? styles.authError : styles.authSuccess}`}>{authMessage}</div>}
                </form>

                <div className={styles.premiumBenefits}><span>✓ Premiumページを解放</span><span>✓ 認証Cookieは31日間有効</span><span>✓ Premium画像は非公開領域から配信</span></div>
                <Link className={styles.premiumBack} href={`/library/${magazine.slug}`}>雑誌一覧へ戻る</Link>
              </div>
            </section>
          )}

          {unlocked && premiumPages.map(({ src, pageNumber }) => (
            <section className={styles.slide} key={`premium-${pageNumber}`} aria-label={`${pageNumber}ページ目`}>
              <div className={styles.pageWrap}>
                <div className={styles.pagePaper}>
                  {/* Protected images are intentionally loaded directly so the browser sends the auth cookie. */}
                  <img src={src} alt={`${issue.title} ${pageNumber}ページ`} className={styles.protectedImage} />
                </div>
                <div className={styles.pageNumber}>{pageNumber}</div>
              </div>
            </section>
          ))}
        </div>

        <button type="button" className={`${styles.arrow} ${styles.right}`} onClick={() => goTo(page + 1)} disabled={page === totalSlides - 1} aria-label="次のページ"><span>›</span><small>NEXT</small></button>
      </div>

      <footer className={styles.controls}>
        <div className={styles.controlMain}>
          <button type="button" className={styles.mobileNav} onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="前のページ">‹</button>
          <div className={styles.centerControls}>
            <div className={styles.dots} aria-label="ページ選択">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button type="button" key={index} className={index === page ? styles.activeDot : ""} onClick={() => goTo(index)} aria-label={`${index + 1}ページへ`} />
              ))}
            </div>
            <p>{isGate ? "パスワード認証で続きを読めます" : unlocked && page >= freeCount ? "Premiumコンテンツ" : "左右にスワイプしてページをめくれます"}</p>
          </div>
          <button type="button" className={styles.mobileNav} onClick={() => goTo(page + 1)} disabled={page === totalSlides - 1} aria-label="次のページ">›</button>
        </div>
      </footer>
    </main>
  );
}

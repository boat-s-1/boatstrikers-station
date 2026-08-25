"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./MagazineSwipeViewer.module.css";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function MagazineSwipeViewer({ magazine, issue }) {
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [page, setPage] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [memberState, setMemberState] = useState("checking");
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
      src: `/api/magazine-premium-page?magazine=${encodeURIComponent(magazine.key)}&issue=${encodeURIComponent(issue.id)}&page=${pageNumber}&source=${encodeURIComponent(issue.source || "local")}`,
    };
  });

  const syncMembership=useCallback(async()=>{
    try{
      let headers={};
      if(supabase){
        const {data}=await supabase.auth.getSession();
        const token=data.session?.access_token;
        if(token){
          headers={Authorization:`Bearer ${token}`};
          await fetch("/api/members/session",{method:"POST",headers,cache:"no-store"});
        }
      }
      const response=await fetch("/api/members/entitlement",{headers,cache:"no-store"});
      const result=await response.json().catch(()=>({}));
      if(result.plus){setUnlocked(true);setMemberState("unlocked");}
      else{setUnlocked(false);setMemberState(result.authenticated?"member-no-access":"locked");}
    }catch(error){
      console.error("[MagazineSwipeViewer membership]",error);
      setUnlocked(false);setMemberState("locked");
    }
  },[supabase]);

  useEffect(()=>{syncMembership();},[syncMembership]);

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

  if (!freeCount && !hasPremium) {
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
                <div className={styles.pagePaper}><img src={src} alt={`${issue.title} ${index + 1}ページ`} className={styles.pageImage} /></div>
                <div className={styles.pageNumber}>{index + 1}</div>
              </div>
            </section>
          ))}

          {!unlocked && hasPremium && (
            <section className={`${styles.slide} ${styles.premiumSlide}`} aria-label="Premium会員限定">
              <div className={styles.premiumGate}>
                <div className={styles.premiumLock}>🔒</div>
                <span className={styles.premiumEyebrow}>BOATSTRIKERS PREMIUM</span>
                <h2>ここから先は<br />会員限定です</h2>
                {memberState==="checking" ? (
                  <p>会員ステータスを確認しています…</p>
                ) : memberState==="member-no-access" ? (
                  <p>現在の会員プランではこのコンテンツを利用できません。</p>
                ) : (
                  <p>BoatStrikers β会員に無料登録すると、12月31日までPREMIUMページをすべて読めます。</p>
                )}
                <div className={styles.premiumBenefits}>
                  <span>✓ β期間は無料</span><span>✓ 攻略マガジン開放</span><span>✓ 会員限定コンテンツ</span>
                </div>
                {memberState==="checking" ? (
                  <div className={styles.premiumButtonMuted}>確認中…</div>
                ) : (
                  <Link className={styles.premiumButton} href="/members">{memberState==="member-no-access"?"会員情報を確認する":"無料でβ会員登録"}</Link>
                )}
                <Link className={styles.premiumBack} href="/membership">会員特典を見る</Link>
                <div className={styles.premiumNote}>PREMIUM画像は会員認証後のみ非公開領域から配信されます。</div>
              </div>
            </section>
          )}

          {unlocked && premiumPages.map(({ src, pageNumber }) => (
            <section className={styles.slide} key={`premium-${pageNumber}`} aria-label={`${pageNumber}ページ目`}>
              <div className={styles.pageWrap}>
                <div className={styles.pagePaper}><img src={src} alt={`${issue.title} ${pageNumber}ページ`} className={styles.protectedImage} /></div>
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
            <p>{isGate ? "無料会員登録で続きを読めます" : unlocked && page >= freeCount ? "Premiumコンテンツ" : "左右にスワイプしてページをめくれます"}</p>
          </div>
          <button type="button" className={styles.mobileNav} onClick={() => goTo(page + 1)} disabled={page === totalSlides - 1} aria-label="次のページ">›</button>
        </div>
      </footer>
    </main>
  );
}

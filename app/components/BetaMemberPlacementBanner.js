"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CHARACTER_ART = "/beta-membership-characters.jpg";

export default function BetaMemberPlacementBanner() {
  const pathname = usePathname();
  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    if (pathname !== "/" && pathname !== "/races") {
      setMountNode(null);
      return;
    }

    let mount = null;
    let observer = null;
    let homeHero = null;
    let previousHeroDisplay = "";

    const place = () => {
      const target = pathname === "/"
        ? document.querySelector("main.page .hero")
        : document.querySelector("#todays-courses");

      if (!target) return false;

      if (pathname === "/") {
        homeHero = target;
        previousHeroDisplay = homeHero.style.display;
        homeHero.style.display = "none";
      }

      const existing = document.querySelector(`[data-beta-member-placement="${pathname}"]`);
      if (existing) {
        setMountNode(existing);
        return true;
      }

      mount = document.createElement("div");
      mount.dataset.betaMemberPlacement = pathname;
      if (pathname === "/") target.insertAdjacentElement("afterend", mount);
      else target.insertAdjacentElement("beforebegin", mount);
      setMountNode(mount);
      return true;
    };

    if (!place()) {
      observer = new MutationObserver(() => {
        if (place() && observer) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      if (observer) observer.disconnect();
      if (homeHero) homeHero.style.display = previousHeroDisplay;
      if (mount?.parentNode) mount.parentNode.removeChild(mount);
      setMountNode(null);
    };
  }, [pathname]);

  if (!mountNode) return null;
  const isRaces = pathname === "/races";

  return createPortal(
    <div className={`betaMemberWrap ${isRaces ? "isRaces" : ""}`}>
      <section className="betaMemberCard">
        <img className="betaMemberCharacters" src={CHARACTER_ART} alt="" aria-hidden="true" />
        <div className="betaMemberDots" aria-hidden="true" />
        <div className="betaMemberFree">12/31まで無料</div>

        <div className="betaMemberContent">
          <div className="betaMemberEyebrow">BOATSTRIKERS β MEMBERSHIP</div>
          <div className="betaMemberPremium">PREMIUM機能を無料で体験</div>
          <h2>無料で会員登録</h2>
          <p>BS展示・直前版AI・直前買い目など、会員限定機能をβメンバー向けに順次開放します。</p>

          <div className="betaMemberActions">
            <Link href="/members">無料で会員登録 →</Link>
            <Link href="/members?mode=login">ログイン</Link>
          </div>
        </div>

        <style jsx>{`
          .betaMemberWrap{max-width:1120px;margin:10px auto 18px;padding:0 8px;box-sizing:border-box}
          .betaMemberWrap.isRaces{max-width:1180px;margin:18px auto;padding:0 14px}
          .betaMemberCard{position:relative;overflow:hidden;border-radius:28px;color:#fff;background:radial-gradient(circle at 82% 16%,rgba(244,127,255,.52),transparent 28%),radial-gradient(circle at 12% 92%,rgba(0,235,255,.38),transparent 31%),linear-gradient(118deg,#05267e 0%,#0754d6 45%,#7144e6 100%);box-shadow:0 14px 36px rgba(15,63,145,.28);border:1px solid rgba(255,255,255,.35);isolation:isolate}
          .isRaces .betaMemberCard{border-radius:24px}
          .betaMemberDots{position:absolute;inset:0;opacity:.22;background-image:radial-gradient(circle,rgba(255,255,255,.75) 1px,transparent 1.5px);background-size:18px 18px;mask-image:linear-gradient(90deg,#000 0%,transparent 67%);z-index:0}
          .betaMemberCharacters{position:absolute;right:-1%;bottom:-5%;width:47%;height:82%;object-fit:cover;object-position:72% center;opacity:.32;z-index:1;pointer-events:none;filter:saturate(.95) brightness(1.08);mask-image:linear-gradient(90deg,transparent 0%,#000 24%,#000 100%),linear-gradient(0deg,transparent 0%,#000 26%,#000 100%);mask-composite:intersect}
          .betaMemberFree{position:absolute;right:14px;top:14px;z-index:4;padding:8px 13px;border-radius:999px;color:#073b9e;background:linear-gradient(180deg,#fff8a8,#ffd64e);border:2px solid rgba(255,255,255,.9);box-shadow:0 5px 16px rgba(28,34,116,.24);font-size:clamp(13px,2.8vw,18px);font-weight:1000;white-space:nowrap}
          .betaMemberContent{position:relative;z-index:3;padding:26px 28px 22px;max-width:720px}
          .isRaces .betaMemberContent{padding:24px 24px 20px;max-width:700px}
          .betaMemberEyebrow{font-size:clamp(11px,2vw,16px);font-weight:900;letter-spacing:.12em;margin-bottom:8px}
          .betaMemberPremium{display:inline-block;padding-bottom:5px;border-bottom:2px solid rgba(134,245,255,.75);color:#fff8a8;font-size:clamp(15px,3.2vw,24px);font-weight:1000;text-shadow:0 2px 10px rgba(0,0,0,.2)}
          h2{margin:10px 0 8px;font-size:clamp(30px,7vw,58px);line-height:1.05;letter-spacing:-.04em;font-weight:1000;color:#fff;text-shadow:0 4px 14px rgba(0,27,102,.45)}
          p{margin:0;max-width:620px;font-size:clamp(12px,2.5vw,17px);line-height:1.58;font-weight:800;color:rgba(255,255,255,.96)}
          .betaMemberActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
          .betaMemberActions :global(a){display:inline-flex;align-items:center;justify-content:center;padding:12px 20px;min-width:190px;border-radius:16px;background:#fff;color:#0a42a6;box-shadow:0 8px 22px rgba(0,22,92,.22);font-size:clamp(14px,2.8vw,19px);font-weight:1000;text-decoration:none}
          .betaMemberActions :global(a:last-child){min-width:110px;padding:12px 18px;background:rgba(255,255,255,.12);color:#fff;border:2px solid rgba(255,255,255,.82);backdrop-filter:blur(8px)}
          @media(max-width:720px){
            .betaMemberContent{padding:20px 18px 14px;max-width:none}
            .betaMemberCharacters{right:-9%;bottom:-3%;width:62%;height:58%;opacity:.30;object-position:74% center;mask-image:linear-gradient(90deg,transparent 0%,#000 20%,#000 100%),linear-gradient(0deg,transparent 0%,#000 20%,#000 100%);mask-composite:intersect}
            .betaMemberActions{gap:8px;margin-top:12px;flex-wrap:nowrap}
            .betaMemberActions :global(a:first-child){min-width:0;flex:1 1 auto;padding-left:10px;padding-right:10px}
            .betaMemberActions :global(a:last-child){min-width:92px;flex:0 0 auto}
          }
        `}</style>
      </section>
    </div>,
    mountNode
  );
}

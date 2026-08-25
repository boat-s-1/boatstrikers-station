"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const BANNER = "/beta-membership-banner.webp";

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
      <div className="betaMemberImageCard">
        <img
          src={BANNER}
          alt="BoatStrikers β MEMBERSHIP 12月31日まで無料。PREMIUM機能を無料で体験。"
          className="betaMemberImage"
        />
        <div className="betaMemberActionArea">
          <Link className="memberEntryButton" href="/members">
            新規会員登録・会員ログイン <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .betaMemberWrap{max-width:1120px;margin:10px auto 18px;padding:0 8px;box-sizing:border-box}
        .betaMemberWrap.isRaces{max-width:1180px;margin:18px auto;padding:0 14px}
        .betaMemberImageCard{position:relative;overflow:hidden;border-radius:28px;box-shadow:0 14px 36px rgba(15,63,145,.24)}
        .isRaces .betaMemberImageCard{border-radius:24px}
        .betaMemberImage{display:block;width:100%;height:auto;aspect-ratio:1672/941;object-fit:cover}
        .betaMemberActionArea{position:absolute;left:5%;right:5%;bottom:5.8%;display:flex;justify-content:center;z-index:3;pointer-events:none}
        .betaMemberActionArea :global(.memberEntryButton){pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:min(78%,560px);min-height:54px;padding:0 24px;border-radius:999px;background:rgba(255,255,255,.96);color:#1680b8 !important;text-decoration:none !important;font-weight:900;font-size:clamp(14px,2.1vw,19px);line-height:1.2;box-shadow:0 7px 18px rgba(23,88,150,.20);border:1px solid rgba(196,232,249,.95);white-space:nowrap;-webkit-tap-highlight-color:transparent}
        .betaMemberActionArea :global(.memberEntryButton:hover){transform:translateY(-1px);background:#fff}
        .betaMemberActionArea :global(.memberEntryButton:focus-visible){outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px #1aa9df}
        @media(max-width:720px){
          .betaMemberWrap{margin-top:8px;margin-bottom:14px;padding:0 8px}
          .betaMemberWrap.isRaces{margin:14px auto;padding:0 12px}
          .betaMemberImageCard{border-radius:22px}
          .betaMemberActionArea{left:5%;right:5%;bottom:5.2%}
          .betaMemberActionArea :global(.memberEntryButton){width:82%;min-height:46px;padding:0 14px;font-size:clamp(13px,3.5vw,16px);box-shadow:0 5px 14px rgba(23,88,150,.18)}
        }
      `}</style>
    </div>,
    mountNode
  );
}

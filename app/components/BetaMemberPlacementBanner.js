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
          alt="BoatStrikers β MEMBERSHIP 12月31日まで無料。PREMIUM機能を無料で体験。無料で会員登録。"
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
        .betaMemberActionArea{position:absolute;left:4%;right:4%;bottom:6.5%;display:flex;justify-content:flex-start;z-index:3}
        .memberEntryButton{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:56px;padding:0 26px;border-radius:18px;background:#fff;color:#1647b8;text-decoration:none;font-weight:1000;font-size:clamp(14px,2.2vw,20px);box-shadow:0 8px 22px rgba(0,21,92,.28);border:2px solid rgba(255,255,255,.94);white-space:nowrap}
        .memberEntryButton:hover{transform:translateY(-1px)}
        .memberEntryButton:focus-visible{outline:4px solid #fff;outline-offset:3px;box-shadow:0 0 0 7px #0a58ca}
        @media(max-width:720px){
          .betaMemberWrap{margin-top:8px;margin-bottom:14px;padding:0 8px}
          .betaMemberWrap.isRaces{margin:14px auto;padding:0 12px}
          .betaMemberImageCard{border-radius:22px}
          .betaMemberActionArea{left:5%;right:5%;bottom:5.5%}
          .memberEntryButton{width:100%;min-height:48px;padding:0 14px;border-radius:16px;font-size:clamp(13px,3.7vw,16px)}
        }
      `}</style>
    </div>,
    mountNode
  );
}

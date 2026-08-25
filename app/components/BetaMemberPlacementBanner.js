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
        <div className="betaMemberActions">
          <Link href="/members" className="signupButton">無料で会員登録 →</Link>
          <Link href="/members?mode=login" className="loginButton">ログイン</Link>
        </div>
      </div>

      <style jsx>{`
        .betaMemberWrap{max-width:1120px;margin:10px auto 18px;padding:0 8px;box-sizing:border-box}
        .betaMemberWrap.isRaces{max-width:1180px;margin:18px auto;padding:0 14px}
        .betaMemberImageCard{position:relative;overflow:hidden;border-radius:28px;box-shadow:0 14px 36px rgba(15,63,145,.24)}
        .isRaces .betaMemberImageCard{border-radius:24px}
        .betaMemberImage{display:block;width:100%;height:auto;aspect-ratio:1672/941;object-fit:cover}
        .betaMemberActions{position:absolute;left:4.2%;right:4.2%;bottom:6.2%;display:flex;gap:2.2%;align-items:center;z-index:3}
        .betaMemberActions :global(a){display:inline-flex;align-items:center;justify-content:center;height:clamp(48px,8vw,76px);border-radius:clamp(14px,2.2vw,24px);font-weight:1000;text-decoration:none;box-sizing:border-box;box-shadow:0 8px 20px rgba(0,24,92,.18);font-size:clamp(14px,2.3vw,24px);line-height:1;white-space:nowrap}
        .signupButton{flex:1 1 64%;background:#fff;color:#083f9e;padding:0 18px}
        .loginButton{flex:0 0 31%;background:rgba(92,82,233,.48);color:#fff;border:2px solid rgba(255,255,255,.9);backdrop-filter:blur(7px)}
        .betaMemberActions :global(a:focus-visible){outline:4px solid #fff;outline-offset:-4px;box-shadow:0 0 0 6px #0a58ca}
        @media(max-width:720px){
          .betaMemberWrap{margin-top:8px;margin-bottom:14px;padding:0 8px}
          .betaMemberWrap.isRaces{margin:14px auto;padding:0 12px}
          .betaMemberImageCard{border-radius:22px}
          .betaMemberActions{left:5%;right:5%;bottom:6.2%;gap:2.4%}
          .betaMemberActions :global(a){height:46px;border-radius:15px;font-size:13px}
          .signupButton{padding:0 8px}
          .loginButton{flex-basis:30%}
        }
        @media(max-width:380px){
          .betaMemberActions :global(a){height:42px;font-size:12px}
        }
      `}</style>
    </div>,
    mountNode
  );
}

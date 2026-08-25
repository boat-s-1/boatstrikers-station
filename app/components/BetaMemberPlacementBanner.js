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
        <Link className="signupHotspot" href="/members" aria-label="無料で会員登録" />
        <Link className="loginHotspot" href="/members?mode=login" aria-label="ログイン" />
      </div>

      <style jsx>{`
        .betaMemberWrap{max-width:1120px;margin:10px auto 18px;padding:0 8px;box-sizing:border-box}
        .betaMemberWrap.isRaces{max-width:1180px;margin:18px auto;padding:0 14px}
        .betaMemberImageCard{position:relative;overflow:hidden;border-radius:28px;box-shadow:0 14px 36px rgba(15,63,145,.24)}
        .isRaces .betaMemberImageCard{border-radius:24px}
        .betaMemberImage{display:block;width:100%;height:auto;aspect-ratio:1672/941;object-fit:cover}
        .signupHotspot,.loginHotspot{position:absolute;display:block;z-index:2;border-radius:18px}
        .signupHotspot{left:4.0%;bottom:7.0%;width:32.5%;height:16.0%}
        .loginHotspot{left:36.8%;bottom:7.0%;width:22.0%;height:16.0%}
        .signupHotspot:focus-visible,.loginHotspot:focus-visible{outline:4px solid #fff;outline-offset:-4px;box-shadow:0 0 0 6px #0a58ca}
        @media(max-width:720px){
          .betaMemberWrap{margin-top:8px;margin-bottom:14px;padding:0 8px}
          .betaMemberWrap.isRaces{margin:14px auto;padding:0 12px}
          .betaMemberImageCard{border-radius:22px}
          .signupHotspot{left:4.2%;bottom:7.1%;width:32.7%;height:16.3%}
          .loginHotspot{left:36.8%;bottom:7.1%;width:22.2%;height:16.3%}
        }
      `}</style>
    </div>,
    mountNode
  );
}

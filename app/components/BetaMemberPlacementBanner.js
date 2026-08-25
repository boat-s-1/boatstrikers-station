"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

    const place = () => {
      const target = pathname === "/"
        ? document.querySelector("main.page .hero")
        : document.querySelector("#todays-courses");

      if (!target) return false;

      const existing = document.querySelector(`[data-beta-member-placement="${pathname}"]`);
      if (existing) {
        setMountNode(existing);
        return true;
      }

      mount = document.createElement("div");
      mount.dataset.betaMemberPlacement = pathname;

      if (pathname === "/") {
        target.insertAdjacentElement("afterend", mount);
      } else {
        target.insertAdjacentElement("beforebegin", mount);
      }

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
      if (mount?.parentNode) mount.parentNode.removeChild(mount);
      setMountNode(null);
    };
  }, [pathname]);

  if (!mountNode) return null;

  const isRaces = pathname === "/races";

  return createPortal(
    <div
      style={{
        maxWidth: isRaces ? 1180 : 1120,
        margin: isRaces ? "20px auto 18px" : "14px auto 20px",
        padding: "0 14px",
        boxSizing: "border-box",
      }}
    >
      <Link
        href="/membership"
        aria-label="BoatStrikers β会員登録を見る"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          padding: "18px 20px",
          borderRadius: 20,
          textDecoration: "none",
          color: "#ffffff",
          background: "linear-gradient(135deg,#132c55 0%,#225fa8 55%,#674bb7 100%)",
          boxShadow: "0 12px 30px rgba(25,65,120,.18)",
          border: "1px solid rgba(255,255,255,.18)",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <strong style={{ fontSize: 12, letterSpacing: ".08em", opacity: .9 }}>BOATSTRIKERS β MEMBERSHIP</strong>
            <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,.16)" }}>12/31まで無料</span>
          </div>
          <div style={{ fontSize: "clamp(18px,4vw,25px)", fontWeight: 950, lineHeight: 1.35 }}>
            PREMIUM機能を無料で体験
          </div>
          <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.55, opacity: .9 }}>
            前日版AI・直前版AI・会員限定情報をβメンバー向けに順次開放します。
          </div>
        </div>
        <span
          style={{
            flex: "0 0 auto",
            background: "#ffffff",
            color: "#174b8c",
            fontWeight: 950,
            fontSize: 14,
            padding: "12px 16px",
            borderRadius: 13,
            boxShadow: "0 6px 18px rgba(0,0,0,.12)",
          }}
        >
          無料で会員登録 →
        </span>
      </Link>
    </div>,
    mountNode
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CHARACTERS = [
  { src: "/ichika-banner.jpg", alt: "一果" },
  { src: "/hatsune-banner.jpg", alt: "初音" },
  { src: "/kiina-banner.jpg", alt: "キイナ" },
];

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
    <div
      style={{
        maxWidth: isRaces ? 1180 : 1120,
        margin: isRaces ? "18px auto" : "10px auto 18px",
        padding: isRaces ? "0 14px" : "0 8px",
        boxSizing: "border-box",
      }}
    >
      <div
        className="betaMembershipCard"
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: isRaces ? 24 : 28,
          color: "#fff",
          background:
            "radial-gradient(circle at 82% 16%, rgba(244,127,255,.52), transparent 28%), radial-gradient(circle at 12% 92%, rgba(0,235,255,.38), transparent 31%), linear-gradient(118deg,#05267e 0%,#0754d6 45%,#7144e6 100%)",
          boxShadow: "0 14px 36px rgba(15,63,145,.28)",
          border: "1px solid rgba(255,255,255,.35)",
          isolation: "isolate",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            opacity: .24,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,.75) 1px, transparent 1.5px)",
            backgroundSize: "18px 18px",
            maskImage: "linear-gradient(90deg,#000 0%,transparent 67%)",
            zIndex: -1,
          }}
        />

        <div
          className="betaMembershipArt"
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "-1%",
            bottom: "-8%",
            width: isRaces ? "43%" : "46%",
            height: "72%",
            zIndex: 0,
            opacity: .28,
            pointerEvents: "none",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            gap: 0,
            filter: "saturate(.9) brightness(1.08)",
            maskImage: "linear-gradient(90deg,transparent 0%,#000 26%,#000 100%)",
          }}
        >
          {CHARACTERS.map((character, index) => (
            <img
              key={character.alt}
              src={character.src}
              alt=""
              style={{
                width: "40%",
                height: index === 1 ? "108%" : "96%",
                marginLeft: index ? "-12%" : 0,
                objectFit: "cover",
                objectPosition: "50% 28%",
                borderRadius: "42% 42% 8% 8%",
                transform: index === 1 ? "translateY(-3%)" : "none",
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            right: 14,
            top: 14,
            zIndex: 4,
            padding: "8px 13px",
            borderRadius: 999,
            color: "#073b9e",
            background: "linear-gradient(180deg,#fff8a8,#ffd64e)",
            border: "2px solid rgba(255,255,255,.9)",
            boxShadow: "0 5px 16px rgba(28,34,116,.24)",
            fontSize: "clamp(13px,2.8vw,18px)",
            fontWeight: 1000,
            whiteSpace: "nowrap",
          }}
        >
          12/31まで無料
        </div>

        <div
          className="betaMembershipGrid"
          style={{
            position: "relative",
            zIndex: 2,
            padding: isRaces ? "24px 24px 20px" : "26px 28px 22px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ minWidth: 0, maxWidth: isRaces ? 700 : 720 }}>
            <div
              style={{
                fontSize: "clamp(11px,2vw,16px)",
                fontWeight: 900,
                letterSpacing: ".12em",
                opacity: .98,
                marginBottom: 8,
              }}
            >
              BOATSTRIKERS β MEMBERSHIP
            </div>

            <div
              style={{
                display: "inline-block",
                paddingBottom: 5,
                borderBottom: "2px solid rgba(134,245,255,.75)",
                color: "#fff8a8",
                fontSize: "clamp(15px,3.2vw,24px)",
                fontWeight: 1000,
                textShadow: "0 2px 10px rgba(0,0,0,.2)",
              }}
            >
              PREMIUM機能を無料で体験
            </div>

            <h2
              style={{
                margin: "10px 0 8px",
                fontSize: "clamp(30px,7vw,58px)",
                lineHeight: 1.05,
                letterSpacing: "-.04em",
                fontWeight: 1000,
                color: "#fff",
                textShadow: "0 4px 14px rgba(0,27,102,.45)",
              }}
            >
              無料で会員登録
            </h2>

            <p
              style={{
                margin: 0,
                maxWidth: 620,
                fontSize: "clamp(12px,2.5vw,17px)",
                lineHeight: 1.58,
                fontWeight: 800,
                color: "rgba(255,255,255,.96)",
              }}
            >
              BS展示・直前版AI・直前買い目など、会員限定機能をβメンバー向けに順次開放します。
            </p>

            <div
              className="betaMembershipActions"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              <Link
                href="/members"
                aria-label="無料でBoatStrikers会員登録"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  minWidth: 190,
                  borderRadius: 16,
                  background: "#fff",
                  color: "#0a42a6",
                  boxShadow: "0 8px 22px rgba(0,22,92,.22)",
                  fontSize: "clamp(14px,2.8vw,19px)",
                  fontWeight: 1000,
                  textDecoration: "none",
                }}
              >
                無料で会員登録 →
              </Link>

              <Link
                href="/members?mode=login"
                aria-label="BoatStrikers会員ログイン"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 18px",
                  minWidth: 110,
                  borderRadius: 16,
                  background: "rgba(255,255,255,.12)",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,.82)",
                  fontSize: "clamp(14px,2.8vw,18px)",
                  fontWeight: 1000,
                  textDecoration: "none",
                  backdropFilter: "blur(8px)",
                }}
              >
                ログイン
              </Link>
            </div>
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 720px) {
            .betaMembershipGrid {
              padding: 20px 18px 14px !important;
            }
            .betaMembershipGrid > div {
              position: relative;
              z-index: 2;
            }
            .betaMembershipArt {
              right: -7% !important;
              bottom: -3% !important;
              width: 58% !important;
              height: 56% !important;
              opacity: .24 !important;
              mask-image: linear-gradient(90deg, transparent 0%, #000 22%, #000 100%) !important;
            }
            .betaMembershipArt img {
              width: 44% !important;
              height: 108% !important;
              margin-left: -15% !important;
              border-radius: 44% 44% 6% 6% !important;
            }
            .betaMembershipActions {
              gap: 8px !important;
              margin-top: 12px !important;
            }
            .betaMembershipActions a:first-child {
              min-width: 0 !important;
              flex: 1 1 190px;
            }
            .betaMembershipActions a:last-child {
              min-width: 92px !important;
              flex: 0 0 auto;
            }
          }
        `}</style>
      </div>
    </div>,
    mountNode
  );
}

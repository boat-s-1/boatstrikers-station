"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CHARACTERS = [
  { src: "/results/icons/ichika.jpg", alt: "一果" },
  { src: "/results/icons/hatsune.jpg", alt: "初音" },
  { src: "/results/icons/kiina.jpg", alt: "キイナ" },
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
        margin: isRaces ? "18px auto 18px" : "10px auto 18px",
        padding: isRaces ? "0 14px" : "0 8px",
        boxSizing: "border-box",
      }}
    >
      <Link
        href="/members"
        aria-label="12月31日まで無料のBoatStrikers β会員登録へ"
        style={{
          position: "relative",
          display: "block",
          minHeight: isRaces ? 250 : 300,
          overflow: "hidden",
          borderRadius: isRaces ? 24 : 28,
          textDecoration: "none",
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
            opacity: .28,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,.75) 1px, transparent 1.5px)",
            backgroundSize: "18px 18px",
            maskImage: "linear-gradient(90deg,#000 0%,transparent 65%)",
            zIndex: -1,
          }}
        />

        <div
          style={{
            position: "absolute",
            right: 14,
            top: 14,
            zIndex: 3,
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
          style={{
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: isRaces ? "minmax(0,1.15fr) minmax(220px,.85fr)" : "minmax(0,1.1fr) minmax(240px,.9fr)",
            gap: 12,
            alignItems: "end",
            minHeight: isRaces ? 250 : 300,
            padding: isRaces ? "24px 24px 22px" : "28px 28px 26px",
            boxSizing: "border-box",
          }}
          className="betaMembershipGrid"
        >
          <div style={{ minWidth: 0, alignSelf: "center" }}>
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
                lineHeight: 1.65,
                fontWeight: 800,
                color: "rgba(255,255,255,.96)",
              }}
            >
              BS展示・直前版AI・直前買い目など、会員限定機能をβメンバー向けに順次開放します。
            </p>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 16,
                padding: "12px 20px",
                minWidth: 190,
                borderRadius: 16,
                background: "#fff",
                color: "#0a42a6",
                boxShadow: "0 8px 22px rgba(0,22,92,.22)",
                fontSize: "clamp(14px,2.8vw,19px)",
                fontWeight: 1000,
              }}
            >
              無料で会員登録 →
            </span>
          </div>

          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 0,
              minHeight: 170,
              paddingTop: 54,
            }}
            className="betaMembershipCharacters"
          >
            {CHARACTERS.map((character, index) => (
              <div
                key={character.alt}
                style={{
                  width: isRaces ? 118 : 138,
                  aspectRatio: "1 / 1.18",
                  marginLeft: index ? -26 : 0,
                  borderRadius: "44% 44% 18% 18%",
                  overflow: "hidden",
                  border: "3px solid rgba(255,255,255,.72)",
                  boxShadow: "0 10px 24px rgba(13,25,96,.28)",
                  transform: index === 1 ? "translateY(-13px) scale(1.04)" : "translateY(0)",
                  background: "rgba(255,255,255,.18)",
                }}
              >
                <img
                  src={character.src}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 720px) {
            .betaMembershipGrid {
              grid-template-columns: 1fr !important;
              min-height: 0 !important;
              padding: 22px 18px 18px !important;
            }
            .betaMembershipCharacters {
              position: absolute !important;
              right: 8px;
              bottom: -8px;
              width: 47%;
              min-height: 0 !important;
              padding-top: 0 !important;
              opacity: .42;
              pointer-events: none;
            }
            .betaMembershipCharacters > div {
              width: 78px !important;
              border-width: 2px !important;
            }
            .betaMembershipGrid > div:first-child {
              position: relative;
              z-index: 2;
              padding-right: 3%;
            }
          }
        `}</style>
      </Link>
    </div>,
    mountNode
  );
}

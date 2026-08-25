"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LOCKED_LABELS = new Set(["BS展示", "直前版", "直前買い目"]);
const BANNER = "/beta-membership-banner.webp";

export default function RacePremiumMemberGate({ premiumAccess = false }) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState("");

  useEffect(() => {
    if (premiumAccess) return undefined;

    const annotate = () => {
      document.querySelectorAll("button").forEach((button) => {
        const strong = button.querySelector("strong");
        const label = strong?.textContent?.trim() || "";
        if (!LOCKED_LABELS.has(label)) return;

        button.dataset.bsPremiumLocked = "true";
        button.dataset.bsPremiumFeature = label;
        button.setAttribute("aria-label", `${label}（会員限定）`);
        button.style.position = "relative";

        const icon = button.querySelector("span");
        if (icon && !icon.dataset.bsOriginalIcon) {
          icon.dataset.bsOriginalIcon = icon.textContent || "";
          icon.textContent = "🔒";
        }
      });
    };

    const onClick = (event) => {
      const button = event.target?.closest?.('button[data-bs-premium-locked="true"]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      setFeature(button.dataset.bsPremiumFeature || "会員限定機能");
      setOpen(true);
    };

    annotate();
    const observer = new MutationObserver(annotate);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.querySelectorAll('button[data-bs-premium-locked="true"]').forEach((button) => {
        delete button.dataset.bsPremiumLocked;
        delete button.dataset.bsPremiumFeature;
        const icon = button.querySelector("span[data-bs-original-icon]");
        if (icon) {
          icon.textContent = icon.dataset.bsOriginalIcon || "";
          delete icon.dataset.bsOriginalIcon;
        }
      });
    };
  }, [premiumAccess]);

  if (premiumAccess || !open) return null;

  return (
    <div className="gateBackdrop" role="dialog" aria-modal="true" aria-label="BoatStrikers β会員限定" onClick={() => setOpen(false)}>
      <section className="gateCard" onClick={(event) => event.stopPropagation()}>
        <img src={BANNER} alt="BoatStrikers β MEMBERSHIP" className="gateImage" />
        <div className="featureBadge">🔒 {feature} は会員限定</div>
        <button className="closeButton" type="button" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
        <div className="gateActions">
          <Link href="/members" className="signupButton">無料で会員登録 →</Link>
          <Link href="/members?mode=login" className="loginButton">ログイン</Link>
        </div>

        <style jsx>{`
          .gateBackdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(7,19,43,.68);backdrop-filter:blur(8px)}
          .gateCard{position:relative;width:min(94vw,680px);overflow:hidden;border-radius:24px;box-shadow:0 26px 80px rgba(0,0,0,.34);background:#0a2f88}
          .gateImage{display:block;width:100%;height:auto;aspect-ratio:1672/941;object-fit:cover}
          .featureBadge{position:absolute;left:50%;top:4.5%;transform:translateX(-50%);z-index:4;padding:9px 15px;border-radius:999px;background:rgba(7,33,104,.86);border:1px solid rgba(255,255,255,.72);box-shadow:0 5px 16px rgba(0,0,0,.2);color:#fff;font-size:clamp(12px,2.3vw,17px);font-weight:1000;white-space:nowrap;backdrop-filter:blur(8px)}
          .closeButton{position:absolute;right:10px;top:10px;z-index:5;width:36px;height:36px;border:0;border-radius:50%;background:rgba(0,22,75,.55);color:#fff;font-size:25px;line-height:1;cursor:pointer;backdrop-filter:blur(8px)}
          .gateActions{position:absolute;left:4.5%;right:4.5%;bottom:6.2%;z-index:4;display:flex;align-items:center;gap:2.2%}
          .gateActions :global(a){display:inline-flex;align-items:center;justify-content:center;height:clamp(48px,8vw,72px);border-radius:clamp(14px,2.2vw,22px);font-size:clamp(14px,2.4vw,22px);font-weight:1000;text-decoration:none;box-sizing:border-box;box-shadow:0 8px 20px rgba(0,24,92,.2);white-space:nowrap}
          .signupButton{flex:1 1 65%;background:#fff;color:#083f9e;padding:0 14px}
          .loginButton{flex:0 0 30%;background:rgba(91,82,232,.5);color:#fff;border:2px solid rgba(255,255,255,.92);backdrop-filter:blur(7px)}
          .gateActions :global(a:focus-visible){outline:4px solid #fff;outline-offset:-4px;box-shadow:0 0 0 6px #0a58ca}
          @media(max-width:520px){
            .gateBackdrop{padding:12px}
            .gateCard{width:min(96vw,680px);border-radius:20px}
            .featureBadge{top:3.5%;padding:7px 11px;font-size:11px}
            .closeButton{width:32px;height:32px;font-size:22px}
            .gateActions{left:5%;right:5%;bottom:6.1%;gap:2.4%}
            .gateActions :global(a){height:44px;border-radius:14px;font-size:12px}
            .loginButton{flex-basis:29%}
          }
        `}</style>
      </section>
    </div>
  );
}

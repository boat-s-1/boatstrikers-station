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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BoatStrikers β会員限定"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "grid",
        placeItems: "center",
        padding: "20px",
        background: "rgba(10, 24, 42, .68)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(94vw, 560px)",
          padding: "14px",
          borderRadius: "26px",
          background: "#fff",
          color: "#172a41",
          boxShadow: "0 24px 70px rgba(0,0,0,.30)",
        }}
      >
        <div style={{ textAlign: "center", fontWeight: 1000, color: "#173f8f", marginBottom: "10px", fontSize: "16px" }}>
          🔒 {feature}は会員限定です
        </div>

        <div style={{ position: "relative", overflow: "hidden", borderRadius: "20px" }}>
          <img
            src={BANNER}
            alt="BoatStrikers β MEMBERSHIP 12月31日まで無料"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          <div
            style={{
              position: "absolute",
              left: "5%",
              right: "5%",
              bottom: "5.5%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Link
              href="/members"
              style={{
                width: "100%",
                minHeight: "48px",
                padding: "0 14px",
                borderRadius: "16px",
                background: "#fff",
                color: "#1647b8",
                textDecoration: "none",
                fontWeight: 1000,
                fontSize: "15px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                border: "2px solid rgba(255,255,255,.95)",
                boxShadow: "0 8px 22px rgba(0,21,92,.28)",
              }}
            >
              新規会員登録・会員ログイン <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <p style={{ margin: "12px 4px 4px", textAlign: "center", color: "#61738a", fontSize: "12px", fontWeight: 700, lineHeight: 1.7 }}>
          2026年12月31日まで、β会員はPREMIUM機能を無料で利用できます。
        </p>

        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            display: "block",
            margin: "8px auto 0",
            border: 0,
            background: "transparent",
            color: "#7a8999",
            padding: "8px 14px",
            fontWeight: 800,
          }}
        >
          閉じる
        </button>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LOCKED_LABELS = new Set(["BS展示", "直前版", "直前買い目"]);

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
        background: "rgba(10, 24, 42, .64)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(92vw, 470px)",
          padding: "28px 22px 22px",
          borderRadius: "24px",
          background: "#fff",
          color: "#172a41",
          boxShadow: "0 24px 70px rgba(0,0,0,.28)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "38px", lineHeight: 1 }}>🔒</div>
        <span style={{ display: "block", marginTop: "12px", color: "#1671c9", fontSize: "11px", fontWeight: 900, letterSpacing: ".13em" }}>
          BOATSTRIKERS β PREMIUM
        </span>
        <h2 style={{ margin: "8px 0 10px", fontSize: "25px" }}>{feature}は会員限定です</h2>
        <p style={{ margin: 0, color: "#61738a", fontSize: "13px", fontWeight: 700, lineHeight: 1.8 }}>
          2026年12月31日まで、β会員はPREMIUM機能を無料で利用できます。
        </p>

        <div style={{ display: "grid", gap: "9px", marginTop: "20px" }}>
          <Link
            href="/members"
            style={{ padding: "14px 16px", borderRadius: "14px", background: "linear-gradient(135deg,#168be1,#1260b6)", color: "#fff", textDecoration: "none", fontWeight: 900 }}
          >
            無料でβ会員登録
          </Link>
          <Link
            href="/members"
            style={{ padding: "13px 16px", borderRadius: "14px", background: "#eef5fb", color: "#1f5f98", textDecoration: "none", fontWeight: 900 }}
          >
            すでに会員の方はログイン
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ border: 0, background: "transparent", color: "#7a8999", padding: "8px", fontWeight: 800 }}
          >
            閉じる
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FEATURE_KEY = "elimination_ai";

export default function EliminationQuotaGate({ children, initialUsage = null, authenticated = false, active = false, premiumAccess = false }) {
  const router = useRouter();
  const [usage, setUsage] = useState(initialUsage);
  const [message, setMessage] = useState("");
  const [consuming, setConsuming] = useState(false);

  const remaining = usage?.remaining ?? 0;
  const limit = usage?.limit ?? 3;
  const unlimited = premiumAccess || usage?.unlimited;

  async function consumeAndRefresh() {
    if (consuming) return;
    setConsuming(true);
    setMessage("");
    try {
      const response = await fetch("/api/members/feature-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ feature: FEATURE_KEY }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.usage) setUsage(payload.usage);
        setMessage(payload?.error || "再診断の利用回数を確認できませんでした。");
        return;
      }
      if (payload?.usage) setUsage(payload.usage);
      router.refresh();
    } catch (error) {
      console.error("elimination quota consume error", error);
      setMessage("再診断を開始できませんでした。もう一度お試しください。");
    } finally {
      setConsuming(false);
    }
  }

  function handleClickCapture(event) {
    const button = event.target?.closest?.("button");
    if (!button) return;
    const text = String(button.textContent || "");
    if (!text.includes("最新データで再診断") && !text.includes("再診断中")) return;

    if (unlimited) return;

    event.preventDefault();
    event.stopPropagation();

    if (!authenticated) {
      setMessage("再診断は無料会員登録後に1日3回まで利用できます。");
      return;
    }
    if (!active) {
      setMessage("有効なBoatStrikers会員のみ再診断を利用できます。");
      return;
    }
    if (remaining <= 0) {
      setMessage("本日の無料再診断3回を使い切りました。PREMIUMなら無制限で利用できます。");
      return;
    }
    void consumeAndRefresh();
  }

  return (
    <div onClickCapture={handleClickCapture}>
      <section style={{
        marginBottom: 12,
        padding: "12px 14px",
        borderRadius: 14,
        border: unlimited ? "1px solid #c9b8f4" : "1px solid #d7e1ec",
        background: unlimited ? "linear-gradient(135deg,#f7f2ff,#eef5ff)" : "#fff",
        color: "#243549",
      }}>
        {unlimited ? (
          <>
            <strong style={{ display: "block", fontSize: 13 }}>β PREMIUM / PREMIUM</strong>
            <span style={{ display: "block", marginTop: 3, fontSize: 12, fontWeight: 900, color: "#6550a8" }}>最新データでの再診断：無制限</span>
          </>
        ) : authenticated && active ? (
          <>
            <strong style={{ display: "block", fontSize: 13 }}>FREE 利用枠</strong>
            <span style={{ display: "block", marginTop: 3, fontSize: 12, fontWeight: 900 }}>本日の再診断 残り {remaining}/{limit}回</span>
          </>
        ) : (
          <>
            <strong style={{ display: "block", fontSize: 13 }}>FREE TRIAL</strong>
            <span style={{ display: "block", marginTop: 3, fontSize: 12, fontWeight: 800 }}>無料会員になると、最新データでの再診断を1日3回利用できます。</span>
            <Link href="/members" style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 1000, color: "#2c5f97" }}>無料会員になる →</Link>
          </>
        )}
        {consuming && <small style={{ display: "block", marginTop: 7, color: "#607084", fontWeight: 800 }}>利用枠を確認しています…</small>}
        {message && <small style={{ display: "block", marginTop: 7, color: "#b42318", fontWeight: 900, lineHeight: 1.5 }}>{message}</small>}
      </section>
      {children}
    </div>
  );
}

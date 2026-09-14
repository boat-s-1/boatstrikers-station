"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const VISIBLE_FEATURES = [
  { key: "elimination_ai", icon: "🧹", label: "消去法AI", freeLimit: 3 },
  { key: "exhibition_compare_ai", icon: "📊", label: "展示比較AI", freeLimit: 3 },
  { key: "ai_detail", icon: "🧠", label: "AI詳細診断", freeLimit: 5 },
];

function planLabel(payload) {
  if (payload?.betaOpen) return "β PREMIUM";
  if (payload?.premium) return "PREMIUM";
  return "FREE";
}

function usageText(status, definition) {
  if (status?.unlimited) return "無制限";
  if (typeof status?.remaining === "number") {
    return `残り ${status.remaining}/${status.limit ?? definition.freeLimit}回`;
  }
  return `1日${definition.freeLimit}回`;
}

function progress(status, definition) {
  if (status?.unlimited) return 100;
  const limit = Number(status?.limit ?? definition.freeLimit);
  const remaining = Number(status?.remaining ?? limit);
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (remaining / limit) * 100));
}

export default function MemberUsageDashboard() {
  const pathname = usePathname();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const isMemberTop = pathname === "/members" || pathname === "/members/";

  useEffect(() => {
    if (!isMemberTop) return undefined;
    let cancelled = false;
    let timer = null;

    const load = async (retry = true) => {
      try {
        const response = await fetch("/api/members/feature-usage", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401 && retry) {
          timer = window.setTimeout(() => load(false), 900);
          return;
        }

        if (!response.ok) {
          if (!cancelled) {
            setFailed(true);
            setLoading(false);
          }
          return;
        }

        const body = await response.json().catch(() => null);
        if (!cancelled && body?.ok) {
          setPayload(body);
          setFailed(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isMemberTop]);

  const plan = useMemo(() => planLabel(payload), [payload]);

  if (!isMemberTop || failed) return null;

  if (loading) {
    return (
      <section style={shellStyle} aria-label="本日の利用状況">
        <div style={{ color: "#66778a", fontWeight: 800, fontSize: 13 }}>
          本日の利用状況を読み込み中…
        </div>
      </section>
    );
  }

  if (!payload?.ok) return null;

  return (
    <section style={shellStyle} aria-label="BoatStrikers マイページ利用状況">
      <div style={headerStyle}>
        <div>
          <span style={kickerStyle}>MY BOATSTRIKERS</span>
          <h2 style={{ margin: "5px 0 4px", fontSize: 23, color: "#172a41" }}>
            本日の利用状況
          </h2>
          <p style={{ margin: 0, color: "#6d7d90", fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>
            FREEは毎日利用枠がリセットされます。β PREMIUM / PREMIUMは対象機能を無制限で利用できます。
          </p>
        </div>
        <strong style={planBadgeStyle}>{plan}</strong>
      </div>

      <div style={gridStyle}>
        {VISIBLE_FEATURES.map((definition) => {
          const status = payload.features?.[definition.key];
          const unlimited = Boolean(status?.unlimited);
          const exhausted = !unlimited && Number(status?.remaining) === 0;

          return (
            <article key={definition.key} style={featureCardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 21 }}>{definition.icon}</span>
                  <strong style={{ color: "#23384f", fontSize: 14 }}>{definition.label}</strong>
                </div>
                <strong style={{ color: exhausted ? "#ba3d3d" : unlimited ? "#5a45a5" : "#245d96", fontSize: 13 }}>
                  {usageText(status, definition)}
                </strong>
              </div>

              <div style={trackStyle}>
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${progress(status, definition)}%`,
                    borderRadius: 999,
                    background: exhausted
                      ? "linear-gradient(90deg,#d96b6b,#bc4545)"
                      : unlimited
                        ? "linear-gradient(90deg,#6954c8,#9a70e7)"
                        : "linear-gradient(90deg,#2778bf,#42a5db)",
                    transition: "width .2s ease",
                  }}
                />
              </div>

              <small style={{ display: "block", marginTop: 8, color: "#8190a0", fontWeight: 700 }}>
                {unlimited
                  ? "現在の会員ステータスでは利用回数の消費はありません。"
                  : exhausted
                    ? "本日の無料利用枠を使い切りました。"
                    : `本日の利用済み ${Number(status?.used || 0)}回`}
              </small>
            </article>
          );
        })}
      </div>

      <div style={footerStyle}>
        <span style={{ color: "#607287", fontSize: 12, fontWeight: 800 }}>
          {payload.betaOpen
            ? "2026年12月31日までβ PREMIUMとしてPREMIUM相当機能を無料開放中。"
            : payload.premium
              ? "PREMIUM会員として対象機能を無制限で利用できます。"
              : "もっと使いたい場合はPREMIUMで無制限利用できます。"}
        </span>
        <Link href="/races" style={ctaStyle}>今日のレースを見る →</Link>
      </div>
    </section>
  );
}

const shellStyle = {
  width: "min(94vw, 920px)",
  margin: "18px auto 24px",
  padding: "20px",
  borderRadius: 24,
  background: "linear-gradient(180deg,#ffffff 0%,#f7faff 100%)",
  border: "1px solid #dfe8f2",
  boxShadow: "0 14px 34px rgba(30,57,86,.10)",
};

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const kickerStyle = {
  color: "#316ca7",
  fontSize: 10,
  fontWeight: 1000,
  letterSpacing: ".16em",
};

const planBadgeStyle = {
  padding: "9px 13px",
  borderRadius: 999,
  background: "linear-gradient(135deg,#214d91,#7452c5)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 1000,
  boxShadow: "0 7px 18px rgba(55,72,145,.18)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 11,
  marginTop: 17,
};

const featureCardStyle = {
  padding: "14px",
  borderRadius: 17,
  border: "1px solid #e1e8f0",
  background: "#fff",
};

const trackStyle = {
  height: 7,
  marginTop: 12,
  borderRadius: 999,
  overflow: "hidden",
  background: "#eaf0f5",
};

const footerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 16,
  paddingTop: 15,
  borderTop: "1px solid #e1e8f0",
};

const ctaStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  background: "#193f75",
  color: "#fff",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 1000,
};

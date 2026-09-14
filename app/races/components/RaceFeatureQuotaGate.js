"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const FEATURES = {
  "BS展示": {
    key: "exhibition_compare_ai",
    label: "展示比較AI",
    limit: 3,
  },
  "前日版": {
    key: "ai_detail",
    label: "AI詳細診断",
    limit: 5,
  },
};

function statusText(status, definition) {
  if (status?.unlimited) return `${definition.label}：無制限`;
  if (typeof status?.remaining === "number") {
    return `${definition.label}：残り ${status.remaining}/${status.limit ?? definition.limit}回`;
  }
  return `${definition.label}：FREE ${definition.limit}回/日`;
}

export default function RaceFeatureQuotaGate({ premiumAccess = false }) {
  const [statuses, setStatuses] = useState({});
  const [dialog, setDialog] = useState(null);
  const [busyKey, setBusyKey] = useState("");
  const busyRef = useRef(false);

  const definitions = useMemo(() => Object.values(FEATURES), []);

  useEffect(() => {
    let cancelled = false;

    if (premiumAccess) {
      setStatuses(Object.fromEntries(definitions.map((feature) => [
        feature.key,
        { unlimited: true, limit: null, remaining: null },
      ])));
      return undefined;
    }

    fetch("/api/members/feature-usage", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (!cancelled && payload?.ok) setStatuses(payload.features || {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [premiumAccess, definitions]);

  useEffect(() => {
    if (premiumAccess) return undefined;

    const annotate = () => {
      document.querySelectorAll("button").forEach((button) => {
        const strong = button.querySelector("strong");
        const label = strong?.textContent?.trim() || "";
        const definition = FEATURES[label];
        if (!definition) return;

        button.dataset.bsQuotaFeature = definition.key;
        button.dataset.bsQuotaLabel = definition.label;
        button.setAttribute("aria-label", `${label}（FREEは1日${definition.limit}回）`);
      });
    };

    const onClick = async (event) => {
      const button = event.target?.closest?.("button[data-bs-quota-feature]");
      if (!button) return;

      if (button.dataset.bsQuotaGranted === "true") return;

      if (button.dataset.bsQuotaBypass === "true") {
        delete button.dataset.bsQuotaBypass;
        return;
      }

      const featureKey = button.dataset.bsQuotaFeature;
      const definition = Object.values(FEATURES).find((item) => item.key === featureKey);
      if (!definition) return;

      if (busyRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

      busyRef.current = true;
      setBusyKey(featureKey);
      try {
        const response = await fetch("/api/members/feature-usage", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature: featureKey }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload?.ok) {
          setDialog({
            feature: definition.label,
            error: payload?.error || "利用回数を確認できませんでした。",
            loginRequired: response.status === 401 || response.status === 403,
            exhausted: response.status === 429,
          });
          if (payload?.usage) {
            setStatuses((previous) => ({ ...previous, [featureKey]: payload.usage }));
          }
          return;
        }

        setStatuses((previous) => ({ ...previous, [featureKey]: payload.usage }));
        button.dataset.bsQuotaGranted = "true";
        button.dataset.bsQuotaBypass = "true";
        button.click();
      } catch (error) {
        console.error("race feature quota error", error);
        setDialog({
          feature: definition.label,
          error: "利用回数を確認できませんでした。もう一度お試しください。",
          loginRequired: false,
          exhausted: false,
        });
      } finally {
        busyRef.current = false;
        setBusyKey("");
      }
    };

    annotate();
    const observer = new MutationObserver(annotate);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.querySelectorAll("button[data-bs-quota-feature]").forEach((button) => {
        delete button.dataset.bsQuotaFeature;
        delete button.dataset.bsQuotaLabel;
        delete button.dataset.bsQuotaBypass;
        delete button.dataset.bsQuotaGranted;
      });
    };
  }, [premiumAccess]);

  return (
    <>
      <div
        style={{
          margin: "0 0 12px",
          padding: "10px 12px",
          borderRadius: "14px",
          border: "1px solid #dfe7f1",
          background: premiumAccess ? "#f4f1ff" : "#f7faff",
          color: "#40536a",
          display: "flex",
          gap: "8px 12px",
          flexWrap: "wrap",
          alignItems: "center",
          fontSize: "11px",
          fontWeight: 900,
        }}
      >
        <strong style={{ color: premiumAccess ? "#5b3fa0" : "#245a93" }}>
          {premiumAccess ? "β PREMIUM" : "FREE利用枠"}
        </strong>
        {definitions.map((definition) => (
          <span key={definition.key}>{statusText(statuses[definition.key], definition)}</span>
        ))}
      </div>

      {busyKey && (
        <div style={{ margin: "-4px 0 10px", color: "#63758a", fontSize: "11px", fontWeight: 800 }}>
          利用枠を確認中…
        </div>
      )}

      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDialog(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10020,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background: "rgba(10,24,42,.68)",
            backdropFilter: "blur(8px)",
          }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(92vw,460px)",
              padding: "22px",
              borderRadius: "22px",
              background: "#fff",
              color: "#1e334b",
              boxShadow: "0 24px 70px rgba(0,0,0,.28)",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>
              {dialog.exhausted ? "🔒" : "👤"}
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "19px" }}>{dialog.feature}</h3>
            <p style={{ margin: 0, lineHeight: 1.8, color: "#61738a", fontSize: "13px", fontWeight: 800 }}>
              {dialog.error}
            </p>
            {(dialog.loginRequired || dialog.exhausted) && (
              <Link
                href="/members"
                style={{
                  display: "block",
                  marginTop: "16px",
                  padding: "13px 16px",
                  borderRadius: "13px",
                  background: "linear-gradient(135deg,#174a9b,#6952c9)",
                  color: "#fff",
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: 1000,
                }}
              >
                {dialog.exhausted ? "PREMIUMを見る" : "無料会員登録・ログイン"}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setDialog(null)}
              style={{
                display: "block",
                margin: "8px auto 0",
                padding: "9px 14px",
                border: 0,
                background: "transparent",
                color: "#7b8a9a",
                fontWeight: 900,
              }}
            >
              閉じる
            </button>
          </section>
        </div>
      )}
    </>
  );
}

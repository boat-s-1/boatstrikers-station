"use client";

import { useEffect, useRef, useState } from "react";

const X_URL = "https://x.com/boatstrikers";

export default function XTimeline() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    const sleep = (ms) =>
      new Promise((resolve) => window.setTimeout(resolve, ms));

    const hasTimeline = () => {
      if (!containerRef.current) return false;

      return Boolean(
        containerRef.current.querySelector(
          'iframe.twitter-timeline, iframe[id^="twitter-widget"], iframe'
        )
      );
    };

    const waitForXWidgets = async () => {
      for (let i = 0; i < 30; i += 1) {
        if (window.twttr?.widgets?.createTimeline) {
          return true;
        }

        await sleep(200);
      }

      return false;
    };

    const loadScript = () => {
      let script = document.getElementById(
        "boatstrikers-x-widgets"
      );

      if (script) {
        return script;
      }

      script = document.createElement("script");
      script.id = "boatstrikers-x-widgets";
      script.src = "https://platform.x.com/widgets.js";
      script.async = true;
      script.charset = "utf-8";

      document.body.appendChild(script);

      return script;
    };

    const createTimeline = async () => {
      try {
        loadScript();

        const ready = await waitForXWidgets();

        if (!ready || cancelled || !containerRef.current) {
          if (!cancelled) {
            setStatus("failed");
          }
          return;
        }

        containerRef.current.innerHTML = "";

        await window.twttr.widgets.createTimeline(
          {
            sourceType: "profile",
            screenName: "boatstrikers",
          },
          containerRef.current,
          {
            height: 500,
            theme: "light",
            chrome: "noheader nofooter noborders",
            dnt: true,
          }
        );

        // createTimeline が成功扱いでも iframe が
        // 実際には作られない場合があるため確認する。
        for (let i = 0; i < 20; i += 1) {
          if (cancelled) return;

          if (hasTimeline()) {
            setStatus("loaded");
            return;
          }

          await sleep(250);
        }

        if (!cancelled) {
          setStatus("failed");
        }
      } catch (error) {
        console.error(
          "BoatStrikers X timeline error:",
          error
        );

        if (!cancelled) {
          setStatus("failed");
        }
      }
    };

    createTimeline();

    // 最大12秒で表示できなければ、
    // 大きな空白を残さずフォールバックへ切り替える。
    timeoutId = window.setTimeout(() => {
      if (cancelled) return;

      if (!hasTimeline()) {
        setStatus("failed");
      }
    }, 12000);

    return () => {
      cancelled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div style={{ width: "100%" }}>
      {status === "loading" && (
        <div
          style={{
            padding: "30px 16px",
            textAlign: "center",
            color: "#718399",
          }}
        >
          Xの最新投稿を読み込んでいます…
        </div>
      )}

      {status !== "failed" && (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            minHeight:
              status === "loaded"
                ? "auto"
                : "80px",
          }}
        />
      )}

      {status === "failed" && (
        <div
          style={{
            padding: "24px 18px",
            background: "#ffffff",
            border:
              "1px solid rgba(30, 100, 160, 0.12)",
            borderRadius: "18px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "8px",
            }}
          >
            𝕏
          </div>

          <strong
            style={{
              display: "block",
              color: "#173651",
              marginBottom: "6px",
            }}
          >
            Xでリアルタイム更新中
          </strong>

          <p
            style={{
              margin: "0 0 16px",
              color: "#718399",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            予想・新聞更新・的中速報を
            Xでも配信しています。
          </p>

          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 18px",
              borderRadius: "999px",
              background: "#173651",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: "700",
            }}
          >
            Xの最新投稿を見る →
          </a>
        </div>
      )}
    </div>
  );
}

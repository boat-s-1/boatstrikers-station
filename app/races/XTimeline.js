"use client";

import { useEffect, useRef, useState } from "react";

const X_URL = "https://x.com/boatstrikers";

export default function XTimeline() {
  const containerRef = useRef(null);

  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const sleep = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const hasTimeline = () => {
      if (!containerRef.current) return false;

      return Boolean(
        containerRef.current.querySelector(
          "iframe.twitter-timeline, iframe[id^='twitter-widget'], iframe"
        )
      );
    };

    const waitForTwitter = async () => {
      for (let i = 0; i < 30; i += 1) {
        if (window.twttr?.widgets?.createTimeline) {
          return true;
        }

        await sleep(200);
      }

      return false;
    };

    const createTimeline = async () => {
      try {
        /*
         * X公式 widgets.js を読み込み
         */
        let script =
          document.getElementById("boatstrikers-x-widgets");

        if (!script) {
          script = document.createElement("script");

          script.id = "boatstrikers-x-widgets";
          script.src =
            "https://platform.x.com/widgets.js";

          script.async = true;
          script.charset = "utf-8";

          document.body.appendChild(script);
        }

        /*
         * twttr API が使えるまで待機
         */
        const ready = await waitForTwitter();

        if (!ready || cancelled) {
          setStatus("failed");
          return;
        }

        if (!containerRef.current) {
          setStatus("failed");
          return;
        }

        /*
         * 古い内容を削除
         */
        containerRef.current.innerHTML = "";

        /*
         * プロフィールタイムライン生成
         */
        await window.twttr.widgets.createTimeline(
          {
            sourceType: "profile",
            screenName: "boatstrikers",
          },
          containerRef.current,
          {
            height: 500,

            theme: "light",

            chrome:
              "noheader nofooter noborders",

            dnt: true,
          }
        );

        /*
         * createTimeline が成功扱いになっても
         * iframe が作られないケースがあるため確認
         */
        for (let i = 0; i < 20; i += 1) {
          if (cancelled) return;

          if (hasTimeline()) {
            setStatus("loaded");
            return;
          }

          await sleep(250);
        }

        /*
         * iframe ができなければ失敗扱い
         */
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

    /*
     * 最大12秒で強制的に判定
     */
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
    <div
      style={{
        width: "100%",
      }}
    >
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

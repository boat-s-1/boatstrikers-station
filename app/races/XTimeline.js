"use client";

import { useEffect, useRef, useState } from "react";

export default function XTimeline() {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const createTimeline = async () => {
      try {
        // すでにXのwidgets.jsが読み込まれている場合
        if (window.twttr?.widgets?.createTimeline) {
          if (!containerRef.current) return;

          containerRef.current.innerHTML = "";

          await window.twttr.widgets.createTimeline(
            {
              sourceType: "profile",
              screenName: "boatstrikers",
            },
            containerRef.current,
            {
              height: 520,
              chrome: "noheader nofooter noborders transparent",
              dnt: true,
            }
          );

          return;
        }

        // widgets.js を読み込む
        let script = document.getElementById("x-widgets-js");

        if (!script) {
          script = document.createElement("script");
          script.id = "x-widgets-js";
          script.src = "https://platform.x.com/widgets.js";
          script.async = true;
          script.charset = "utf-8";
          document.body.appendChild(script);
        }

        const handleLoad = async () => {
          if (cancelled) return;

          // X側の初期化待ち
          let retry = 0;

          while (
            !window.twttr?.widgets?.createTimeline &&
            retry < 20
          ) {
            await new Promise((resolve) =>
              setTimeout(resolve, 250)
            );

            retry++;
          }

          if (
            !window.twttr?.widgets?.createTimeline ||
            !containerRef.current
          ) {
            setFailed(true);
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
              height: 520,
              chrome:
                "noheader nofooter noborders transparent",
              dnt: true,
            }
          );
        };

        if (script.dataset.loaded === "true") {
          handleLoad();
        } else {
          script.addEventListener(
            "load",
            () => {
              script.dataset.loaded = "true";
              handleLoad();
            },
            { once: true }
          );

          script.addEventListener(
            "error",
            () => {
              if (!cancelled) {
                setFailed(true);
              }
            },
            { once: true }
          );
        }
      } catch (error) {
        console.error(
          "X timeline load error:",
          error
        );

        if (!cancelled) {
          setFailed(true);
        }
      }
    };

    createTimeline();

    const timeout = setTimeout(() => {
      if (
        !window.twttr?.widgets?.createTimeline
      ) {
        setFailed(true);
      }
    }, 12000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  if (failed) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          background: "#fff",
          borderRadius: "18px",
        }}
      >
        <p>
          Xのタイムラインを表示できませんでした。
        </p>

        <a
          href="https://x.com/boatstrikers"
          target="_blank"
          rel="noopener noreferrer"
        >
          Xで最新投稿を見る →
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        minHeight: "300px",
      }}
    >
      <div
        style={{
          padding: "30px 20px",
          textAlign: "center",
        }}
      >
        Xの最新投稿を読み込んでいます…
      </div>
    </div>
  );
}

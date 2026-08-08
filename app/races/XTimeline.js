"use client";

import { useEffect } from "react";
import styles from "./phase2.module.css";

function normalizeXProfileUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (!/^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/?$/i.test(url)) return "";
  return url.replace("twitter.com", "x.com").replace(/\/$/, "");
}

export default function XTimeline({ profileUrl = "" }) {
  const safeUrl = normalizeXProfileUrl(profileUrl);

  useEffect(() => {
    if (!safeUrl) return undefined;

    const loadWidgets = () => {
      if (window.twttr?.widgets?.load) {
        window.twttr.widgets.load();
      }
    };

    const existing = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    if (existing) {
      loadWidgets();
      existing.addEventListener("load", loadWidgets, { once: true });
      return () => existing.removeEventListener("load", loadWidgets);
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.addEventListener("load", loadWidgets, { once: true });
    document.body.appendChild(script);

    return () => script.removeEventListener("load", loadWidgets);
  }, [safeUrl]);

  if (!safeUrl) {
    return (
      <div className={styles.xTimelineFallback}>
        <span className={styles.xTimelineLogo}>𝕏</span>
        <strong>Xリアルタイム更新欄</strong>
        <p>アカウントURLを設定すると、予想・新聞更新の投稿がここに表示されます。</p>
        <code>NEXT_PUBLIC_BOATSTRIKERS_X_URL</code>
      </div>
    );
  }

  return (
    <div className={styles.xTimelineShell}>
      <a
        className="twitter-timeline"
        data-height="520"
        data-chrome="noheader nofooter noborders transparent"
        data-dnt="true"
        data-tweet-limit="5"
        href={safeUrl}
      >
        Xの最新投稿を読み込んでいます…
      </a>
      <noscript>
        <a href={safeUrl} target="_blank" rel="noreferrer">Xで最新情報を見る</a>
      </noscript>
    </div>
  );
}

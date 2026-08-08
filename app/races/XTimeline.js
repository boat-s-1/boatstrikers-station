"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./phase2.module.css";

function getXProfile(value) {
  const url = String(value || "").trim();
  if (!url) return null;

  const match = url.match(/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/?$/i);
  if (!match) return null;

  const username = match[1];

  return {
    username,
    // ユーザーがタップした時のリンク先は現在のX URL
    xUrl: `https://x.com/${username}`,
    // Embedded Timeline は platform.twitter.com/widgets.js と組み合わせるため
    // 埋め込み側だけ twitter.com URL を使用する
    embedUrl: `https://twitter.com/${username}`,
  };
}

export default function XTimeline({ profileUrl = "" }) {
  const profile = useMemo(() => getXProfile(profileUrl), [profileUrl]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!profile) return undefined;

    setLoadFailed(false);

    let timeoutId;
    let cancelled = false;

    const checkRendered = () => {
      if (cancelled) return;

      // widgets.js が正常に変換すると iframe が生成される
      const iframe = document.querySelector(
        '.x-timeline-container iframe[id^="twitter-widget"], .x-timeline-container iframe'
      );

      if (!iframe) {
        setLoadFailed(true);
      }
    };

    const loadWidgets = () => {
      if (cancelled) return;

      if (window.twttr?.widgets?.load) {
        const container = document.querySelector(".x-timeline-container");
        window.twttr.widgets.load(container || undefined);
      }

      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(checkRendered, 12000);
    };

    const existing = document.querySelector(
      'script[src="https://platform.twitter.com/widgets.js"]'
    );

    if (existing) {
      loadWidgets();
      existing.addEventListener("load", loadWidgets, { once: true });

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
        existing.removeEventListener("load", loadWidgets);
      };
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.addEventListener("load", loadWidgets, { once: true });
    script.addEventListener("error", () => {
      if (!cancelled) setLoadFailed(true);
    });
    document.body.appendChild(script);

    timeoutId = window.setTimeout(checkRendered, 12000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", loadWidgets);
    };
  }, [profile]);

  if (!profile) {
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
    <div className={`${styles.xTimelineShell} x-timeline-container`}>
      {!loadFailed ? (
        <a
          className="twitter-timeline"
          data-height="520"
          data-chrome="noheader nofooter noborders transparent"
          data-dnt="true"
          data-theme="light"
          href={profile.embedUrl}
        >
          @{profile.username} の最新投稿を読み込んでいます…
        </a>
      ) : (
        <div className={styles.xTimelineFallback}>
          <span className={styles.xTimelineLogo}>𝕏</span>
          <strong>最新投稿をXで見る</strong>
          <p>
            ブラウザのトラッキング防止設定などにより、タイムラインを表示できない場合があります。
          </p>
          <a href={profile.xUrl} target="_blank" rel="noreferrer">
            @{profile.username} をXで開く →
          </a>
        </div>
      )}
    </div>
  );
}

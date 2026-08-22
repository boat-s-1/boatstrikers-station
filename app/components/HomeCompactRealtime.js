"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import styles from "./HomeCompactRealtime.module.css";

const CHARACTER_LABEL = {
  ichika: "一果",
  hatsune: "初音",
  kiina: "キイナ",
  all: "BoatStrikers",
};

export default function HomeCompactRealtime() {
  const pathname = usePathname();
  const [mount, setMount] = useState(null);
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (pathname !== "/") return;

    const target = document.querySelector(".resultSummarySection");
    if (!target) return;

    const node = document.createElement("div");
    node.dataset.homeCompactRealtime = "true";
    target.insertAdjacentElement("afterend", node);
    setMount(node);

    fetch("/api/home/realtime", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setItem(data.item || null))
      .catch(() => setItem(null));

    return () => {
      node.remove();
      setMount(null);
    };
  }, [pathname]);

  if (!mount) return null;

  return createPortal(
    <section className={styles.card} aria-label="リアルタイム予想">
      <div className={styles.heading}>
        <div>
          <span>⚡ REALTIME</span>
          <strong>リアルタイム予想</strong>
        </div>
        <small>速報版</small>
      </div>

      {item ? (
        <a
          href={item.url}
          target={/^https?:\/\//.test(item.url) ? "_blank" : undefined}
          rel={/^https?:\/\//.test(item.url) ? "noopener noreferrer" : undefined}
          className={styles.latest}
        >
          <div>
            <span className={styles.character}>
              {CHARACTER_LABEL[item.character] || "BoatStrikers"}
            </span>
            <b>{item.title}</b>
            <small>
              {item.published_at
                ? `${new Date(item.published_at).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Tokyo",
                  })} 更新`
                : "最新更新"}
            </small>
          </div>
          <span className={styles.view}>見る ↗</span>
        </a>
      ) : (
        <p className={styles.empty}>現在のリアルタイム予想はありません。</p>
      )}

      <div className={styles.characterLinks}>
        <a href="/ichika">一果</a>
        <a href="/hatsune">初音</a>
        <a href="/kiina">キイナ</a>
      </div>
    </section>,
    mount
  );
}

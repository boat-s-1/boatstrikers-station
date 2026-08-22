"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import styles from "./CharacterShortsShelf.module.css";

const PLACEHOLDERS = [
  { id: "short-1", label: "最新ショート", title: "一果の前日イン逃げ予想" },
  { id: "short-2", label: "SHORTS", title: "今日のイン逃げ注目レース" },
  { id: "short-3", label: "SHORTS", title: "一果AI ピックアップ" },
];

export default function CharacterShortsShelf() {
  const pathname = usePathname();
  const [mount, setMount] = useState(null);

  useEffect(() => {
    if (pathname !== "/ichika") {
      setMount(null);
      return undefined;
    }

    let cancelled = false;
    let observer = null;
    let node = null;

    const attach = () => {
      if (cancelled || node) return;

      const aiPanel = document.querySelector('section[aria-label="一果 AI予想"]');
      const realtime = document.querySelector(".ichikaPage .realtimeUpdates, .ichikaPage [class*='RealtimeUpdates'], .ichikaPage section");
      if (!aiPanel) return;

      const aiMount = aiPanel.parentElement;
      if (!aiMount) return;

      node = document.createElement("div");
      node.className = styles.mount;
      aiMount.insertAdjacentElement("afterend", node);
      setMount(node);

      if (observer) observer.disconnect();
    };

    attach();
    if (!node) {
      observer = new MutationObserver(attach);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (node) node.remove();
      setMount(null);
    };
  }, [pathname]);

  if (!mount) return null;

  return createPortal(
    <section className={styles.shelf} aria-label="一果の最新ショート">
      <div className={styles.heading}>
        <div>
          <span>YOUTUBE SHORTS</span>
          <h2>🎬 一果の最新ショート</h2>
        </div>
        <small>横にスワイプ →</small>
      </div>

      <div className={styles.scroller}>
        {PLACEHOLDERS.map((item, index) => (
          <article className={styles.card} key={item.id}>
            <div className={styles.thumb}>
              <span>{item.label}</span>
              <b>{index + 1}</b>
              <div>再生リスト準備中</div>
            </div>
            <h3>{item.title}</h3>
            <p>YouTube再生リスト接続後、自動で最新動画に切り替わります。</p>
          </article>
        ))}
      </div>

      <div className={styles.footer}>
        <span>再生リストを作成後、IDを接続するだけでOKです。</span>
        <span className={styles.pending}>準備中</span>
      </div>
    </section>,
    mount
  );
}

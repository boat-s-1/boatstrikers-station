"use client";

import { useState } from "react";
import styles from "./xNightPosts.module.css";

export default function CopyPostCard({ label, text, badge }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      window.prompt("コピーしてください", text);
    }
  }

  return (
    <article className={styles.postCard}>
      <div className={styles.cardTop}>
        <div>
          {badge ? <span className={styles.badge}>{badge}</span> : null}
          <strong>{label}</strong>
        </div>
        <button type="button" onClick={handleCopy} className={styles.copyButton}>
          {copied ? "コピー済み ✓" : "コピー"}
        </button>
      </div>
      <p>{text}</p>
      <div className={styles.charCount}>{String(text || "").length}文字</div>
    </article>
  );
}

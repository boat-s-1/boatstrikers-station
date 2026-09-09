"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function ClientActions({ xText, shortScript, imageUrl, filename }) {
  const [copied, setCopied] = useState("");

  async function copy(label, value) {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(label);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("コピー失敗");
      setTimeout(() => setCopied(""), 1600);
    }
  }

  return (
    <div className={styles.actionGrid}>
      <button type="button" onClick={() => copy("X投稿", xText)}>X投稿文をコピー</button>
      <button type="button" onClick={() => copy("台本", shortScript)}>ショート台本をコピー</button>
      <a href={imageUrl} download={filename}>縦長画像を開く / 保存</a>
      {copied && <span className={styles.copyStatus}>{copied === "コピー失敗" ? copied : `${copied}をコピーしました`}</span>}
    </div>
  );
}

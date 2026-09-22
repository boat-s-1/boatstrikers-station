"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./LatestCharacterPopup.module.css";

const HIDE_PREFIXES = ["/admin", "/members", "/bsc2/admin", "/bsc2/login"];

function todayKey() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function LatestCharacterPopupClient({
  id,
  characterKey,
  name,
  image,
  message,
  meta,
  title,
  href,
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (HIDE_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return;

    const key = `bs-character-popup:${todayKey()}:${id}`;
    if (window.localStorage.getItem(key) === "closed") return;

    const timer = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, [id, pathname]);

  if (!visible || HIDE_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;

  const close = () => {
    const key = `bs-character-popup:${todayKey()}:${id}`;
    window.localStorage.setItem(key, "closed");
    setVisible(false);
  };

  return (
    <aside className={`${styles.popup} ${styles[characterKey] || ""}`} aria-label="最新更新のお知らせ">
      <button className={styles.close} type="button" onClick={close} aria-label="閉じる">×</button>
      <div className={styles.characterWrap}>
        <img src={image} alt={name} className={styles.character} />
      </div>
      <div className={styles.bubble}>
        <span className={styles.name}>{name}</span>
        <strong>{message}</strong>
        <small>{meta}</small>
        <p>{title}</p>
        <Link href={href} onClick={() => setVisible(false)} className={styles.link}>
          見にいく →
        </Link>
      </div>
    </aside>
  );
}

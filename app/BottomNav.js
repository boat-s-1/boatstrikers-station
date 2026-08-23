"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const navItems = [
  { href: "/", label: "ホーム", icon: "home", tone: "home" },
  { href: "/radio", label: "ラジオ", icon: "radio", tone: "radio", onAir: true },
  { href: "/library", label: "図書館", icon: "book", tone: "library" },
  { href: "/races", label: "出走表", icon: "boat", tone: "races" },
  { href: "/schedule", label: "番組表", icon: "calendar", tone: "schedule" },
];

function NavIcon({ type }) {
  if (type === "home") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M7 23.5 24 8l17 15.5" />
        <path d="M11 21.5V40h10V29h6v11h10V21.5" />
      </svg>
    );
  }

  if (type === "radio") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 19h28a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V23a4 4 0 0 1 4-4Z" />
        <path d="m13 16 22-9" />
        <circle cx="33" cy="30" r="5" />
        <path d="M12 28h10M12 34h8" />
      </svg>
    );
  }

  if (type === "book") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M6 10.5c7-1 13 1 18 5v27c-5-4-11-6-18-5Z" />
        <path d="M42 10.5c-7-1-13 1-18 5v27c5-4 11-6 18-5Z" />
      </svg>
    );
  }

  if (type === "boat") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="m8 29 29-4 5 7c-6 7-15 10-25 8-5-1-9-4-11-8Z" />
        <path d="m20 25 5-11h8l5 11" />
        <path d="M8 43c5-2 9-2 14 0 5 2 10 2 17-1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="10" width="34" height="31" rx="5" />
      <path d="M15 6v9M33 6v9M7 20h34" />
      <path d="M14 27h6M27 27h6M14 34h6" />
      <circle cx="34" cy="35" r="7" />
      <path d="M34 31v4l3 2" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className={styles.footerNav} aria-label="フッターナビ">
      <div className={styles.footerInner}>
        <div className={styles.linkGrid}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.linkItem} ${styles[item.tone]} ${active ? styles.active : ""}`}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <span className={styles.iconWrap}>
                  <NavIcon type={item.icon} />
                  {item.onAir ? <span className={styles.onAir}>ON AIR</span> : null}
                </span>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.sparkle} aria-hidden="true">✦</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

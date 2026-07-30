"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const navItems = [
  { href: "/", label: "ホーム" },
  { href: "/races", label: "出走表" },
  { href: "/radio", label: "ラジオ" },
  { href: "/library", label: "図書館" },
  { href: "/bsc2", label: "BSC" },
];

function isCurrentPage(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.footerNav} aria-label="メインメニュー">
      <div className={styles.footerInner}>
        <img
          src="/footer-menu-5.jpg"
          alt=""
          aria-hidden="true"
          className={styles.footerImage}
        />

        <div className={styles.linkGrid}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`${styles.linkItem} ${
                isCurrentPage(pathname, item.href) ? styles.active : ""
              }`}
            >
              <span className={styles.screenReaderOnly}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

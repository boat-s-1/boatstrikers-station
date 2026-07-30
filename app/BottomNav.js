"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const navItems = [
  {
    href: "/",
    label: "ホーム",
  },
  {
    href: "/races",
    label: "出走表",
  },
  {
    href: "/library",
    label: "図書館",
  },
  {
    href: "/bsc2",
    label: "BSC",
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className={styles.footerNav} aria-label="メインメニュー">
      <div className={styles.footerImageWrap}>
        <img
          src="/footer-menu.png"
          alt=""
          className={styles.footerImage}
          aria-hidden="true"
        />

        <div className={styles.linkGrid}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`${styles.linkItem} ${
                isActive(item.href) ? styles.active : ""
              }`}
            >
              <span className={styles.srOnly}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

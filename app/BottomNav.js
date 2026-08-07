"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./BottomNav.module.css";

const navItems = [
  { href: "/", label: "ホーム" },
  { href: "/radio", label: "ラジオ" },
  { href: "/library", label: "図書館" },
  { href: "/races", label: "出走表" },
  { href: "/schedule", label: "番組表" },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className={styles.footerNav} aria-label="フッターナビ">
      <div className={styles.footerInner}>
        <Image
          src="/IMG_6937.jpeg"
          alt="フッターメニュー"
          width={1320}
          height={386}
          className={styles.footerImage}
          priority
        />

        <div className={styles.linkGrid}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.linkItem} ${isActive(item.href) ? styles.active : ""}`}
              aria-label={item.label}
            >
              <span className={styles.screenReaderOnly}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

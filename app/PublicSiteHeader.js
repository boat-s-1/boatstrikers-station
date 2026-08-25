"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./PublicSiteHeader.module.css";

const SOCIALS = [
  {
    key: "line",
    label: "LINE",
    icon: "LINE",
    href: "https://lin.ee/Pf3FEEQ",
    className: "line",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: "▶",
    href: "https://www.youtube.com/@boatstrikers_official",
    className: "youtube",
  },
  {
    key: "x",
    label: "X",
    icon: "𝕏",
    href: "https://x.com/boatstrikers",
    className: "x",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "◎",
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    className: "instagram",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: "♪",
    href: process.env.NEXT_PUBLIC_TIKTOK_URL || "",
    className: "tiktok",
  },
];

const GROUPS = [
  {
    eyebrow: "TODAY",
    title: "今日の情報",
    links: [
      { label: "今日の予定", href: "/schedule" },
      { label: "本日の出走表", href: "/races" },
      { label: "最新の予想実績", href: "/results" },
    ],
  },
  {
    eyebrow: "PREDICTION",
    title: "予想を見る",
    links: [
      { label: "出走表", href: "/races" },
      { label: "一果のイン逃げ予想", href: "/ichika" },
      { label: "初音の女子戦攻略", href: "/hatsune" },
      { label: "キイナの5号艇予想", href: "/kiina" },
      { label: "BSC", href: "/bsc" },
    ],
  },
  {
    eyebrow: "CONTENTS",
    title: "学ぶ・楽しむ",
    links: [
      { label: "図書館", href: "/library" },
      { label: "教えて！一果センセー！", href: "/ichika-sensei" },
      { label: "私立みなも学園〜ふなけん研究部〜", href: "/comic" },
      { label: "ボート・ナイト・ニッポン", href: "/radio" },
      { label: "24場攻略ノート", href: "/library/stadiums" },
      { label: "番組表", href: "/schedule" },
    ],
  },
];

function SocialButton({ item }) {
  if (!item.href) return null;

  const className = `${styles.socialButton} ${styles[item.className]}`;

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <span className={styles.socialCircle}>{item.icon}</span>
      <span>{item.label}</span>
    </a>
  );
}

export default function PublicSiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  const hidden = useMemo(() => {
    const isMagazineViewer =
      /^\/library\/(ichika|hatsune|kiina)-seminar\/[^/]+\/?$/.test(pathname);

    return (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/bsc2/admin") ||
      pathname.startsWith("/bsc2/") ||
      isMagazineViewer
    );
  }, [pathname]);

  const compact = pathname.startsWith("/races");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (hidden) return null;

  return (
    <>
      <header
        className={`${styles.header} PublicSiteHeader_header__glass ${compact ? `${styles.compact} PublicSiteHeader_compact__glass` : ""}`}
      >
        <Link
          href="/"
          prefetch={false}
          className={`${styles.logo} PublicSiteHeader_logo__glass`}
          aria-label="BoatStrikers ホーム"
        >
          <span>BOAT</span>
          <strong>STRIKERS</strong>
        </Link>

        <button
          type="button"
          className={`${styles.menuButton} PublicSiteHeader_menuButton__glass ${open ? `${styles.menuButtonOpen} PublicSiteHeader_menuButtonOpen__glass` : ""}`}
          aria-label={open ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={open}
          aria-controls="boatstrikers-global-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      <div className={`${styles.headerSpacer} ${compact ? styles.headerSpacerCompact : ""}`} aria-hidden="true" />

      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        id="boatstrikers-global-menu"
        className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}
        aria-hidden={!open}
      >
        <div className={styles.drawerTop}>
          <div>
            <p>BOATSTRIKERS MENU</p>
            <h2>メニュー</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
          >
            ×
          </button>
        </div>

        <section className={styles.socialSection}>
          <div className={styles.socialHeading}>
            <span>FOLLOW US</span>
            <strong>最新情報をフォロー</strong>
          </div>

          <div className={styles.socialGrid}>
            {SOCIALS.map((item) => (
              <SocialButton item={item} key={item.key} />
            ))}
          </div>
        </section>

        <nav className={styles.nav} aria-label="BoatStrikers サイトメニュー">
          {GROUPS.map((group) => (
            <section className={styles.navGroup} key={group.eyebrow}>
              <div className={styles.groupHeading}>
                <span>{group.eyebrow}</span>
                <h3>{group.title}</h3>
              </div>

              <div className={styles.linkList}>
                {group.links.map((item) => (
                  <Link
                    href={item.href}
                    prefetch={false}
                    key={`${group.eyebrow}-${item.href}-${item.label}`}
                  >
                    <span>{item.label}</span>
                    <i aria-hidden="true">›</i>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className={styles.drawerFooter}>
          <Link href="/" prefetch={false}>BoatStrikers ホーム</Link>
          <span>© BoatStrikers</span>
        </div>
      </aside>
    </>
  );
}

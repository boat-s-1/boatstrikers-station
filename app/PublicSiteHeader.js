"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import styles from "./PublicSiteHeader.module.css";
import {
  getMemberAuthSnapshot,
  getServerMemberAuthSnapshot,
  requestMemberSignOut,
  subscribeMemberAuth,
} from "./lib/memberAuthState";

const SOCIALS = [
  { key: "line", label: "LINE", icon: "LINE", href: "https://lin.ee/Pf3FEEQ", className: "line" },
  { key: "youtube", label: "YouTube", icon: "▶", href: "https://www.youtube.com/@boatstrikers_official", className: "youtube" },
  { key: "x", label: "X", icon: "𝕏", href: "https://x.com/boatstrikers", className: "x" },
  { key: "instagram", label: "Instagram", icon: "◎", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "", className: "instagram" },
  { key: "tiktok", label: "TikTok", icon: "♪", href: process.env.NEXT_PUBLIC_TIKTOK_URL || "", className: "tiktok" },
];

const HEADER_LOGOS = [
  { match: (path) => path.startsWith("/members") || path.startsWith("/membership"), key: "members", label: "メンバー" },
  { match: (path) => path.startsWith("/today"), key: "today", label: "TODAY" },
  { match: (path) => path.startsWith("/races"), key: "races", label: "出走表" },
  { match: (path) => path.startsWith("/results") || path.startsWith("/ai-results"), key: "results", label: "成績" },
  { match: (path) => path.startsWith("/ichika"), key: "ichika", label: "一果" },
  { match: (path) => path.startsWith("/hatsune"), key: "hatsune", label: "初音" },
  { match: (path) => path.startsWith("/kiina"), key: "kiina", label: "キイナ" },
  { match: (path) => path.startsWith("/library"), key: "library", label: "図書館" },
  { match: (path) => path.startsWith("/radio"), key: "radio", label: "ラジオ" },
  { match: (path) => path.startsWith("/schedule"), key: "schedule", label: "番組表" },
  { match: (path) => path.startsWith("/comic"), key: "comic", label: "漫画" },
];

function getHeaderLogo(pathname) {
  const logo = HEADER_LOGOS.find(({ match }) => match(pathname));
  const key = logo?.key || "home";
  return {
    src: `/header-logos/${key}.webp`,
    label: logo?.label || "ホーム",
  };
}

const GROUPS = [
  {
    eyebrow: "TODAY",
    title: "今日の情報",
    links: [
      { label: "BoatStrikers TODAY", href: "/today" },
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
      { label: "Discordリアルタイム通知", href: "/members/discord" },
    ],
  },
];

function SocialButton({ item }) {
  if (!item.href) return null;
  const className = `${styles.socialButton} ${styles[item.className]}`;
  return (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
      <span className={styles.socialCircle}>{item.icon}</span>
      <span>{item.label}</span>
    </a>
  );
}

export default function PublicSiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const memberAuth = useSyncExternalStore(
    subscribeMemberAuth,
    getMemberAuthSnapshot,
    getServerMemberAuthSnapshot,
  );
  const headerLogo = getHeaderLogo(pathname);

  const hidden = useMemo(() => {
    const isMagazineViewer = /^\/library\/(ichika|hatsune|kiina)-seminar\/[^/]+\/?$/.test(pathname);
    return pathname.startsWith("/admin") || pathname.startsWith("/bsc2/admin") || pathname.startsWith("/bsc2/") || isMagazineViewer;
  }, [pathname]);

  const compact = pathname.startsWith("/races");

  useEffect(() => { setOpen(false); }, [pathname]);

  async function handleSignOut() {
    if (signOutBusy) return;
    setSignOutBusy(true);
    setSignOutError("");
    try {
      await requestMemberSignOut();
    } catch (error) {
      setSignOutError(error?.message || "ログアウトに失敗しました。");
    } finally {
      setSignOutBusy(false);
    }
  }

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 56);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
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
      <header className={`${styles.header} PublicSiteHeader_header__glass ${compact ? `${styles.compact} PublicSiteHeader_compact__glass` : ""} ${scrolled && !open ? "PublicSiteHeader_scrolled__glass" : ""}`}>
        <Link
          href="/"
          prefetch={false}
          className={`${styles.logo} PublicSiteHeader_logo__glass`}
          aria-label={`BoatStrikers ${headerLogo.label}ロゴ。ホームへ戻る`}
          style={{ "--header-logo-image": `url("${headerLogo.src}")` }}
        >
          <span>BOAT</span><strong>STRIKERS</strong>
        </Link>
        <div className={styles.headerActions}>
          {memberAuth.status === "signed_in" ? (
            <Link href="/members" prefetch={false} className={`${styles.authPill} ${styles.authPillSignedIn}`} aria-label="ログイン中。会員メニューを開く">
              <i aria-hidden="true" />ログイン中
            </Link>
          ) : memberAuth.status === "signed_out" ? (
            <Link href="/members?mode=login" prefetch={false} className={styles.authPill}>
              <span aria-hidden="true">♙</span>ログイン
            </Link>
          ) : (
            <span className={`${styles.authPill} ${styles.authPillLoading}`} aria-label="ログイン状態を確認中">確認中</span>
          )}
          <button type="button" className={`${styles.menuButton} PublicSiteHeader_menuButton__glass ${open ? `${styles.menuButtonOpen} PublicSiteHeader_menuButtonOpen__glass` : ""}`} aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open} aria-controls="boatstrikers-global-menu" onClick={() => setOpen((value) => !value)}>
            <span /><span /><span />
          </button>
        </div>
      </header>
      <div className={`${styles.headerSpacer} ${compact ? styles.headerSpacerCompact : ""}`} aria-hidden="true" />
      <div className={`${styles.overlay} ${open ? styles.overlayOpen : ""}`} onClick={() => setOpen(false)} aria-hidden={!open} />
      <aside id="boatstrikers-global-menu" className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`} aria-hidden={!open}>
        <div className={styles.drawerTop}>
          <div><p>BOATSTRIKERS MENU</p><h2>メニュー</h2></div>
          <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="メニューを閉じる">×</button>
        </div>
        <section className={`${styles.memberSection} ${memberAuth.status === "signed_in" ? styles.memberSectionSignedIn : ""}`} aria-live="polite">
          {memberAuth.status === "signed_in" ? (
            <>
              <div className={styles.memberHeading}>
                <span className={styles.memberStatus}><i aria-hidden="true" />ログイン中</span>
                <strong>{memberAuth.user?.displayName || "BoatStrikers メンバー"}</strong>
                {memberAuth.user?.email ? <small>{memberAuth.user.email}</small> : null}
              </div>
              <div className={styles.memberActions}>
                <Link href="/members" prefetch={false} className={styles.memberPrimaryAction}>マイページ</Link>
                <button type="button" onClick={handleSignOut} disabled={signOutBusy}>{signOutBusy ? "ログアウト中…" : "ログアウト"}</button>
              </div>
              {signOutError ? <p className={styles.memberError} role="alert">{signOutError}</p> : null}
            </>
          ) : memberAuth.status === "signed_out" ? (
            <>
              <div className={styles.memberHeading}>
                <span className={styles.memberGuest}>MEMBERS</span>
                <strong>ゲスト</strong>
                <small>無料会員になると、会員向け機能や通知を利用できます。</small>
              </div>
              <div className={styles.memberActions}>
                <Link href="/members?mode=login" prefetch={false} className={styles.memberPrimaryAction}>ログイン</Link>
                <Link href="/members?mode=signup" prefetch={false}>無料会員登録</Link>
              </div>
            </>
          ) : (
            <div className={styles.memberLoading}>ログイン状態を確認しています…</div>
          )}
        </section>
        <section className={styles.socialSection}>
          <div className={styles.socialHeading}><span>FOLLOW US</span><strong>最新情報をフォロー</strong></div>
          <div className={styles.socialGrid}>{SOCIALS.map((item) => <SocialButton item={item} key={item.key} />)}</div>
        </section>
        <nav className={styles.nav} aria-label="BoatStrikers サイトメニュー">
          {GROUPS.map((group) => (
            <section className={styles.navGroup} key={group.eyebrow}>
              <div className={styles.groupHeading}><span>{group.eyebrow}</span><h3>{group.title}</h3></div>
              <div className={styles.linkList}>
                {group.links.map((item) => (
                  <Link href={item.href} prefetch={false} key={`${group.eyebrow}-${item.href}-${item.label}`}>
                    <span>{item.label}</span><i aria-hidden="true">›</i>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className={styles.drawerFooter}><Link href="/" prefetch={false}>BoatStrikers ホーム</Link><span>© BoatStrikers</span></div>
      </aside>
    </>
  );
}

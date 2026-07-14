"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* =========================
   SVGアイコン
========================= */

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="bottomNavIcon"
    >
      <path
        d="M3 10.5 12 3l9 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 9.5V21h13V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21v-6h5v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="bottomNavIcon"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />

      <path
        d="M4.5 21c.7-4.6 3.2-7 7.5-7s6.8 2.4 7.5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="bottomNavIcon"
    >
      <path
        d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="bottomNavIcon"
    >
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================
   メニュー設定
========================= */

const navItems = [
  {
    href: "/",
    label: "ホーム",
    className: "navHome",
    icon: <HomeIcon />,
  },
  {
    href: "/ichika",
    label: "一果",
    className: "navIchika",
    icon: <PersonIcon />,
  },
  {
    href: "/hatsune",
    label: "初音",
    className: "navHatsune",
    icon: <PersonIcon />,
  },
  {
    href: "/kiina",
    label: "キイナ",
    className: "navKiina",
    icon: <StarIcon />,
  },
  {
    href: "/library",
    label: "図書館",
    className: "navLibrary",
    icon: <LibraryIcon />,
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
    <nav
      className="glassBottomNav"
      aria-label="メインメニュー"
    >
      <div className="glassBottomNavInner">
        {navItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              href={item.href}
              key={item.href}
              className={[
                "glassBottomNavItem",
                item.className,
                active ? "isActive" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <span className="bottomNavIconArea">
                <span className="bottomNavActiveLight" />

                {item.icon}
              </span>

              <span className="bottomNavLabel">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

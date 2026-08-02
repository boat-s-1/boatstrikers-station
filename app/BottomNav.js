"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "ホーム",
    icon: "⌂",
  },
  {
    href: "/ichika",
    label: "一果",
    icon: "1",
  },
  {
    href: "/hatsune",
    label: "初音",
    icon: "4",
  },
  {
    href: "/kiina",
    label: "キイナ",
    icon: "5",
  },
  {
    href: "/library",
    label: "図書館",
    icon: "▤",
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
    <nav className="glassBottomNav">
      <div className="glassBottomNavInner">
        {navItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              href={item.href}
              key={item.href}
              className={`glassBottomNavItem ${
                active ? "isActive" : ""
              }`}
            >
              <span className="bottomNavIconArea">
                <span className="bottomNavIcon">
                  {item.icon}
                </span>
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

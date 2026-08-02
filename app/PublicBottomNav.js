"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function PublicBottomNav() {
  const pathname = usePathname() || "/";

  // 管理画面・ログイン画面にはフッターを表示しません。
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return <BottomNav />;
}

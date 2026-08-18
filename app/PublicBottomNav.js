"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function PublicBottomNav() {
  const pathname = usePathname() || "/";

  // 管理画面では固定フッターを表示しません。
  if (pathname.startsWith("/admin")) {
    return null;
  }

  // 雑誌ビューア（各号ページ）では誌面を広く見せるため固定フッターを非表示。
  // 一覧ページ (/library/ichika-seminar など) ではこれまで通り表示します。
  const isMagazineViewer = /^\/library\/(ichika-seminar|hatsune-seminar|kiina-seminar)\/[^/]+\/?$/.test(pathname);

  if (isMagazineViewer) {
    return null;
  }

  return <BottomNav />;
}

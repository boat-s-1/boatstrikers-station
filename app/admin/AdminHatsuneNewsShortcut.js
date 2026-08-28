"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminHatsuneNewsShortcut() {
  const pathname = usePathname();
  if (pathname !== "/admin") return null;

  return (
    <div className="bs-admin-hatsune-shortcut-wrap">
      <Link href="/admin/hatsune-news/editor" className="bs-admin-hatsune-shortcut">
        <span className="bs-admin-hatsune-shortcut-icon">📰</span>
        <span>
          <strong>初音NEWS 記事編集</strong>
          <small>本文・AI再生成・写真・URLを編集</small>
        </span>
        <b>編集する →</b>
      </Link>
    </div>
  );
}

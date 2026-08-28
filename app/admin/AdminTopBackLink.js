"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTopBackLink() {
  const pathname = usePathname();
  if (!pathname || pathname === "/admin") return null;

  return (
    <div className="bs-admin-topbar">
      <div className="bs-admin-topbar-inner">
        <Link href="/admin" className="bs-admin-backlink">
          <span aria-hidden="true">←</span>
          <span>管理トップに戻る</span>
        </Link>
        {["/admin/exhibition-alerts", "/admin/ichika-hidden-escape", "/admin/hatsune-womens-inner-break", "/admin/exhibition-data-status"].some(p => pathname === p || pathname.startsWith(p + "/")) && <Link href="/admin/alerts" className="bs-admin-backlink">← アラート管理へ</Link>}
        <span className="bs-admin-topbar-label">BOATSTRIKERS CMS</span>
      </div>
    </div>
  );
}


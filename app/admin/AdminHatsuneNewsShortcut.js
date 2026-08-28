"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export default function AdminHatsuneNewsShortcut() {
  const pathname = usePathname();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (pathname !== "/admin") {
      setTarget(null);
      return;
    }

    const findTarget = () => {
      const videoLink = document.querySelector('a[href="/admin/hatsune-news/video"]');
      const grid = videoLink?.parentElement || null;
      setTarget(grid);
    };

    findTarget();
    const timer = window.setTimeout(findTarget, 100);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (pathname !== "/admin" || !target) return null;

  const sample = target.querySelector("a");
  const sampleIcon = sample?.querySelector("b");
  const sampleText = sample?.querySelector("div");
  const sampleName = sampleText?.querySelector("div");
  const sampleArrow = sample?.querySelector("i");

  return createPortal(
    <Link href="/admin/hatsune-news/editor" className={sample?.className || ""}>
      <b className={sampleIcon?.className || ""}>📰</b>
      <div className={sampleText?.className || ""}>
        <div className={sampleName?.className || ""}>
          <h3>初音NEWS 記事編集</h3>
          <span>NEW</span>
        </div>
        <p>本文・AI再生成・写真・URLを編集</p>
      </div>
      <i className={sampleArrow?.className || ""}>›</i>
    </Link>,
    target,
  );
}

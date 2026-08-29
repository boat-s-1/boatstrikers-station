"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IchikaNewspaperBannerOverride() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return;

    const replaceBanner = () => {
      const image = document.querySelector('.ichikaPage img[alt="一果新聞"]');
      if (!image) return false;
      image.setAttribute("src", "/top/IMG_7702.jpeg?v=20260829-2121");
      image.setAttribute("alt", "最新の一果新聞");
      return true;
    };

    if (replaceBanner()) return;

    const observer = new MutationObserver(() => {
      if (replaceBanner()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

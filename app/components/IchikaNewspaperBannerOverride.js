"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IchikaNewspaperBannerOverride() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return;

    const replaceBanners = () => {
      let changed = false;

      const newspaperImage = document.querySelector('.ichikaPage img[alt="一果新聞"], .ichikaPage img[alt="最新の一果新聞"]');
      if (newspaperImage) {
        newspaperImage.setAttribute("src", "/top/IMG_7702.jpeg?v=20260829-2121");
        newspaperImage.setAttribute("alt", "最新の一果新聞");
        changed = true;
      }

      const performanceImage = document.querySelector('.ichikaPage img[alt="一果成績"], .ichikaPage img[alt="今月の成績"]');
      if (performanceImage) {
        performanceImage.setAttribute("src", "/top/IMG_7720.jpeg?v=20260830-0016");
        performanceImage.setAttribute("alt", "今月の成績");
        changed = true;
      }

      const labImage = document.querySelector('.ichikaPage img[alt="一果ラボ"], .ichikaPage img[alt="イン逃げラボ"]');
      if (labImage) {
        labImage.setAttribute("src", "/top/IMG_7732.jpeg?v=20260830-0027");
        labImage.setAttribute("alt", "イン逃げラボ");
        changed = true;
      }

      return changed;
    };

    replaceBanners();

    const observer = new MutationObserver(() => {
      replaceBanners();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

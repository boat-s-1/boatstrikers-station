"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IchikaBackgroundOnly() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    let timer;
    let attempts = 0;

    const apply = () => {
      attempts += 1;

      const page = document.querySelector(".ichikaPage");
      if (page) {
        page.style.backgroundAttachment = "fixed";
        page.style.backgroundPosition = "center top";
        page.style.backgroundRepeat = "no-repeat";
        page.style.backgroundSize = "cover";
      }

      const banner = Array.from(document.querySelectorAll(".ichikaPage img")).find((img) =>
        String(img.alt || "").includes("一果AIの今日のイン逃げ注目レース")
      );

      if (banner) {
        const wrapper = banner.parentElement;
        if (wrapper) wrapper.style.display = "none";
        else banner.style.display = "none";
      }

      // バナー用に残った空のラッパーも安全に非表示にする。
      const emptyBlocks = Array.from(document.querySelectorAll(".ichikaPage > div, .ichikaPage > section"));
      emptyBlocks.forEach((node) => {
        if (node.dataset?.ichikaBackgroundOnlyChecked === "1") return;
        node.dataset.ichikaBackgroundOnlyChecked = "1";
        const text = String(node.textContent || "").trim();
        const hasMedia = node.querySelector("img,video,iframe,canvas,svg");
        if (!text && !hasMedia && node.getBoundingClientRect().height > 120 && node.getBoundingClientRect().height < 500) {
          node.style.display = "none";
        }
      });
    };

    apply();
    timer = window.setInterval(() => {
      apply();
      if (attempts >= 20) window.clearInterval(timer);
    }, 250);

    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}

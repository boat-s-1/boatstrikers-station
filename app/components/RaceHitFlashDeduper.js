"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function RaceHitFlashDeduper() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/races") return;

    const groupCards = () => {
      const sections = Array.from(document.querySelectorAll("section"));
      const hitSection = sections.find((section) =>
        section.textContent?.includes("的中速報")
      );
      if (!hitSection) return;

      const cards = Array.from(
        hitSection.querySelectorAll('a[href^="/races/"]')
      );
      if (!cards.length) return;

      const grouped = new Map();

      for (const card of cards) {
        const url = card.getAttribute("href") || "";
        const key = url.split("?")[0];
        if (!key) continue;

        const textBlocks = Array.from(card.querySelectorAll("span"));
        const modeEl = textBlocks.find((el) => {
          const text = (el.textContent || "").trim();
          return text && !text.includes("的中");
        });
        const mode = (modeEl?.textContent || "").trim();

        if (!grouped.has(key)) {
          grouped.set(key, { card, modes: mode ? [mode] : [], modeEl });
          continue;
        }

        const group = grouped.get(key);
        if (mode && !group.modes.includes(mode)) group.modes.push(mode);
        card.style.display = "none";
      }

      for (const group of grouped.values()) {
        if (!group.modeEl || group.modes.length <= 1) continue;
        group.modeEl.textContent = group.modes.join("・");
      }
    };

    groupCards();
    const observer = new MutationObserver(groupCards);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

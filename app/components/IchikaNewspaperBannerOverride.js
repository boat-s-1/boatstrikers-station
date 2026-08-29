"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function setupLabDots() {
  const section = document.querySelector(".ichikaPage .ichikaLabSection");
  const rail = section?.querySelector(".labList");
  if (!section || !rail || rail.dataset.labDotsReady === "true") return () => {};

  const cards = Array.from(rail.children);
  if (cards.length < 2) return () => {};

  rail.dataset.labDotsReady = "true";

  const dots = document.createElement("div");
  dots.className = "ichikaLabDots";
  dots.setAttribute("aria-label", "イン逃げラボの表示位置");

  const buttons = cards.map((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `${index + 1}件目の記事を表示`);

    button.addEventListener("click", () => {
      rail.scrollTo({
        left: card.offsetLeft - rail.offsetLeft,
        behavior: "smooth",
      });
    });

    dots.appendChild(button);
    return button;
  });

  rail.insertAdjacentElement("afterend", dots);

  const updateDots = () => {
    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    let activeIndex = 0;
    let closest = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const center = card.offsetLeft - rail.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(center - railCenter);
      if (distance < closest) {
        closest = distance;
        activeIndex = index;
      }
    });

    buttons.forEach((button, index) => {
      const active = index === activeIndex;
      button.classList.toggle("isActive", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });
  };

  rail.addEventListener("scroll", updateDots, { passive: true });
  updateDots();

  return () => {
    rail.removeEventListener("scroll", updateDots);
    dots.remove();
    delete rail.dataset.labDotsReady;
  };
}

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
        labImage.setAttribute("src", "/top/IMG_7732.jpeg?v=20260830-0043");
        labImage.setAttribute("alt", "イン逃げラボ");

        const labSection = labImage.closest("section.sectionCard");
        if (labSection) {
          labSection.classList.add("ichikaLabSection");
        }
        changed = true;
      }

      return changed;
    };

    replaceBanners();
    let cleanupDots = setupLabDots();

    const observer = new MutationObserver(() => {
      replaceBanners();
      cleanupDots();
      cleanupDots = setupLabDots();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanupDots();
    };
  }, [pathname]);

  return null;
}

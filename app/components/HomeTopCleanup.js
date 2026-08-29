"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HINT_TEXTS = new Set([
  "最新5レース・横にスワイプ →",
  "← 横にスワイプ →",
]);

function hideHomeExtras() {
  const root = document.querySelector("main.page");
  if (!root) return;

  root.querySelectorAll(".homeSectionCard.green").forEach((section) => {
    if (section.textContent?.includes("LINE限定情報")) {
      section.style.display = "none";
    }
  });

  root.querySelectorAll("span, p").forEach((element) => {
    const text = element.textContent?.trim();
    if (text && HINT_TEXTS.has(text)) {
      element.style.display = "none";
    }
  });

  const newspaperBanner = root.querySelector('img[alt="新聞"]');
  if (newspaperBanner) {
    newspaperBanner.setAttribute("src", "/top/IMG_7652.jpeg");
  }

  const memberBanner = root.querySelector('img[alt="メンバー紹介"]');
  if (memberBanner) {
    memberBanner.setAttribute("src", "/top/IMG_7658.jpeg?v=20260829-1158");
  }

  const monthlyForecastBanner = root.querySelector('img[alt="今月の予想実績"]');
  if (monthlyForecastBanner) {
    monthlyForecastBanner.setAttribute("src", "/top/IMG_7665.jpeg?v=20260829-1438");
    monthlyForecastBanner.setAttribute("alt", "今月の予想数");
  }

  document.querySelectorAll('[data-home-compact-realtime="true"]').forEach((node) => {
    node.style.display = "none";
  });
}

function setupNewspaperDots() {
  const rail = document.querySelector("main.page .todayNewsGrid");
  if (!rail || rail.dataset.newsDotsReady === "true") return () => {};

  const cards = Array.from(rail.children);
  if (cards.length < 2) return () => {};

  rail.dataset.newsDotsReady = "true";

  const dots = document.createElement("div");
  dots.dataset.newsDots = "true";
  dots.setAttribute("aria-label", "予想新聞の表示位置");
  dots.style.display = "flex";
  dots.style.justifyContent = "center";
  dots.style.alignItems = "center";
  dots.style.gap = "8px";
  dots.style.margin = "12px 0 0";

  const buttons = cards.map((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `${index + 1}枚目の予想新聞を表示`);
    button.style.width = "9px";
    button.style.height = "9px";
    button.style.padding = "0";
    button.style.border = "0";
    button.style.borderRadius = "999px";
    button.style.background = index === 0 ? "#8f57e8" : "#d9c9f6";
    button.style.cursor = "pointer";
    button.style.transition = "width 160ms ease, background 160ms ease";

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
      button.style.width = active ? "22px" : "9px";
      button.style.background = active ? "#8f57e8" : "#d9c9f6";
      button.setAttribute("aria-current", active ? "true" : "false");
    });
  };

  rail.addEventListener("scroll", updateDots, { passive: true });
  updateDots();

  return () => {
    rail.removeEventListener("scroll", updateDots);
    dots.remove();
    delete rail.dataset.newsDotsReady;
  };
}

export default function HomeTopCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    hideHomeExtras();
    const cleanupDots = setupNewspaperDots();

    const observer = new MutationObserver(() => {
      hideHomeExtras();
      setupNewspaperDots();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupDots();
    };
  }, [pathname]);

  return null;
}

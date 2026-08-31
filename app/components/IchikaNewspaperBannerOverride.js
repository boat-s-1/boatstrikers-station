"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function styleHorizontalRail(rail, cards, { width = "88%", padding = "14px 14px 8px" } = {}) {
  if (!rail || !cards.length) return;

  rail.style.setProperty("display", "flex", "important");
  rail.style.setProperty("flex-wrap", "nowrap", "important");
  rail.style.setProperty("gap", "12px", "important");
  rail.style.setProperty("overflow-x", "auto", "important");
  rail.style.setProperty("overflow-y", "hidden", "important");
  rail.style.setProperty("width", "100%", "important");
  rail.style.setProperty("max-width", "100%", "important");
  rail.style.setProperty("grid-template-columns", "none", "important");
  rail.style.setProperty("scroll-snap-type", "x mandatory", "important");
  rail.style.setProperty("scroll-padding-left", "14px", "important");
  rail.style.setProperty("-webkit-overflow-scrolling", "touch");
  rail.style.setProperty("overscroll-behavior-x", "contain");
  rail.style.setProperty("scrollbar-width", "none");
  rail.style.setProperty("padding", padding, "important");
  rail.style.setProperty("margin", "0", "important");

  cards.forEach((card) => {
    card.style.setProperty("display", "block", "important");
    card.style.setProperty("flex", `0 0 ${width}`, "important");
    card.style.setProperty("width", width, "important");
    card.style.setProperty("min-width", width, "important");
    card.style.setProperty("max-width", width, "important");
    card.style.setProperty("scroll-snap-align", "start", "important");
    card.style.setProperty("scroll-snap-stop", "always", "important");
  });
}

function createDots(rail, cards, label, readyKey) {
  if (!rail || cards.length < 2 || rail.dataset[readyKey] === "true") return () => {};

  rail.dataset[readyKey] = "true";

  const dots = document.createElement("div");
  dots.className = "ichikaLabDots";
  dots.setAttribute("aria-label", label);

  const buttons = cards.map((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `${index + 1}件目を表示`);
    button.addEventListener("click", () => {
      rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: "smooth" });
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
  window.addEventListener("resize", updateDots);
  updateDots();

  return () => {
    rail.removeEventListener("scroll", updateDots);
    window.removeEventListener("resize", updateDots);
    dots.remove();
    delete rail.dataset[readyKey];
  };
}

function forceLabCarousel() {
  const section = document.querySelector(".ichikaPage .ichikaLabSection");
  const rail = section?.querySelector(".labList");
  if (!section || !rail) return;

  const cards = Array.from(rail.children);
  styleHorizontalRail(rail, cards, { width: "88%", padding: "18px 16px 8px" });
}

function setupLabDots() {
  const section = document.querySelector(".ichikaPage .ichikaLabSection");
  const rail = section?.querySelector(".labList");
  if (!section || !rail) return () => {};
  const cards = Array.from(rail.children);
  return createDots(rail, cards, "イン逃げラボの表示位置", "labDotsReady");
}

function findAlertSections() {
  const hiddenImage = document.querySelector('.ichikaPage img[alt="一果アラート 隠れイン理論"]');
  const hiddenSection = hiddenImage?.closest("section") || null;

  const surgeSection = Array.from(document.querySelectorAll(".ichikaPage section")).find((section) =>
    Array.from(section.querySelectorAll("h2")).some((heading) =>
      heading.textContent?.includes("イン逃げ急上昇アラート")
    )
  ) || null;

  return [
    { section: surgeSection, key: "surge", label: "イン逃げ急上昇アラートの表示位置" },
    { section: hiddenSection, key: "hidden", label: "隠れイン理論の表示位置" },
  ].filter((item) => item.section);
}

function getAlertRail(section) {
  if (!section) return null;

  const title = Array.from(section.querySelectorAll("div")).find(
    (node) => node.children.length === 0 && node.textContent?.trim() === "今日のアラート一覧"
  );
  const rail = title?.parentElement?.nextElementSibling || title?.nextElementSibling || null;
  if (!rail) return null;

  const cards = Array.from(rail.children).filter((child) => child.tagName === "ARTICLE");
  return cards.length ? { rail, cards } : null;
}

function forceAlertCarousels() {
  findAlertSections().forEach(({ section, key }) => {
    const target = getAlertRail(section);
    if (!target) return;

    target.rail.dataset.ichikaAlertCarousel = key;
    styleHorizontalRail(target.rail, target.cards, { width: "88%", padding: "14px 14px 8px" });
  });
}

function setupAlertDots() {
  const cleanups = [];

  findAlertSections().forEach(({ section, key, label }) => {
    const target = getAlertRail(section);
    if (!target) return;

    styleHorizontalRail(target.rail, target.cards, { width: "88%", padding: "14px 14px 8px" });
    cleanups.push(createDots(target.rail, target.cards, label, `${key}AlertDotsReady`));
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}

export default function IchikaNewspaperBannerOverride() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return;

    const replaceBanners = () => {
      const newspaperImage = document.querySelector('.ichikaPage img[alt="一果新聞"], .ichikaPage img[alt="最新の一果新聞"]');
      if (newspaperImage) {
        newspaperImage.setAttribute("src", "/top/IMG_7702.jpeg?v=20260829-2121");
        newspaperImage.setAttribute("alt", "最新の一果新聞");
      }

      const performanceImage = document.querySelector('.ichikaPage img[alt="一果成績"], .ichikaPage img[alt="今月の成績"]');
      if (performanceImage) {
        performanceImage.setAttribute("src", "/top/IMG_7720.jpeg?v=20260830-0016");
        performanceImage.setAttribute("alt", "今月の成績");
      }

      const labImage = document.querySelector('.ichikaPage img[alt="一果ラボ"], .ichikaPage img[alt="イン逃げラボ"]');
      if (labImage) {
        labImage.setAttribute("src", "/top/IMG_7732.jpeg?v=20260830-0155");
        labImage.setAttribute("alt", "イン逃げラボ");
        const labSection = labImage.closest("section.sectionCard");
        if (labSection) labSection.classList.add("ichikaLabSection");
      }

      forceLabCarousel();
      forceAlertCarousels();
    };

    let cleanupLabDots = () => {};
    let cleanupAlertDots = () => {};
    let labDotsInitialized = false;
    let alertDotsInitialized = false;

    const ensureDots = () => {
      forceLabCarousel();
      forceAlertCarousels();

      if (!labDotsInitialized) {
        const rail = document.querySelector(".ichikaPage .ichikaLabSection .labList");
        if (rail && rail.children.length >= 2) {
          cleanupLabDots = setupLabDots();
          labDotsInitialized = rail.dataset.labDotsReady === "true";
        }
      }

      if (!alertDotsInitialized) {
        const alertTargets = findAlertSections()
          .map(({ section }) => getAlertRail(section))
          .filter(Boolean);

        if (alertTargets.length) {
          cleanupAlertDots = setupAlertDots();
          alertDotsInitialized = alertTargets.some(({ rail }) =>
            rail.dataset.surgeAlertDotsReady === "true" || rail.dataset.hiddenAlertDotsReady === "true"
          );
        }
      }
    };

    replaceBanners();
    ensureDots();

    const observer = new MutationObserver(() => {
      replaceBanners();
      ensureDots();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupLabDots();
      cleanupAlertDots();
    };
  }, [pathname]);

  return null;
}

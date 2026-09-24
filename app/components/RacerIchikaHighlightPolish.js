"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function findTodaySection() {
  return Array.from(document.querySelectorAll("section")).find((section) => {
    const heading = section.querySelector("h2");
    return heading?.textContent?.trim() === "本日の出走";
  }) || null;
}

function enhanceTodaySection() {
  const section = findTodaySection();
  if (!section) return false;

  const ichikaNote = Array.from(section.querySelectorAll("aside")).find((aside) =>
    aside.textContent?.includes("一果の注目")
  );
  if (!ichikaNote) return true;

  const scroller = Array.from(section.querySelectorAll("div")).find((element) => {
    const style = window.getComputedStyle(element);
    return style.overflowX === "auto" && element.querySelector("article");
  });
  if (!scroller) return false;

  if (ichikaNote.parentElement === scroller) {
    const swipeHint = Array.from(section.children).find((element) =>
      element.textContent?.includes("横にスワイプして出走を確認")
    );
    section.insertBefore(ichikaNote, swipeHint || scroller);
  }

  ichikaNote.dataset.racerIchikaHighlight = "fixed";

  const raceCards = Array.from(scroller.querySelectorAll("article"));
  raceCards.forEach((card) => {
    const isIchikaTarget = Array.from(card.querySelectorAll("span")).some(
      (span) => span.textContent?.trim() === "1号艇"
    );
    if (!isIchikaTarget) return;

    card.dataset.racerIchikaRace = "true";
    if (!card.querySelector("[data-racer-ichika-badge]")) {
      const badge = document.createElement("span");
      badge.dataset.racerIchikaBadge = "true";
      badge.textContent = "一果注目";
      card.appendChild(badge);
    }
  });

  return true;
}

export default function RacerIchikaHighlightPolish() {
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!/^\/racers\/\d{1,5}\/?$/.test(pathname)) return undefined;

    let attempts = 0;
    let timer = null;

    const run = () => {
      attempts += 1;
      const done = enhanceTodaySection();
      if (!done && attempts < 20) timer = window.setTimeout(run, 120);
    };

    run();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}

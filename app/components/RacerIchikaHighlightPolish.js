"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function findTodaySection() {
  return Array.from(document.querySelectorAll("section")).find((section) => {
    const heading = section.querySelector("h2");
    return heading?.textContent?.trim() === "本日の出走";
  }) || null;
}

function getRaceLabel(card) {
  const heading = card?.querySelector("strong")?.textContent?.trim() || "";
  const match = heading.match(/^(.+?)\s+(\d+)R$/);
  if (!match) return { full: heading, venue: heading, race: "" };
  return { full: heading, venue: match[1], race: `${match[2]}R` };
}

function enhanceTodaySection() {
  const section = findTodaySection();
  if (!section) return false;

  const scroller = Array.from(section.querySelectorAll("div")).find((element) => {
    const style = window.getComputedStyle(element);
    return style.overflowX === "auto" && element.querySelector("article");
  });
  if (!scroller) return false;

  const raceCards = Array.from(scroller.querySelectorAll("article"));
  if (!raceCards.length) return true;

  raceCards.forEach((card) => {
    card.dataset.racerTodayCard = "true";
  });

  const ichikaNote = Array.from(section.querySelectorAll("aside")).find((aside) =>
    aside.textContent?.includes("一果の注目")
  );

  const targetCard = raceCards.find((card) =>
    Array.from(card.querySelectorAll("span")).some((span) => span.textContent?.trim() === "1号艇")
  ) || null;

  if (ichikaNote) {
    if (ichikaNote.parentElement === scroller) {
      const swipeHint = Array.from(section.children).find((element) =>
        element.textContent?.includes("横にスワイプして出走を確認")
      );
      section.insertBefore(ichikaNote, swipeHint || scroller);
    }

    ichikaNote.dataset.racerIchikaHighlight = "fixed";

    if (targetCard) {
      const label = getRaceLabel(targetCard);
      const title = ichikaNote.querySelector("strong");
      const description = ichikaNote.querySelector("p");
      if (title && label.full) title.textContent = `${label.full}・1号艇を一果が注目`;
      if (description) description.textContent = "この選手のイン成績と合わせてチェック。";

      const targetLink = targetCard.querySelector("a[href]");
      if (targetLink && !ichikaNote.querySelector("[data-racer-ichika-link]")) {
        const link = document.createElement("a");
        link.dataset.racerIchikaLink = "true";
        link.href = targetLink.getAttribute("href") || "#";
        link.textContent = `${label.full || "注目レース"}を見る ›`;
        ichikaNote.appendChild(link);
      }
    }
  }

  raceCards.forEach((card) => {
    const isIchikaTarget = card === targetCard;
    if (!isIchikaTarget) return;

    card.dataset.racerIchikaRace = "true";
    if (!card.querySelector("[data-racer-ichika-badge]")) {
      const badge = document.createElement("span");
      badge.dataset.racerIchikaBadge = "true";
      badge.textContent = "一果注目";
      card.appendChild(badge);
    }
  });

  if (!section.querySelector("[data-racer-today-summary]")) {
    const labels = raceCards.map(getRaceLabel).filter((item) => item.venue);
    const venues = [...new Set(labels.map((item) => item.venue))];
    const summary = document.createElement("div");
    summary.dataset.racerTodaySummary = "true";

    const venueText = venues.length === 1 ? `${venues[0]}で${raceCards.length}走` : `${venues.join("・")}で${raceCards.length}走`;
    if (targetCard) {
      const target = getRaceLabel(targetCard);
      summary.innerHTML = `<span>今日の要約</span><strong>今日は${venueText}。${target.race || target.full}は1号艇で注目。</strong>`;
    } else {
      summary.innerHTML = `<span>今日の要約</span><strong>今日は${venueText}。</strong>`;
    }

    const headingRow = section.querySelector(":scope > div");
    if (headingRow?.nextSibling) section.insertBefore(summary, headingRow.nextSibling);
    else section.prepend(summary);
  }

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

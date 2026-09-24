"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ICONS = {
  一果: "/characters/ichika-racer-icon.webp",
  キイナ: "/characters/kiina-racer-icon.webp",
};

function findSectionByHeading(label) {
  return Array.from(document.querySelectorAll("section")).find(
    (section) => section.querySelector("h2")?.textContent?.trim() === label
  ) || null;
}

function enhanceCharacterIcons() {
  const section = findSectionByHeading("BoatStrikersの視点");
  if (!section) return;

  Array.from(section.querySelectorAll("article")).forEach((card) => {
    const title = card.querySelector("strong")?.textContent?.trim() || "";
    const character = title.startsWith("一果") ? "一果" : title.startsWith("キイナ") ? "キイナ" : null;
    if (!character || card.dataset.racerCharacterIcon === "true") return;

    const badge = card.firstElementChild;
    if (!badge) return;

    badge.textContent = "";
    const image = document.createElement("img");
    image.src = ICONS[character];
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    badge.appendChild(image);
    badge.dataset.racerCharacterBadge = character === "一果" ? "ichika" : "kiina";
    card.dataset.racerCharacterIcon = "true";
  });
}

function moveRelatedToBottom() {
  const related = findSectionByHeading("関連コンテンツ");
  const affinity = document.querySelector('section[aria-label="水面相性"]');
  if (!related || !affinity) return;

  related.dataset.racerRelatedBottom = "true";
  if (affinity.nextElementSibling !== related) {
    affinity.insertAdjacentElement("afterend", related);
  }
}

function polishRacerPage() {
  enhanceCharacterIcons();
  moveRelatedToBottom();
}

export default function RacerRelatedBottomPolish() {
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!/^\/racers\/\d{1,5}\/?$/.test(pathname)) return undefined;

    let scheduled = false;
    const run = () => {
      scheduled = false;
      polishRacerPage();
    };

    run();
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(run);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

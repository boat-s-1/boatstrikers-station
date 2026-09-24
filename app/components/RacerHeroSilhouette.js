"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function installSilhouette() {
  const hero = document.querySelector("main section");
  if (!hero) return false;

  const heading = hero.querySelector("h1");
  const inner = heading?.parentElement;
  if (!heading || !inner) return false;
  if (inner.querySelector("[data-racer-photo-slot]")) return true;

  const row = document.createElement("div");
  row.dataset.racerNamePhotoRow = "true";
  heading.insertAdjacentElement("beforebegin", row);
  row.appendChild(heading);

  const slot = document.createElement("div");
  slot.dataset.racerPhotoSlot = "true";
  slot.setAttribute("aria-label", "選手写真準備中");
  slot.innerHTML = `
    <div data-racer-silhouette aria-hidden="true">
      <svg viewBox="0 0 160 190" role="presentation" focusable="false">
        <circle cx="80" cy="56" r="34" />
        <path d="M23 174c4-45 23-69 57-69s53 24 57 69H23Z" />
      </svg>
    </div>
    <div data-racer-photo-copy>
      <span>PHOTO</span>
      <small>準備中</small>
    </div>
  `;

  row.appendChild(slot);
  inner.dataset.racerHeroWithPhoto = "true";
  return true;
}

export default function RacerHeroSilhouette() {
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!/^\/racers\/\d{1,5}\/?$/.test(pathname)) return undefined;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (installSilhouette() || tries >= 20) window.clearInterval(timer);
    }, 120);

    installSilhouette();
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}

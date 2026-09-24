"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function createPhotoSlot() {
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
  return slot;
}

function cleanupDuplicateStructures(hero, keepGrid, keepSlot) {
  Array.from(hero.querySelectorAll("[data-racer-photo-slot]")).forEach((slot) => {
    if (slot !== keepSlot) slot.remove();
  });

  Array.from(hero.querySelectorAll("[data-racer-identity-grid]")).forEach((grid) => {
    if (grid === keepGrid) return;
    const name = grid.querySelector("h1");
    const kana = grid.querySelector("p");
    if (name && keepGrid && !keepGrid.contains(name)) {
      keepGrid.querySelector("[data-racer-name-cell]")?.appendChild(name);
    }
    if (kana && keepGrid && !keepGrid.contains(kana)) {
      keepGrid.querySelector("[data-racer-kana-cell]")?.appendChild(kana);
    }
    grid.remove();
  });
}

function installSilhouette() {
  const hero = document.querySelector("main section");
  if (!hero) return false;

  const existingGrid = hero.querySelector("[data-racer-identity-grid]");
  if (existingGrid) {
    const photoCell = existingGrid.querySelector("[data-racer-photo-cell]");
    if (!photoCell) return false;

    const slots = Array.from(hero.querySelectorAll("[data-racer-photo-slot]"));
    const keep = slots[0] || createPhotoSlot();
    if (keep.parentElement !== photoCell) photoCell.appendChild(keep);
    cleanupDuplicateStructures(hero, existingGrid, keep);
    return true;
  }

  const heading = hero.querySelector("h1");
  const inner = heading?.parentElement;
  if (!heading || !inner) return false;

  const kana = heading.nextElementSibling?.tagName === "P" ? heading.nextElementSibling : null;
  const existingSlots = Array.from(hero.querySelectorAll("[data-racer-photo-slot]"));
  const slot = existingSlots[0] || createPhotoSlot();

  const grid = document.createElement("div");
  grid.dataset.racerIdentityGrid = "true";
  heading.insertAdjacentElement("beforebegin", grid);

  const kanaCell = document.createElement("div");
  kanaCell.dataset.racerKanaCell = "true";
  if (kana) kanaCell.appendChild(kana);
  grid.appendChild(kanaCell);

  const favoriteCell = document.createElement("div");
  favoriteCell.dataset.racerFavoriteCell = "true";
  grid.appendChild(favoriteCell);

  const nameCell = document.createElement("div");
  nameCell.dataset.racerNameCell = "true";
  nameCell.appendChild(heading);
  grid.appendChild(nameCell);

  const photoCell = document.createElement("div");
  photoCell.dataset.racerPhotoCell = "true";
  photoCell.appendChild(slot);
  grid.appendChild(photoCell);

  inner.dataset.racerHeroWithPhoto = "true";
  cleanupDuplicateStructures(hero, grid, slot);
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

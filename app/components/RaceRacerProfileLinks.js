"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isRaceDetailPath(pathname) {
  return /^\/races\/\d{1,2}\/\d{1,2}\/?$/.test(pathname || "");
}

function registrationFromText(value) {
  const match = String(value || "").match(/登録番号\s*([0-9]{3,5})/);
  if (!match) return null;
  const digits = match[1].replace(/^0+/, "") || match[1];
  return digits || null;
}

function enhanceRacerLinks() {
  const headings = Array.from(document.querySelectorAll("h3"));
  let enhanced = 0;

  headings.forEach((heading) => {
    if (heading.dataset.racerProfileLinked === "true") return;
    if (heading.closest("a")) return;

    const area = heading.parentElement;
    if (!area) return;

    const registrationLine = Array.from(area.querySelectorAll("p")).find((paragraph) =>
      paragraph.textContent?.includes("登録番号")
    );
    const registrationNo = registrationFromText(registrationLine?.textContent);
    if (!registrationNo) return;

    const racerLabel = heading.textContent?.trim() || "選手";
    const link = document.createElement("a");
    link.href = `/racers/${registrationNo}`;
    link.className = "bs-racer-profile-link";
    link.setAttribute("aria-label", `${racerLabel}の選手攻略FILEを見る`);

    while (heading.firstChild) {
      link.appendChild(heading.firstChild);
    }

    const cue = document.createElement("span");
    cue.className = "bs-racer-profile-link__cue";
    cue.textContent = "攻略FILE ›";
    cue.setAttribute("aria-hidden", "true");
    link.appendChild(cue);

    heading.appendChild(link);
    heading.dataset.racerProfileLinked = "true";
    enhanced += 1;
  });

  return enhanced;
}

export default function RaceRacerProfileLinks() {
  const pathname = usePathname() || "";

  useEffect(() => {
    if (!isRaceDetailPath(pathname)) return undefined;

    let scheduled = false;
    const run = () => {
      scheduled = false;
      enhanceRacerLinks();
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

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import MonthlyPerformanceSlider from "./MonthlyPerformanceSlider";

const CHARACTER_BY_PATH = {
  "/ichika": "ichika",
  "/hatsune": "hatsune",
  "/kiina": "kiina",
};

export default function CharacterPerformancePortal() {
  const pathname = usePathname();
  const character = CHARACTER_BY_PATH[pathname] || null;
  const [mount, setMount] = useState(null);

  useEffect(() => {
    setMount(null);
    if (!character) return undefined;

    const recordGrid = document.querySelector(".recordGrid");
    if (!recordGrid) return undefined;

    const host = document.createElement("div");
    host.setAttribute("data-character-performance", character);
    recordGrid.parentNode?.insertBefore(host, recordGrid);

    const previousDisplay = recordGrid.style.display;
    recordGrid.style.display = "none";
    setMount(host);

    return () => {
      recordGrid.style.display = previousDisplay;
      host.remove();
    };
  }, [character]);

  if (!character || !mount) return null;
  return createPortal(<MonthlyPerformanceSlider character={character} />, mount);
}

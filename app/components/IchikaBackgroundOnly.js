"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IchikaBackgroundOnly() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    const page = document.querySelector(".ichikaPage");
    if (!page) return undefined;

    const prevBackground = page.style.background;
    const prevPosition = page.style.position;
    const prevZIndex = page.style.zIndex;

    page.style.background = "transparent";
    page.style.position = "relative";
    page.style.zIndex = "1";

    return () => {
      page.style.background = prevBackground;
      page.style.position = prevPosition;
      page.style.zIndex = prevZIndex;
    };
  }, [pathname]);

  if (pathname !== "/ichika") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundImage: 'url("/images/ichika/ichika-room-bg.webp")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center top",
        backgroundSize: "cover",
        backgroundColor: "#eef8fb",
      }}
    />
  );
}

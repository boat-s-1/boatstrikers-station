"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function IchikaFixedWallpaperLayer() {
  const pathname = usePathname();
  const [backgroundImage, setBackgroundImage] = useState("");

  useEffect(() => {
    if (pathname !== "/ichika") {
      setBackgroundImage("");
      return;
    }

    const readBackground = () => {
      const value = window.getComputedStyle(document.body).backgroundImage;
      if (value && value !== "none") {
        setBackgroundImage(value);
      }
    };

    readBackground();
    const timer = window.setTimeout(readBackground, 100);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (pathname !== "/ichika" || !backgroundImage) return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundColor: "#eef8fb",
          backgroundImage,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          backgroundSize: "cover",
        }}
      />
      <style>{`
        body:has(.ichikaPage) {
          background-image: none !important;
          background-color: #eef8fb !important;
        }

        body:has(.ichikaPage) > *:not([aria-hidden="true"]) {
          position: relative;
          z-index: 1;
        }

        .ichikaPage {
          background: transparent !important;
        }
      `}</style>
    </>
  );
}

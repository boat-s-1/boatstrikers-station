"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IchikaBackgroundOnly() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    const page = document.querySelector(".ichikaPage");
    if (!page) return undefined;

    const previous = {
      backgroundImage: page.style.backgroundImage,
      backgroundColor: page.style.backgroundColor,
      backgroundRepeat: page.style.backgroundRepeat,
      backgroundPosition: page.style.backgroundPosition,
      backgroundSize: page.style.backgroundSize,
      backgroundAttachment: page.style.backgroundAttachment,
    };

    page.style.setProperty(
      "background-image",
      'url("/images/ichika/ichika-room-bg.webp")',
      "important"
    );
    page.style.setProperty("background-color", "#eef8fb", "important");
    page.style.setProperty("background-repeat", "no-repeat", "important");
    page.style.setProperty("background-position", "center top", "important");
    page.style.setProperty("background-size", "cover", "important");
    page.style.setProperty("background-attachment", "fixed", "important");

    return () => {
      page.style.backgroundImage = previous.backgroundImage;
      page.style.backgroundColor = previous.backgroundColor;
      page.style.backgroundRepeat = previous.backgroundRepeat;
      page.style.backgroundPosition = previous.backgroundPosition;
      page.style.backgroundSize = previous.backgroundSize;
      page.style.backgroundAttachment = previous.backgroundAttachment;
    };
  }, [pathname]);

  return null;
}

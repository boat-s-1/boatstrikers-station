"use client";

import { usePathname } from "next/navigation";

export default function IchikaBackgroundOnly() {
  const pathname = usePathname();

  if (pathname !== "/ichika") return null;

  return (
    <style>{`
      .ichikaPage {
        position: relative !important;
        isolation: isolate !important;
        background: transparent !important;
      }

      .ichikaPage::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-color: #eef8fb;
        background-image: url("/images/ichika/ichika-room-bg.webp");
        background-repeat: no-repeat;
        background-position: center top;
        background-size: min(100vw, 430px) auto;
      }

      .ichikaPage > * {
        position: relative;
        z-index: 1;
      }

      @media (min-width: 431px) {
        .ichikaPage::before {
          background-size: 430px auto;
        }
      }
    `}</style>
  );
}

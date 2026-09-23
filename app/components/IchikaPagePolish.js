"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./IchikaPagePolish.module.css";

export default function IchikaPagePolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    let observer;
    let applying = false;

    const apply = () => {
      if (applying) return;
      applying = true;

      const page = document.querySelector(".ichikaPage");
      if (!page) {
        applying = false;
        return;
      }

      const introSection = Array.from(page.querySelectorAll("section.sectionCard")).find((section) =>
        String(section.querySelector("h1")?.textContent || "").includes("一果のイン逃げ研究室")
      );

      if (introSection) {
        const linksRow = introSection.querySelector(".sectionTitleRow");
        if (linksRow) linksRow.classList.add(styles.guideLinks);
        linksRow?.querySelectorAll("a").forEach((link) => link.classList.add(styles.guideLink));

        if (page.lastElementChild !== introSection) {
          page.appendChild(introSection);
        }
      }

      document
        .querySelectorAll('section[aria-label="一果 研究ツール"]')
        .forEach((section) => {
          section.style.display = "none";
        });

      applying = false;
    };

    apply();
    observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      document
        .querySelectorAll('section[aria-label="一果 研究ツール"]')
        .forEach((section) => {
          section.style.display = "";
        });
    };
  }, [pathname]);

  return null;
}

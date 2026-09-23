"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LABEL_BY_PATH = {
  "/ichika": "一果",
  "/hatsune": "初音",
  "/kiina": "キイナ",
};

export default function HideCharacterResearchTool() {
  const pathname = usePathname();
  const label = LABEL_BY_PATH[pathname];

  useEffect(() => {
    if (!label) return undefined;
    const hide = () => {
      const node = document.querySelector(`section[aria-label="${label} 研究ツール"]`);
      if (node) node.style.display = "none";
    };
    hide();
    const observer = new MutationObserver(hide);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [label]);

  return null;
}

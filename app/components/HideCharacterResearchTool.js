"use client";

import { useEffect } from "react";

export default function HideCharacterResearchTool({ characterLabel }) {
  useEffect(() => {
    const hide = () => {
      const node = document.querySelector(`section[aria-label="${characterLabel} 研究ツール"]`);
      if (node) node.style.display = "none";
    };

    hide();
    const observer = new MutationObserver(hide);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [characterLabel]);

  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IchikaSafeBanner() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    let timer;
    let attempts = 0;

    const apply = () => {
      attempts += 1;
      const page = document.querySelector(".ichikaPage");
      const hero = page?.querySelector(".hero");
      if (!page || !hero) return;

      const brokenImg = Array.from(page.querySelectorAll("img")).find((img) => {
        const alt = String(img.alt || "");
        return alt.includes("一果AI") && alt.includes("イン逃げ");
      });

      if (brokenImg) {
        const rawSrc = brokenImg.getAttribute("src") || "";

        // 元の壊れた枠は削除せず、安全に非表示だけにする。
        const parent = brokenImg.parentElement;
        if (parent) parent.style.display = "none";
        brokenImg.style.display = "none";

        // 見出しだけ残っている場合も隠す。
        let node = parent;
        for (let i = 0; i < 2 && node?.parentElement; i += 1) {
          const text = String(node.textContent || "").trim();
          if (text.includes("一果AIの今日のイン逃げ注目レース") && node.children.length <= 4) {
            node.style.display = "none";
            break;
          }
          node = node.parentElement;
        }

        // CSS背景ならSafariでも表示できるため、新しい安全なバナー枠を追加。
        if (!document.getElementById("ichika-safe-ai-banner") && rawSrc.startsWith("data:image/")) {
          const banner = document.createElement("section");
          banner.id = "ichika-safe-ai-banner";
          banner.setAttribute("aria-label", "一果AI 今日のイン逃げ注目レース");
          Object.assign(banner.style, {
            width: "calc(100% - 32px)",
            maxWidth: "1120px",
            aspectRatio: "1536 / 461",
            margin: "14px auto 12px",
            borderRadius: "18px",
            overflow: "hidden",
            backgroundImage: `url(${JSON.stringify(rawSrc)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            boxShadow: "0 10px 28px rgba(31,78,121,.14)",
          });
          hero.insertAdjacentElement("afterend", banner);
        }
      }

      // AIパネル本体は残し、画像バナーと重複する文字見出しだけ隠す。
      const aiPanel = document.querySelector('section[aria-label="一果 AI予想"]');
      if (aiPanel?.firstElementChild) aiPanel.firstElementChild.style.display = "none";

      // 背景は今の表示方式を維持しつつ、可能なブラウザでは固定表示にする。
      Object.assign(page.style, {
        backgroundAttachment: "fixed",
        backgroundPosition: "center top",
        backgroundRepeat: "repeat-y",
      });
    };

    apply();
    timer = window.setInterval(() => {
      apply();
      if (attempts >= 20) window.clearInterval(timer);
    }, 250);

    return () => {
      window.clearInterval(timer);
      document.getElementById("ichika-safe-ai-banner")?.remove();
    };
  }, [pathname]);

  return null;
}

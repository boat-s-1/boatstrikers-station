"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function dataUriToBlobUrl(dataUri) {
  if (!dataUri || !String(dataUri).startsWith("data:")) return null;
  try {
    const comma = String(dataUri).indexOf(",");
    if (comma < 0) return null;
    const header = String(dataUri).slice(0, comma);
    const payload = String(dataUri).slice(comma + 1);
    const mime = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
    const binary = header.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

function getDataUriFromBackground(value) {
  const text = String(value || "");
  const start = text.indexOf("data:image/");
  if (start < 0) return null;
  const endQuote = text.indexOf('"', start);
  const endParen = text.indexOf(")", start);
  const ends = [endQuote, endParen].filter((n) => n > start);
  const end = ends.length ? Math.min(...ends) : text.length;
  return text.slice(start, end);
}

function findOldBanner(page) {
  const img = Array.from(page.querySelectorAll("img")).find((node) => {
    const alt = String(node.alt || "");
    return alt.includes("一果AI") && alt.includes("イン逃げ");
  });
  if (!img) return { img: null, wrapper: null };

  let wrapper = img.parentElement;
  for (let i = 0; i < 4 && wrapper?.parentElement; i += 1) {
    const text = String(wrapper.textContent || "");
    if (text.includes("一果AIの今日のイン逃げ注目レース")) break;
    wrapper = wrapper.parentElement;
  }
  return { img, wrapper };
}

export default function IchikaStableTheme() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    const objectUrls = [];
    let observer;
    let timer;

    const apply = () => {
      const page = document.querySelector(".ichikaPage");
      const hero = document.querySelector(".ichikaPage .hero");
      if (!page || !hero) return;

      // 1) 背景は固定レイヤー化。コンテンツだけがスクロールする見え方にする。
      if (!document.getElementById("ichika-fixed-wallpaper")) {
        const computed = getComputedStyle(page).backgroundImage;
        const inline = page.style.backgroundImage;
        const dataUri = getDataUriFromBackground(inline) || getDataUriFromBackground(computed);
        const bgUrl = dataUriToBlobUrl(dataUri);
        if (bgUrl) {
          objectUrls.push(bgUrl);
          const layer = document.createElement("div");
          layer.id = "ichika-fixed-wallpaper";
          Object.assign(layer.style, {
            position: "fixed",
            inset: "0",
            zIndex: "-1",
            pointerEvents: "none",
            backgroundImage: `linear-gradient(rgba(255,255,255,.18), rgba(255,255,255,.18)), url("${bgUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          });
          document.body.prepend(layer);
          document.body.style.background = "transparent";
          page.style.background = "transparent";
          page.style.position = "relative";
          page.style.zIndex = "0";
        }
      }

      // 2) 旧バナーから画像データだけ取り出し、壊れたDOMは削除。
      const { img, wrapper } = findOldBanner(page);
      let bannerData = null;
      if (img) {
        const raw = img.getAttribute("src") || "";
        if (raw.startsWith("data:image/")) bannerData = raw;
      }

      if (wrapper && !wrapper.id?.includes("ichika-stable-ai-banner")) {
        wrapper.remove();
      } else if (img) {
        img.remove();
      }

      // 3) バナーは img ではなく CSS 背景として描画。
      if (!document.getElementById("ichika-stable-ai-banner") && bannerData) {
        const bannerUrl = dataUriToBlobUrl(bannerData);
        if (bannerUrl) {
          objectUrls.push(bannerUrl);
          const section = document.createElement("section");
          section.id = "ichika-stable-ai-banner";
          section.setAttribute("aria-label", "一果AI 今日のイン逃げ注目レース");
          Object.assign(section.style, {
            width: "calc(100% - 32px)",
            maxWidth: "1120px",
            aspectRatio: "1536 / 461",
            margin: "16px auto 12px",
            borderRadius: "18px",
            overflow: "hidden",
            backgroundImage: `url("${bannerUrl}")`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            boxShadow: "0 10px 28px rgba(31, 78, 121, .14)",
          });
          hero.insertAdjacentElement("afterend", section);
        }
      }

      // 4) AIパネル側の文字見出しはバナーと重複するので非表示。
      const aiPanel = document.querySelector('section[aria-label="一果 AI予想"]');
      if (aiPanel?.firstElementChild) aiPanel.firstElementChild.style.display = "none";
    };

    apply();
    timer = window.setInterval(apply, 250);
    window.setTimeout(() => window.clearInterval(timer), 6000);

    observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
      document.getElementById("ichika-fixed-wallpaper")?.remove();
      document.getElementById("ichika-stable-ai-banner")?.remove();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pathname]);

  return null;
}

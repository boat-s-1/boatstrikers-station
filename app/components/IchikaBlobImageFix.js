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

function extractDataUri(value) {
  const text = String(value || "");
  const start = text.indexOf("data:image/");
  if (start < 0) return null;
  let end = text.indexOf('"', start);
  if (end < 0) end = text.indexOf("'", start);
  if (end < 0) end = text.indexOf(")", start);
  if (end < 0) end = text.length;
  return text.slice(start, end);
}

export default function IchikaBlobImageFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    const objectUrls = [];
    let attempts = 0;
    let bgDone = false;
    let bannerDone = false;

    const apply = () => {
      attempts += 1;
      const page = document.querySelector(".ichikaPage");
      if (!page) return;

      // 背景はinline/computedのどちらからでも拾う。
      if (!bgDone) {
        const bgValue = page.style.backgroundImage || window.getComputedStyle(page).backgroundImage;
        const bgData = extractDataUri(bgValue);
        if (bgData) {
          const bgUrl = dataUriToBlobUrl(bgData);
          if (bgUrl) {
            objectUrls.push(bgUrl);
            Object.assign(page.style, {
              backgroundImage: `linear-gradient(rgba(255,255,255,.18), rgba(255,255,255,.18)), url("${bgUrl}")`,
              backgroundSize: "100% auto",
              backgroundPosition: "center top",
              backgroundRepeat: "repeat-y",
              backgroundColor: "#eefaff",
            });
            bgDone = true;
          }
        }
      }

      const banner = Array.from(page.querySelectorAll("img")).find((img) =>
        String(img.alt || "").includes("一果AI") && String(img.alt || "").includes("イン逃げ")
      );

      if (banner) {
        if (!bannerDone) {
          const src = banner.getAttribute("src") || "";
          if (src.startsWith("data:")) {
            const bannerUrl = dataUriToBlobUrl(src);
            if (bannerUrl) {
              objectUrls.push(bannerUrl);
              banner.src = bannerUrl;
              bannerDone = true;
            }
          } else if (src.startsWith("blob:") || src.startsWith("/" ) || src.startsWith("http")) {
            bannerDone = true;
          }
        }

        banner.removeAttribute("width");
        banner.removeAttribute("height");
        Object.assign(banner.style, {
          width: "100%",
          height: "auto",
          minHeight: "0",
          display: "block",
          objectFit: "contain",
        });

        const box = banner.parentElement;
        if (box) {
          Object.assign(box.style, {
            height: "auto",
            minHeight: "0",
            aspectRatio: "auto",
            overflow: "hidden",
            lineHeight: "0",
          });
        }
      }

      // テーマ側に追加された画像外の重複タイトルを消す。
      Array.from(page.querySelectorAll("h1,h2,h3,p,div,span")).forEach((el) => {
        if (el.children.length === 0 && el.textContent?.trim() === "一果AIの今日のイン逃げ注目レース") {
          el.style.display = "none";
        }
      });

      // AIカード側の旧見出しもバナーと重複するため非表示。
      const aiPanel = document.querySelector('section[aria-label="一果 AI予想"]');
      if (aiPanel?.firstElementChild) aiPanel.firstElementChild.style.display = "none";
    };

    apply();
    const timer = window.setInterval(() => {
      apply();
      if ((bgDone && bannerDone) || attempts >= 24) window.clearInterval(timer);
    }, 250);

    return () => {
      window.clearInterval(timer);
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pathname]);

  return null;
}

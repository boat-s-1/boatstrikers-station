"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function dataUriToBlobUrl(dataUri) {
  if (!dataUri || !String(dataUri).startsWith("data:")) return null;
  try {
    const [header, payload] = String(dataUri).split(",", 2);
    const mime = header.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
    const isBase64 = header.includes(";base64");
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

function extractDataUriFromBackground(value) {
  const text = String(value || "");
  const match = text.match(/url\(["']?(data:[^"')]+)["']?\)/);
  return match?.[1] || null;
}

export default function IchikaBlobImageFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ichika") return undefined;

    const urls = [];
    let attempts = 0;

    const apply = () => {
      attempts += 1;
      const page = document.querySelector(".ichikaPage");
      if (!page) return;

      // 背景: data URI -> blob URL
      const inlineBg = page.style.backgroundImage;
      const bgData = extractDataUriFromBackground(inlineBg);
      if (bgData) {
        const bgUrl = dataUriToBlobUrl(bgData);
        if (bgUrl) {
          urls.push(bgUrl);
          Object.assign(page.style, {
            backgroundImage: `linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,.22)), url("${bgUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "repeat-y",
          });
        }
      }

      // AIバナー: data URI -> blob URL
      const banner = Array.from(page.querySelectorAll("img")).find((img) =>
        String(img.alt || "").includes("一果AI") && String(img.alt || "").includes("イン逃げ")
      );

      if (banner) {
        const src = banner.getAttribute("src") || banner.src;
        if (String(src).startsWith("data:")) {
          const bannerUrl = dataUriToBlobUrl(src);
          if (bannerUrl) {
            urls.push(bannerUrl);
            banner.src = bannerUrl;
          }
        }

        banner.removeAttribute("width");
        banner.removeAttribute("height");
        Object.assign(banner.style, {
          width: "100%",
          height: "auto",
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

      // バナーがあるため旧AI見出しは重複表示しない
      const aiPanel = document.querySelector('section[aria-label="一果 AI予想"]');
      if (aiPanel?.firstElementChild) aiPanel.firstElementChild.style.display = "none";
    };

    apply();
    const timer = window.setInterval(() => {
      apply();
      if (attempts >= 20) window.clearInterval(timer);
    }, 250);

    return () => {
      window.clearInterval(timer);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pathname]);

  return null;
}

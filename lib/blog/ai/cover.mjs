import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement as h } from "react";
import sharp from "sharp";
import { characterImage, BLOG_CHARACTERS } from "../characterAssets.mjs";

// Template cover: existing character art + BLOG palette (cream #f8f7f2, green #175c49).
// No generative imagery; the character illustration is always one of the registered poses.
export const COVER_SIZE = { width: 1200, height: 630 };
const ACCENTS = { ichika: { main: "#208846", tint: "#f0faf2" }, hatsune: { main: "#a63a85", tint: "#fbf0f7" }, kiina: { main: "#8a6100", tint: "#fbf6e6" } };

export function coverSpec({ title, categoryName, stadiumName = null, character, pose = "pose5" }) {
  const c = BLOG_CHARACTERS[character];
  if (!c || c.kind !== "human" || !c.poses[pose]) throw Object.assign(new Error("表紙のキャラクター・ポーズを確認してください。"), { status: 400 });
  const clean = String(title || "").replace(/\s+/g, " ").trim();
  if (!clean) throw Object.assign(new Error("表紙のタイトルがありません。"), { status: 400 });
  return {
    ...COVER_SIZE, title: clean.length > 44 ? `${clean.slice(0, 43)}…` : clean,
    eyebrow: `BOATSTRIKERS BLOG · ${String(categoryName || "").slice(0, 30)}`,
    chip: stadiumName ? `${stadiumName}` : null, characterName: c.name, character, pose,
    imagePath: characterImage(character, pose), accent: ACCENTS[character],
    alt: `${c.name}のイラストと記事タイトル「${clean.slice(0, 80)}」`,
    source: "BoatStrikers自動生成（テンプレート・既存キャラクター素材）",
  };
}

export function coverElement(spec, imageDataUrl) {
  const { accent } = spec;
  return h("div", { style: { width: "100%", height: "100%", display: "flex", background: "#f8f7f2", fontFamily: "sans-serif", position: "relative" } },
    h("div", { style: { position: "absolute", left: 0, top: 0, width: "100%", height: 14, background: "#175c49", display: "flex" } }),
    h("div", { style: { position: "absolute", right: 0, bottom: 0, width: 470, height: 616, background: accent.tint, display: "flex" } }),
    h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700, padding: "64px 0 52px 64px" } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { display: "flex", fontSize: 22, letterSpacing: 4, fontWeight: 800, color: "#427260" } }, spec.eyebrow),
        spec.chip ? h("div", { style: { display: "flex", marginTop: 26 } },
          h("div", { style: { display: "flex", padding: "8px 20px", borderRadius: 999, background: accent.main, color: "white", fontSize: 26, fontWeight: 800 } }, spec.chip)) : null,
        h("div", { style: { display: "flex", marginTop: 26, fontSize: 52, lineHeight: 1.32, fontWeight: 900, color: "#182d2c" } }, spec.title)),
      h("div", { style: { display: "flex", alignItems: "center", fontSize: 22, color: "#62716b", fontWeight: 700 } },
        h("div", { style: { display: "flex", width: 46, height: 4, background: accent.main, marginRight: 16 } }),
        `案内：${spec.characterName}　·　最終判断は読者自身で。`)),
    h("img", { src: imageDataUrl, height: 600, style: { position: "absolute", right: 24, bottom: 0 } }));
}

export async function characterDataUrl(spec, root = process.cwd()) {
  const input = await readFile(join(root, "public", spec.imagePath));
  const png = await sharp(input).resize({ height: 600, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// Renders with next/og (same engine as app/blog/og). Japanese glyphs are loaded by next/og at render time.
export async function renderCoverPng(spec, { root = process.cwd() } = {}) {
  const { ImageResponse } = await import("next/og.js");
  const response = new ImageResponse(coverElement(spec, await characterDataUrl(spec, root)), { width: spec.width, height: spec.height });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1000 || bytes[0] !== 0x89 || bytes[1] !== 0x50) throw Object.assign(new Error("表紙画像を生成できませんでした。"), { status: 502 });
  return bytes;
}

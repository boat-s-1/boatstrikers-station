import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const backgrounds = [
  {
    source: "app/races/components/courseCardBackgroundDay.js",
    output: "public/races/card-day.webp",
  },
  {
    source: "app/races/components/courseCardBackgroundMorning.js",
    output: "public/races/card-morning.webp",
  },
  {
    source: "app/races/components/courseCardBackgroundNight.js",
    output: "public/races/card-night.webp",
  },
];

for (const item of backgrounds) {
  const sourcePath = path.join(root, item.source);
  const outputPath = path.join(root, item.output);
  const source = await readFile(sourcePath, "utf8");
  const match = source.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);

  if (!match) {
    throw new Error(`WebP base64 data not found: ${item.source}`);
  }

  const image = Buffer.from(match[1], "base64");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, image);
  console.log(`generated ${item.output} (${image.length} bytes)`);
}

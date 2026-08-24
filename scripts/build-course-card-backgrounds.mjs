import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "scripts", "course-card-assets");
const outputDir = path.join(root, "public", "races");

fs.mkdirSync(outputDir, { recursive: true });

function isWebP(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

for (const type of ["night", "morning", "day"]) {
  const source = path.join(sourceDir, `${type}-v10.b64`);
  const target = path.join(outputDir, `card-${type}-hq.webp`);
  const base64 = fs.readFileSync(source, "utf8").replace(/\s+/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (!isWebP(buffer)) {
    throw new Error(`Course card ${type} asset is not a valid WebP file`);
  }

  fs.writeFileSync(target, buffer);
  console.log(`[course-card] ${type}: ${buffer.length} bytes -> ${path.relative(root, target)}`);
}

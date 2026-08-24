import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "scripts", "course-card-assets");
const outputDir = path.join(root, "public", "races");

fs.mkdirSync(outputDir, { recursive: true });

for (const type of ["night", "morning", "day"]) {
  const source = path.join(sourceDir, `${type}-v10.b64`);
  const target = path.join(outputDir, `card-${type}-hq.webp`);
  const base64 = fs.readFileSync(source, "utf8").replace(/\s+/g, "");
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length < 50000) {
    throw new Error(`Course card ${type} asset is unexpectedly small: ${buffer.length} bytes`);
  }

  fs.writeFileSync(target, buffer);
  console.log(`[course-card] ${type}: ${buffer.length} bytes -> ${path.relative(root, target)}`);
}

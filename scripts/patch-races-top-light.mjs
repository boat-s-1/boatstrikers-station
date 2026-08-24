import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app", "races", "page.js");
let source = fs.readFileSync(file, "utf8");

const importNeedle = 'import CoursePortalCard from "./components/CoursePortalCard";';
const lightImport = 'import { getCoursesByDateLight } from "../lib/racesTopLight";';
if (!source.includes(lightImport)) {
  source = source.replace(importNeedle, `${importNeedle}\n${lightImport}`);
}

source = source.replace(
  'export const dynamic = "force-dynamic";',
  'export const revalidate = 30;'
);

source = source.replace(
  'getCoursesByDate(raceDate),',
  'getCoursesByDateLight(raceDate),'
);

source = source.replace(
  'const fallbackPickups = buildFallbackPickups(courses, raceDate);',
  'const fallbackPickups = [];'
);

fs.writeFileSync(file, source, "utf8");
console.log("[patch-races-top-light] /races now uses lightweight cached data.");

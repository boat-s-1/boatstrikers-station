/**
 * Gamagori official eye-chart parser.
 * Pure function; no network calls or database writes.
 * The chart's x/y axes should be independently verified against official labels.
 */
export type ChartMark = {
  boat_no: number;
  slit_rating: number;
  turn_rating: number;
  arrow_direction: "up" | "down" | "none";
};
export function parseGamagoriChart(html: string): ChartMark[] {
  const chart = html.match(/<div\\b[^>]*\\bid=["']chart["'][^>]*>([\\s\\S]*?)<\\/div>/i)?.[1] ?? html;
  const rows = [...chart.matchAll(/<tr\\b[^>]*>([\\s\\S]*?)<\\/tr>/gi)];
  if (rows.length !== 5) throw new Error("Chart must contain five rows");
  const marks: ChartMark[] = [];
  rows.forEach((row, rowIndex) => {
    const cells = [...row[1].matchAll(/<td\\b[^>]*>([\\s\\S]*?)<\\/td>/gi)];
    if (cells.length !== 5) throw new Error("Chart must contain five columns");
    cells.forEach((cell, columnIndex) => {
      for (const match of cell[1].matchAll(/taka_([1-6])M(_up|_down)?\\.png/gi)) {
        marks.push({
          boat_no: Number(match[1]),
          slit_rating: columnIndex + 1,
          turn_rating: 5 - rowIndex,
          arrow_direction: match[2] ? match[2].slice(1).toLowerCase() as "up" | "down" : "none",
        });
      }
    });
  });
  if (marks.length !== 6 || new Set(marks.map(m => m.boat_no)).size !== 6) {
    throw new Error("Chart must contain each boat exactly once");
  }
  return marks.sort((a, b) => a.boat_no - b.boat_no);
}

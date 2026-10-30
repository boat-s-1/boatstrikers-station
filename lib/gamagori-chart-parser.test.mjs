import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute with a TS-aware runner (tsx/ts-node) or adapt to project test runner.
// Fixture mirrors the official 5x5 chart's table and boat image filenames.
test("parser contract: full chart, up/down arrows, and invalid input", async () => {
  const { parseGamagoriChart } = await import("./gamagori-chart-parser.ts");
  const cells = Array.from({ length: 5 }, () => Array(5).fill(""));
  const entries = [[1,4,3,""],[2,4,4,"_up"],[3,3,3,""],[4,5,4,""],[5,4,4,"_down"],[6,3,4,""]];
  for (const [boat,x,y,suffix] of entries) cells[5-y][x-1] += '<img src="/sp/kyogi/images/taka_'+boat+'M'+suffix+'.png"/>';
  const html = '<div id="chart"><table>'+cells.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join("")+'</tr>').join("")+'</table></div>';
  const result = parseGamagoriChart(html);
  assert.equal(result.length,6);
  assert.deepEqual(result.find(x=>x.boat_no===2),{boat_no:2,slit_rating:4,turn_rating:4,arrow_direction:"up"});
  assert.equal(result.find(x=>x.boat_no===5).arrow_direction,"down");
  assert.throws(()=>parseGamagoriChart(html.replace("taka_6M.png","missing.png")));
});
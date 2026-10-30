import test from "node:test";
import assert from "node:assert/strict";

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
import { readFileSync } from 'node:fs';
import { parseGamagoriChart } from './gamagori-chart-parser.ts';
test('official HTML: 2025-08-09 1R matches six stored ratings', () => {
  const rows = parseGamagoriChart(readFileSync(new URL('../tests/fixtures/gamagori/20250809-01.html', import.meta.url), 'utf8'));
  assert.deepEqual(rows.map(x => [x.boat_no,x.slit_rating,x.turn_rating,x.arrow_direction]),
    [[1,4,3,'none'],[2,4,3,'none'],[3,4,3,'none'],[4,3,4,'none'],[5,4,4,'none'],[6,3,3,'none']]);
});
test('official HTML: arrows 2026-10-29 5R', () => {
  const rows = parseGamagoriChart(readFileSync(new URL('../tests/fixtures/gamagori/20261029-05.html', import.meta.url), 'utf8'));
  assert.deepEqual(rows.filter(x => x.arrow_direction === 'up').map(x => x.boat_no), [1,6]);
});
test('reject missing, duplicate boats, missing chart, extra chart and malformed grid', () => {
  const html = readFileSync(new URL('../tests/fixtures/gamagori/20250809-01.html', import.meta.url), 'utf8');
  for (const bad of [html.replace('taka_6M','taka_1M'),html.replace('taka_6M','unknown'),html.replace('id="chart"','id="other"'),html+html,html.replace('<td >','<th >')]) {
    assert.throws(() => parseGamagoriChart(bad));
  }
});

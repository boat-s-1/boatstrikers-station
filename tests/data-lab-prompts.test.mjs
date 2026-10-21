import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// クライアントコンポーネントから、JSX を含まないプロンプト生成関数だけを読み込む
async function loadPure(file, names) {
  let src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  src = src.replace(/^"use client";?/m, '').replace(/^import .*$/gm, '');
  src = src.slice(0, src.indexOf('export default function'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlp-'));
  const tmp = path.join(dir, `${path.basename(file, '.js')}.mjs`);
  fs.writeFileSync(tmp, `${src}\nexport { ${names.join(', ')} };\n`);
  return import(pathToFileURL(tmp).href);
}
const PB = await loadPure('app/admin/data-lab-social/PromptBuilder.js', ['buildCoverPrompt', 'buildDetailPrompt', 'PRESETS']);
const XB = await loadPure('app/admin/data-lab-social/XPostImagePromptBuilder.js', ['buildPost', 'buildPrompt']);

const base = { date: '10/14', stats: [{ label: '開催', value: '13場 / 156R' }, { label: '1号艇1着', value: '95R' }], max_payout: null, venue_manshu_ranking: [], featured_races: 2 };
const pending = { ...base, incident_races: null, character_details: { ichika: { escape_success_count: null, escape_failure_count: null, escape_rate: null, technique_status: 'incomplete', strong_venues: [], upset_races: [], comment: '決まり手が確定していないレースがあるため、逃げの集計は見送りました。' }, hatsune: { women_race_count: 0, women_escape_count: null, women_escape_rate: null }, kiina: {} } };
const complete = { ...base, incident_races: 0, stats: [...base.stats, { label: '逃げ', value: '91R (58.3%)' }], character_details: { ichika: { escape_success_count: 91, escape_failure_count: 65, escape_rate: 58.3, technique_status: 'complete', strong_venues: [{ venue: '大村', rate: 91.7, count: 11, race_count: 12 }], upset_races: [] }, hatsune: { women_race_count: 0, women_escape_count: 0, women_escape_rate: 0 }, kiina: {} } };
const lines = (text, re) => text.split('\n').filter((l) => re.test(l));

test('決まり手が未確定なら、逃げ関連は「該当なし」ではなく「集計確認中」', () => {
  const texts = [PB.buildCoverPrompt(pending, PB.PRESETS[0]), PB.buildDetailPrompt(pending, 'common'), PB.buildDetailPrompt(pending, 'ichika'), PB.buildDetailPrompt(pending, 'hatsune'), XB.buildPrompt(pending, 'common'), XB.buildPrompt(pending, 'ichika')];
  for (const t of texts) {
    for (const l of lines(t, /^(逃げ|逃げ率|イン逃げ成功数|イン崩れ数|女子戦逃げ数|女子戦逃げ率)：/)) assert.match(l, /：集計確認中$/, l);
    assert.doesNotMatch(t, /^(逃げ|逃げ率|イン逃げ成功数|イン崩れ数)：(該当なし|0)/m);
  }
  assert.match(PB.buildDetailPrompt(pending, 'ichika'), /イン逃げが強かった場 TOP3：\n集計確認中/);
  assert.match(XB.buildPrompt(pending, 'ichika'), /イン逃げが強かった場：\n集計確認中/);
  // 事故も未確定なら「集計確認中」
  assert.match(PB.buildDetailPrompt(pending, 'common'), /事故レース：集計確認中/);
  // X 投稿文は未確定の逃げ行を出さない
  assert.doesNotMatch(XB.buildPost(pending, 'ichika'), /逃げ/);
});

test('「集計確認中」のカードも、従来の「該当なし」と同じく画像から省く指示になっている', () => {
  assert.match(PB.buildCoverPrompt(pending, PB.PRESETS[0]), /値が「該当なし」または「集計確認中」の項目は、見出し・カード・ランキング枠ごと画像から削除する/);
  assert.match(XB.buildPrompt(pending, 'common'), /「該当なし」「集計確認中」の項目は見出し・カード・ランキング枠ごと削除する/);
});

test('確定済みの日は数値を出し、本当に無い項目は従来どおり「該当なし」', () => {
  const t = PB.buildDetailPrompt(complete, 'ichika');
  assert.match(t, /^逃げ：91R \(58\.3%\)$/m);
  assert.match(t, /^逃げ率：58\.3%$/m);
  assert.match(t, /^イン逃げ成功数：91R$/m);
  assert.match(t, /イン崩れ注目レース TOP3：\n該当なし/);
  assert.match(PB.buildDetailPrompt(complete, 'common'), /事故レース：0R/);
  assert.doesNotMatch(t, /：集計確認中$|^集計確認中$/m);
  assert.match(XB.buildPost(complete, 'ichika'), /逃げ 91R/);
});

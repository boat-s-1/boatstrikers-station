import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { todaV13Staging, kiryuV13Staging, todaV13Pack, kiryuV13Pack, todaV13Document, kiryuV13Document } from './_v13Staging.mjs';
import { kiryuV12Pack } from './_v12Staging.mjs';
import { todaPack } from './_todaV10.mjs';
import { v6Pack } from './_tokonameV6.mjs';
import { validateAiDocument } from '../../lib/blog/ai/validate.mjs';
import { claimsIn, evidence } from '../../lib/blog/ai/claims.mjs';
import { comparisonFindings, rateStatements } from '../../lib/blog/ai/dataReadings.mjs';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';

const warnings = issues => [...new Set(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited').map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking').map(i => i.code);
const check = (document, pack) => validateAiDocument({ document, pack });
const V5 = { extended: true };
const keys = (text, facts, options) => rateStatements(text, facts, options).map(st => st.key + (st.certain === false ? '?' : ''));
const verdict = (text, facts, options) => { const f = comparisonFindings(text, facts, options); return [f.certain.length, f.unclear.length]; };
const numbers = text => claimsIn(text).filter(c => c.kind === 'number').map(c => c.label);

// Postgres' jsonb text form (keys by length, then bytes; ", " and ": "), so md5(jsonb::text) can be checked locally.
const jsonbString = s => '"' + s.replace(/[\\"\u0000-\u001f]/g, c => ({ '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' })[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + '"';
const jsonbText = v => v === null ? 'null' : Array.isArray(v) ? `[${v.map(jsonbText).join(', ')}]` : typeof v === 'object'
  ? `{${Object.keys(v).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b))).map(k => `${jsonbString(k)}: ${jsonbText(v[k])}`).join(', ')}}`
  : typeof v === 'string' ? jsonbString(v) : String(v);
const md5 = v => createHash('md5').update(jsonbText(v)).digest('hex');

// A one-block article citing S2 of the pack.
const article = (pack, text) => ({ schema_version: 1, title: '', excerpt: '', category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [], seo: {},
  blocks: [{ type: 'TEXT', data: { text, source_ids: ['S2'], source_url: pack.sources[0].url, source_label: pack.sources[0].label } }] });
// The official page text (documents' excerpt) with and without the digits the course lists use.
const withPage = (pack, excerpt) => ({ ...structuredClone(pack), documents: pack.documents.map(d => ({ ...d, excerpt })) });

test('the v13 fixtures are the staging drafts themselves, unedited (pack, blocks, SEO and notes match staging\'s md5)', () => {
  for (const s of [todaV13Staging, kiryuV13Staging]) {
    assert.equal(md5(s.source_pack), s.md5.source_pack, `${s.slug}: source pack`);
    assert.equal(md5(s.validation), s.md5.validation, `${s.slug}: validation`);
    assert.equal(md5(s.seo), s.md5.seo, `${s.slug}: seo`);
    assert.deepEqual(s.blocks.map(b => md5(b.data)), s.md5.blocks, `${s.slug}: blocks`);
    assert.equal(s.edit_version, 1, 'never edited after generation');
    assert.equal(s.prompt_version, 'blog-ai-v13');
    assert.equal(s.preview_commit, 'a98c75553f782b534753d6a9f03c04985395e7b8');
    assert.equal(s.source_pack.version, 5);
    assert.equal(s.source_pack.comparison.prompt_version, 'blog-ai-v13');
    assert.match(s.source_pack.sources[0].url, /^https:\/\/www\.boatrace\.jp\/owpc\/pc\/data\/stadium\?jcd=0[12]$/);
  }
  assert.equal(todaV13Staging.post_id, '44935152-9fdd-4be2-85f8-6bcf4a00def3');
  assert.equal(kiryuV13Staging.post_id, '33360f9f-bd2e-4985-aed8-26a3f9fd08bb');
  assert.equal(todaV13Pack.sources[0].fetched_at, '2026-10-12T06:36:02.919+00:00');
  // Kiryu's page was fetched again at generation; its figures and readings are those of the v12 pack.
  assert.equal(kiryuV13Pack.sources[0].fetched_at, '2026-10-18T13:20:34.042+00:00');
  assert.deepEqual(kiryuV13Pack.facts, kiryuV12Pack.facts);
  assert.deepEqual(kiryuV13Pack.readings, kiryuV12Pack.readings);
});

test('v13 drafts (2026-10-18): the course list is no number, the summaries are told apart, the comparison mark still blocks', () => {
  const recorded = s => s.validation.filter(i => i.code !== 'auto_cited').map(i => i.code).sort();
  assert.deepEqual(recorded(kiryuV13Staging), ['comparison_draft', 'summary_without_finding', 'unsupported_number']);
  assert.deepEqual(recorded(todaV13Staging), ['comparison_draft', 'summary_without_finding']);
  // The severities recorded at generation: the course list blocked approval (a false finding), the summary was a warning.
  const level = (s, code) => s.validation.filter(i => i.code === code).map(i => i.level);
  assert.deepEqual(level(kiryuV13Staging, 'unsupported_number'), ['blocking']);
  assert.match(kiryuV13Staging.validation.find(i => i.code === 'unsupported_number').message, /ブロック8（TEXT）：出典にない数値「4」「5」/);
  assert.deepEqual(level(kiryuV13Staging, 'summary_without_finding'), ['warning']);
  assert.deepEqual(level(todaV13Staging, 'summary_without_finding'), ['warning']);
  // Kiryu: "2・4・5・6コース" (block 8) is a list of courses, not the numbers 4 and 5; the summary's "半数を上回りました" is
  // read (54.7%: right). What remains is real: the summary states the finding with no source set.
  const kiryu = check(kiryuV13Document, kiryuV13Pack);
  assert.deepEqual(blocking(kiryu), ['comparison_draft']);
  assert.deepEqual(warnings(kiryu), ['statement_without_source']);
  assert.ok(!kiryu.some(i => /ブロック8/.test(i.message)));
  // Toda: the summary speaks of the findings ("全体の半分以上を占める数字ではありません", "順番どおりに並んでいました") in words
  // whose subject or direction is not said; it is not read as a finding, nor said to have none: a note for the reviewer.
  const toda = check(todaV13Document, todaV13Pack);
  assert.deepEqual(blocking(toda), ['comparison_draft']);
  assert.deepEqual(warnings(toda), ['summary_finding_unverified']);
  const framing = scorecard({ document: todaV13Document, pack: todaV13Pack, issues: toda }).axes.find(a => a.key === 'framing');
  assert.equal(framing.score, 5);
  assert.deepEqual(framing.notes, ['導入の問い・用語の説明・確認の理由がそろっている（まとめの発見は未確認）', 'まとめの発見を自動確認できない（要確認。減点はしないが、発見は確認済みではない）']);
  // Never told as a finding confirmed (the note of a summary whose finding is read says so).
  assert.ok(!framing.notes.some(n => /まとめの発見がそろっている/.test(n)));
});

test('a list of courses sharing one "コース" is course numbers 1〜6, whether the official page holds those digits or not', () => {
  assert.deepEqual(numbers('3コースの1着率は、2・4・5・6コースの数字より高かった'), []);
  assert.deepEqual(numbers('2、3コースは13.2%と13.4%です'), ['13.2', '13.4']);
  assert.deepEqual(numbers('1・2・3コース'), []);
  const page = kiryuV13Pack.documents[0].excerpt;
  const packs = { 'page with the digits': withPage(kiryuV13Pack, `${page}\n掲載 2回 4回 5回 6回 7回`), 'page without digits': withPage(kiryuV13Pack, page.replace(/\d/g, '')) };
  assert.ok(['4', '5', '7'].every(n => evidence(packs['page with the digits']).by.get('S2').numbers.has(n)));
  assert.ok(!['2', '4', '5', '7'].some(n => evidence(packs['page without digits']).by.get('S2').numbers.has(n)));
  for (const [name, pack] of Object.entries(packs)) {
    for (const text of ['3コースの1着率は13.4%で、2・4・5・6コースの数字より高かった。', '2、3コースは13.2%と13.4%です。', '2 ・ 4 コースはどちらも1コースより低い数字です。'])
      assert.deepEqual(check(article(pack, text), pack).filter(i => /unsupported|mismatch/.test(i.code)), [], `${name}: ${text}`);
    // A number out of 1〜6 is no course, alone or in a list, even where the page holds the digit.
    for (const [text, value] of [['7コースの1着率は13.4%です。', '7'], ['3コースの1着率は、2・7コースより高い。', '7'], ['0コースの1着率は13.4%です。', '0'], ['2・4・12コース', '12']]) {
      const found = check(article(pack, text), pack).filter(i => i.code === 'unsupported_number');
      assert.equal(found.length, 1, `${name}: ${text}`);
      assert.match(found[0].message, new RegExp(`「${value}」`), `${name}: ${text}`);
    }
  }
});

test('the number check stays as strict: wrong rates, decimals, percentages, money and gaps beside a course list are still found', () => {
  const pack = kiryuV13Pack;
  for (const [text, value] of [['3コースは13.5%で、2・4・5・6コースより高い。', '13.5'], ['2・3コースの差は0.3ポイントです。', '0.3'], ['2・3コースの1着率は合わせて26.6%です。', '26.6'],
    ['2・3コースで払戻1,200円でした。', '1,200'], ['1コースは54.7%、2、3コースは13.2%と14.0%です。', '14.0']]) {
    const found = check(article(pack, text), pack).filter(i => i.code === 'unsupported_number');
    assert.equal(found.length, 1, text);
    assert.match(found[0].message, new RegExp(`「${value.replace('.', '\\.')}」`), text);
  }
  // A digit inside a decimal or a percentage never starts or joins a course list.
  assert.deepEqual(numbers('1コースは54.7%、2・3コースは13.2%と13.4%'), ['54.7', '13.2', '13.4']);
  assert.deepEqual(numbers('差は13.2、3コースは13.4'), ['13.2', '13.4']);
  assert.deepEqual(numbers('2.5・3コース'), ['2.5']);
});

test('only "コース" makes a course number: other units read as before (all pack versions)', () => {
  // Small numbers before another unit pass as before; "7月" is a date; none of them is a course out of range.
  for (const text of ['7レース', '12R', '7R', '7号艇', '12レース目', '3着'])
    assert.deepEqual(claimsIn(text), [], text);
  assert.deepEqual(claimsIn('7月').map(c => c.kind), ['date']);
  // A list before another unit is no course list: read as before (the leading numbers are numbers to check).
  assert.deepEqual(numbers('2・7レース'), ['2']);
  assert.deepEqual(numbers('1・2・3着'), ['1', '2']);
  assert.ok(claimsIn('2・7レース').every(c => !c.course));
  // In an article, "7レース目" and "12R" need no source; "7コース" does not pass on a source holding "7".
  const pack = withPage(kiryuV13Pack, `${kiryuV13Pack.documents[0].excerpt}\n掲載 7回`);
  assert.deepEqual(check(article(pack, '3コースは13.4%で、7レース目と12Rの結果とは別の集計です。'), pack).filter(i => /unsupported|mismatch/.test(i.code)), []);
  assert.deepEqual(check(article(pack, '7コースは13.4%です。'), pack).filter(i => i.code === 'unsupported_number').length, 1);
  // Older packs (version 4) get the same number check.
  const old = { ...structuredClone(kiryuV13Pack), version: 4 };
  assert.deepEqual(check(article(old, '3コースの1着率は13.4%で、2・4・5・6コースの数字より高かった。'), old).filter(i => /unsupported|mismatch/.test(i.code)), []);
  assert.equal(check(article(old, '7コースは13.4%です。'), old).filter(i => i.code === 'unsupported_number').length, 1);
});

test('half and below half, read only when the subject and the comparison are clear (version 5)', () => {
  const toda = todaV13Pack.facts, kiryu = kiryuV13Pack.facts;
  // "半数を上回る" is above half; checked against the data.
  assert.deepEqual(keys('1コースから進入した艇の1着率は半数を上回りました。', kiryu, V5), ['half:1']);
  assert.deepEqual(verdict('1コースから進入した艇の1着率は半数を上回りました。', kiryu, V5), [0, 0]);
  assert.deepEqual(verdict('1コースから進入した艇の1着率は半数を上回りました。', toda, V5), [1, 0]);
  // Its denials are below half, and checked too (before, "半分を超えていません" was read as above half).
  for (const text of ['1コースから進入した艇の1着率は半数を上回っていません。', '1コースの1着率は半分を超えていません。', '1コースの1着率は半分を超えませんでした。']) {
    assert.deepEqual(keys(text, toda, V5), ['under_half:1'], text);
    assert.deepEqual(verdict(text, toda, V5), [0, 0], text);
    assert.deepEqual(verdict(text, kiryu, V5), [1, 0], text);
  }
  // The share named as the prompt asks ("1コースから進入した艇が1着になったレースの割合").
  assert.deepEqual(verdict('1コースから進入した艇が1着になったレースの割合は、この集計期間では半分を超えていました。', toda, V5), [1, 0]);
  assert.deepEqual(verdict('1コースから進入した艇が1着になったレースの割合は、半分に届きませんでした。', kiryu, V5), [1, 0]);
  // "半分以上のレースで1着になったわけではない" says below half (Toda v13's dialogue); with "最も高い" it tells the contrast.
  const answer = 'この集計期間では、1コースは6つのコースの中で最も高い一方、半分以上のレースで1着になったわけではないんだよ。';
  assert.deepEqual(keys(answer, toda, { ...V5, context: true }), ['under_half:1', 'top:1:高', 'contrast:1']);
  assert.deepEqual(verdict(answer, kiryu, { ...V5, context: true }), [1, 0]);
  // What names no subject or target is not completed into a finding: "全体の半分以上を占める" (of what?), "半分くらい".
  for (const text of ['1コースは全体の半分以上を占める数字ではありませんでした。', '1コースの1着率は半分くらいです。', '1着率は全体の半分を超えていません。'])
    assert.deepEqual(keys(text, toda, V5), [], text);
  // Older packs read as before.
  assert.deepEqual(keys('1コースから進入した艇の1着率は半数を上回りました。', kiryu), []);
  assert.deepEqual(keys('1コースから進入した艇の1着率は半数を上回っていません。', toda), []);
});

test('"近い位置" says no gap, "順番どおり" says no direction: neither confirms a finding; a wrong direction is found', () => {
  const toda = todaV13Pack.facts, kiryu = kiryuV13Pack.facts;
  // A position is not a gap: "近い位置" is not read as a near tie or a small gap.
  assert.deepEqual(keys('2コースと3コースは近い位置にあります。', kiryu, V5), []);
  assert.deepEqual(keys('3コースと4コースの1着率は近い位置にあります。', toda, V5), []);
  // The order with its direction ("外側のコースほど…低い", "内側のコースほど…高い", "内側から外側へ…低く").
  const seq = text => rateStatements(text, toda, V5).filter(st => st.kind === 'sequence').map(st => ({ key: st.key, directionless: Boolean(st.directionless), inverted: Boolean(st.inverted) }));
  for (const text of ['外側のコースほど、1着率が順に低く並んでいます。', '内側のコースほど1着率が順に高く並んでいます。', '1着率は内側から外側へ順に低くなっています。']) {
    assert.deepEqual(seq(text), [{ key: 'sequence:in', directionless: false, inverted: false }], text);
    assert.deepEqual(verdict(text, toda, V5), [0, 0], text);
  }
  // "順番どおり" alone: still an in-order claim (checked against the data as before), but its direction is not known.
  assert.deepEqual(seq('1着率は内側から順番どおりに並んでいます。'), [{ key: 'sequence:in', directionless: true, inverted: false }]);
  assert.deepEqual(verdict('1着率は内側から順番どおりに並んでいます。', toda, V5), [0, 0]);
  // The wrong direction is wrong even where the table is in order.
  assert.deepEqual(seq('外側のコースほど、1着率が順に高く並んでいます。'), [{ key: 'sequence:in', directionless: false, inverted: true }]);
  assert.deepEqual(verdict('外側のコースほど、1着率が順に高く並んでいます。', toda, V5), [1, 0]);
  // Older packs: no direction is read (as before).
  assert.ok(rateStatements('外側のコースほど、1着率が順に高く並んでいます。', todaPack.facts).every(st => !st.inverted && !st.directionless));
});

test('the summary: a finding read, a summary that cannot be read (for review, no deduction), and one without findings', () => {
  const summaryOf = (doc, text) => { const d = structuredClone(doc); d.blocks[13].data.text = text; return d; };
  const codes = (doc, pack) => warnings(check(doc, pack)).filter(c => /^summary_(without_finding|finding_unverified)$/.test(c));
  const framing = (doc, pack) => scorecard({ document: doc, pack, issues: check(doc, pack) }).axes.find(a => a.key === 'framing').score;
  for (const [text, expected] of [
    // Read: below half with its subject, or the order with its direction.
    ['戸田のこの集計期間では、1コースから進入した艇が1着になったレースの割合は、表の中で最も高いのに半分に届きませんでした。', []],
    ['戸田のこの集計期間では、外側のコースほど、1着率が順に低く並んでいました。', []],
    // Not read: no direction, or "最も高い" alone (not the finding, which is "highest yet below half").
    ['戸田のこの集計期間では、1着率は内側から順番どおりに並んでいました。', ['summary_finding_unverified']],
    ['戸田のこの集計期間では、1コースの1着率は表の中で最も高い数字でした。', ['summary_finding_unverified']],
    ['戸田の1着率は全体の半分以上を占めるほどではなく、2コースと3コースは近い位置でした。', ['summary_finding_unverified']],
    // No finding spoken of at all: as before.
    ['当日は出走表と展示を確かめてから、自分で判断しましょう。', ['summary_without_finding']],
  ]) {
    const doc = summaryOf(todaV13Document, text);
    assert.deepEqual(codes(doc, todaV13Pack), expected, text);
  }
  // The note costs nothing; no finding costs a point (the framing axis, otherwise 5 for this draft).
  assert.equal(framing(summaryOf(todaV13Document, '戸田のこの集計期間では、1着率は内側から順番どおりに並んでいました。'), todaV13Pack), 5);
  assert.equal(framing(summaryOf(todaV13Document, '当日は出走表と展示を確かめてから、自分で判断しましょう。'), todaV13Pack), 4);
  // A wrong finding in the summary is still found, not passed as unverified.
  const wrong = summaryOf(todaV13Document, '戸田のこの集計期間では、1コースから進入した艇の1着率が半数を上回りました。');
  assert.ok(check(wrong, todaV13Pack).some(i => i.level === 'blocking' && i.code !== 'comparison_draft'));
  // Older packs never get the new note: a summary not read is "without finding", as before.
  const old = structuredClone(todaV13Document); old.blocks[13].data.text = '戸田のこの集計期間では、1着率は内側から順番どおりに並んでいました。';
  assert.ok(!warnings(check(old, { ...structuredClone(todaV13Pack), version: 4 })).includes('summary_finding_unverified'));
});

test('prompt blog-ai-v14: lessons applied to this stadium\'s courses and figures, half with its subject, the order with its direction', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v14');
  const kiryu = buildInstructions(kiryuV13Pack), toda = buildInstructions(todaV13Pack);
  for (const p of [kiryu, toda]) {
    assert.match(p, /reading_lessons の文は考え方の手本です。そのまま写さず、この場のコース名と facts の数字に当てはめて書きます/);
    assert.match(p, /半分と比べるときは、何の割合かをはっきり書きます（例：「1コースから進入した艇が1着になったレースの割合は/);
    assert.match(p, /「全体の半分」「半分以上を占める」のように対象があいまいな言い方はしません/);
    assert.match(p, /並び方を書くときは、向きを明示します（例：「外側のコースほど、1着率が順に低く並んでいます」）。「順番どおり」「内側から順に並ぶ」だけで済ませず/);
    assert.match(p, /前の文と同じ内容を言い換えるだけの文/);
    assert.match(p, /text で、この場のコースと数字を使って、その数字が何を示すか/);
  }
  // No stadium's figures in another's prompt: the examples are placeholders, the title example is this stadium's own.
  assert.match(kiryu, /「54\.7%！」など/);
  assert.match(toda, /「42\.8%！」など/);
  for (const v of ['42.8', '14.9', '14.2', '17.0']) assert.ok(!kiryu.includes(v), `Kiryu prompt holds Toda's ${v}`);
  for (const v of ['54.7', '13.2', '13.4']) assert.ok(!toda.includes(v), `Toda prompt holds Kiryu's ${v}`);
  // Older packs (no discoveries) keep their prompt.
  assert.match(buildInstructions(todaPack), /facts の基本情報（水質・干満差など）は1文にまとめて導入に入れ/);
  assert.ok(buildInstructions(v6Pack).length > 0);
});

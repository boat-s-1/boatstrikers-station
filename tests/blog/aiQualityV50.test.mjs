import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { catalogue } from './_aiFixtures.mjs';
import { storedPack, storedDocument } from './_kiryuRegression.mjs';
import { v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { v6Pack, v6Document } from './_tokonameV6.mjs';
import { v7Pack, v7Document } from './_tokonameV7.mjs';
import { v8Pack, v8Document } from './_tokonameV8.mjs';
import { v9Pack, v9Document } from './_tokonameV9.mjs';
import { todaPack, todaDocument } from './_todaV10.mjs';
import { todaV11Pack, todaV11Document, todaV11Staging, todaV11GenerationValidation } from './_todaV11.mjs';
import { asV5, todaV5Pack, tokonameV5Pack, hamanakoV5Pack, kiryuV5Pack, tamagawaV5Pack, tokonameWaterV5Pack, tokonameOuterV5Pack, todaTopic, tokonameTopic, hamanakoTopic, kiryuCourseTopic,
  todaV5Model, tokonameV5Model, hamanakoV5Model, kiryuV5Model, hatsuneWaterV5Model, kiinaOuterV5Model, stadiumFacts, DATA_ORIGIN } from './_models50.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { comparisonFindings, courseReadings, rateStatements, CLOSE } from '../../lib/blog/ai/dataReadings.mjs';
import { buildInstructions, buildInput } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { candidateTopics } from '../../lib/blog/ai/topics.mjs';
import { READING_LESSONS } from '../../lib/blog/ai/glossary.mjs';

const warnings = issues => [...new Set(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited').map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking').map(i => i.code);
const check = (document, pack) => validateAiDocument({ document, pack });
const scores = (document, pack) => scorecard({ document, pack, issues: check(document, pack) }).axes.map(a => a.score);
const compose = (ai, pack, topic) => composeDocument({ ai, pack, topic, catalogue }).document;
const keys = (text, facts, options) => rateStatements(text, facts, options).map(st => st.key + (st.certain === false ? '?' : ''));
const verdict = (text, facts, options) => { const f = comparisonFindings(text, facts, options); return [f.certain.length, f.unclear.length]; };
// The PHASE 5.0 warnings (source packs from version 5 only).
const V5_CODES = ['dialogue_restates_partner', 'dialogue_answer_mismatch', 'dialogue_offtopic_close', 'empty_closing', 'weak_connective', 'ambiguous_direction', 'title_question_unanswered', 'internal_heading_label'];
const todaFacts = todaPack.facts, tokonameFacts = v6Pack.facts;
// [name, model, pack, topic, origin of the figures]. A synthetic pack checks the code only, never the data.
const MODELS = [['toda', todaV5Model, todaV5Pack, todaTopic, 'official'], ['tokoname', tokonameV5Model, tokonameV5Pack, tokonameTopic, 'official'],
  ['kiryu', kiryuV5Model, kiryuV5Pack, kiryuCourseTopic, 'official'],
  ['water-hatsune', hatsuneWaterV5Model, tokonameWaterV5Pack, { ...tokonameTopic, ...tokonameWaterV5Pack.topic }, 'official'],
  ['outer-kiina', kiinaOuterV5Model, tokonameOuterV5Pack, { ...tokonameTopic, ...tokonameOuterV5Pack.topic }, 'official'],
  ['hamanako (synthetic)', hamanakoV5Model, hamanakoV5Pack, hamanakoTopic, 'synthetic']];

// Postgres' jsonb text form (keys by length, then bytes; ", " and ": "), so md5(jsonb::text) can be checked locally.
const jsonbString = s => '"' + s.replace(/[\\"\u0000-\u001f]/g, c => ({ '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' })[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + '"';
const jsonbText = v => v === null ? 'null' : Array.isArray(v) ? `[${v.map(jsonbText).join(', ')}]` : typeof v === 'object'
  ? `{${Object.keys(v).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b))).map(k => `${jsonbString(k)}: ${jsonbText(v[k])}`).join(', ')}}`
  : typeof v === 'string' ? jsonbString(v) : String(v);
const md5 = v => createHash('md5').update(jsonbText(v)).digest('hex');

test('the Toda v11 fixture is the staging draft itself (pack, blocks, SEO and notes match staging\'s md5), not a rebuild from v10', () => {
  const s = todaV11Staging;
  assert.equal(md5(s.source_pack), s.md5.source_pack, 'source pack');
  assert.equal(md5(s.validation), s.md5.validation, 'validation');
  assert.equal(md5(s.seo), s.md5.seo, 'seo');
  assert.deepEqual(s.blocks.map(b => md5(b.data)), s.md5.blocks, 'blocks');
  assert.deepEqual(todaV11Pack, s.source_pack);
  assert.deepEqual(todaV11Document.blocks, s.blocks);
  assert.deepEqual(todaV11GenerationValidation, s.validation);
  // What differs from the v10 pack: built later, with the official placement table and the full page text.
  assert.equal(todaV11Pack.built_at, '2026-10-12T07:50:31.598Z');
  assert.notEqual(todaV11Pack.built_at, todaPack.built_at);
  assert.equal(todaV11Pack.official.placements.length, 6);
  assert.deepEqual(todaV11Pack.facts, todaPack.facts, 'the same fetch: the same facts');
  assert.equal(todaV11Pack.sources[0].content_sha256, todaPack.sources[0].content_sha256);
});

test('data origin: official packs carry the fetched page; synthetic packs say so and never borrow an official source', () => {
  assert.deepEqual(DATA_ORIGIN, { toda: 'official', tokoname: 'official', kiryu: 'official', hamanako: 'synthetic', tamagawa: 'synthetic' });
  for (const pack of [todaV5Pack, tokonameV5Pack, kiryuV5Pack]) {
    assert.ok(!pack.synthetic);
    const s2 = pack.sources.find(x => x.id === 'S2');
    assert.match(s2.url, /^https:\/\/www\.boatrace\.jp\/owpc\/pc\/data\/stadium\?jcd=\d\d$/);
    assert.ok(s2.fetched_at && s2.content_sha256, pack.stadium.name);
  }
  // Kiryu's figures are parsed from the stored official page, not typed in.
  assert.deepEqual(kiryuV5Pack.facts.filter(f => /コース1着率$/.test(f.label)).map(f => f.value), ['54.7', '13.2', '13.4', '9.4', '6.8', '3.0']);
  for (const pack of [hamanakoV5Pack, tamagawaV5Pack]) {
    assert.equal(pack.synthetic, true);
    assert.match(pack.sources[0].url, /^https:\/\/example\.invalid\/synthetic\//);
    assert.match(pack.sources[0].label, /合成データ/);
    assert.doesNotMatch(JSON.stringify(pack), /boatrace\.jp|戸田|戸 田/);
  }
});

test('regression: every stored draft keeps its findings and scores (the PHASE 5.0 checks apply to source packs version 5 only)', () => {
  const table = [[storedDocument, storedPack, [5, 2, 1, 1, 3, 1, null]], [v4Document, v4Pack, [5, 4, 1, 3, 4, 2, null]], [v5Document, v5Pack, [5, 5, 3, 5, 4, 4, null]],
    [v6Document, v6Pack, [5, 5, 5, 5, 4, 5, null]], [v7Document, v7Pack, [5, 5, 2, 5, 4, 5, 5]], [v8Document, v8Pack, [5, 5, 2, 5, 5, 5, 5]], [v9Document, v9Pack, [5, 5, 5, 5, 5, 5, 5]],
    [todaDocument, todaPack, [1, 5, 5, 4, 4, 4, 4]], [todaV11Document, todaV11Pack, [5, 5, 5, 5, 5, 5, 5]]];
  for (const [document, pack, expected] of table) {
    assert.ok((pack.version ?? 0) < 5);
    const issues = check(document, pack);
    assert.deepEqual(scores(document, pack), expected, document.title);
    assert.deepEqual(warnings(issues).filter(c => V5_CODES.includes(c)), [], document.title);
  }
  assert.deepEqual(blocking(check(todaV11Document, todaV11Pack)), ['comparison_draft']);
  assert.deepEqual(warnings(check(todaV11Document, todaV11Pack)), []);
});

test('Toda v11 draft (2026-10-12), read as a version 5 pack: the faults found on reading it are named, none blocks approval', () => {
  const pack = { ...asV5(todaV11Pack), comparison: todaV11Pack.comparison };
  const issues = check(todaV11Document, pack);
  assert.deepEqual(blocking(issues), ['comparison_draft'], 'only the comparison mark blocks, as before');
  assert.deepEqual(warnings(issues), ['ambiguous_direction', 'definition_repeated', 'dialogue_offtopic_close', 'dialogue_restates_partner', 'empty_closing', 'weak_connective']);
  const text = code => issues.find(i => i.code === code).message;
  assert.match(text('dialogue_restates_partner'), /一果の答えが、初音の気づき（内側から順に並ぶ）を言い直しているだけです/);
  assert.match(text('definition_repeated'), /ブロック4（TEXT）、ブロック6（TEXT）/, '"各コースから進入した艇の1着率として" says the definition again');
  assert.match(text('empty_closing'), /捉えると、数字の位置づけを読み違えにくくなります/);
  assert.match(text('weak_connective'), /半分に届かない一方/);
  assert.match(text('ambiguous_direction'), /ブロック7（DIALOGUE_SCENE）/);
  const sc = scorecard({ document: todaV11Document, pack, issues });
  // Explanation 4: no lesson told. Characters 3, readability 2: the dialogue and the closing.
  assert.deepEqual(sc.axes.map(a => a.score), [5, 5, 4, 4, 3, 2, 5]);
  assert.equal(sc.average, 3.8); assert.equal(sc.average_all, 4);
  assert.ok(sc.axes.find(a => a.key === 'explanation').notes.includes('数字の読み方（何を示し、何を示さないか）の説明なし'));
});

test('the PHASE 5.0 model articles: approvable, no quality note, every axis at 5', () => {
  for (const [name, model, pack, topic] of MODELS) {
    assert.equal(Boolean(pack.synthetic), name.includes('synthetic'), name);
    const document = compose(model(), pack, topic), issues = check(document, pack);
    assert.equal(blockingCount(issues), 0, `${name}: ${JSON.stringify(issues.filter(i => i.level === 'blocking'))}`);
    assert.deepEqual(warnings(issues), [], name);
    assert.deepEqual(scores(document, pack), [5, 5, 5, 5, 5, 5, 5], name);
    assert.deepEqual(document.author_ids, [catalogue.authorIds[topic.character_key]], name);
    // No computed gap, no "42.8%！".
    const all = JSON.stringify(document);
    assert.doesNotMatch(all, /ポイント差|\d+(\.\d+)?ポイント|%！/, name);
  }
});

test('each PHASE 5.0 note on the Toda model: a warning only, and only for version 5 packs', () => {
  const v4 = { ...todaV5Pack, version: 4, readings: courseReadings(todaFacts) };
  const cases = [
    ['dialogue_restates_partner', ai => { ai.sections[1].blocks[0].turns[1].text = 'そうだね、1コースは6つのコースの中で最も高いけど、半分には届いていないね。'; }],
    ['dialogue_answer_mismatch', ai => { ai.sections[1].blocks[0].turns[1].text = 'いいところに気づいたね。2コースの1着率（17.0%）は、1コース以外で最も高いよ。'; }],
    ['dialogue_offtopic_close', ai => { ai.sections[1].blocks[0].turns[1].text += '誰がどのコースに入りそうかは、下の確認項目のスタート展示で見てみよう。'; }],
    ['empty_closing', ai => { ai.summary += '表を見るときは、この並び方を特徴として捉えると、数字の位置づけを読み違えにくくなります。'; }],
    ['weak_connective', ai => { ai.summary = 'この期間の戸田は、1コースが半分に届かない一方、外側のコースほど1着率が順に低い期間でした。'; }],
    ['ambiguous_direction', ai => { ai.sections[2].blocks[0].text = ai.sections[2].blocks[0].text.replace('1着率は外側のコースほど順に低く', '1着率は1コースから6コースまで内側から順に高く'); }],
    ['internal_heading_label', ai => { ai.sections[2].heading = '発見②：外側のコースほど1着率が低い期間'; }],
    ['title_question_unanswered', ai => { ai.title = '戸田のコース別1着率はどう読む？'; ai.sections[1].blocks[0].turns[1].text = 'この期間の1コースの1着率は42.8%だよ。'; ai.sections[2].blocks[0].text = ai.sections[2].blocks[0].text.replace(/。3コース.*$/, '。'); ai.summary = 'この期間の戸田は、1コースが最も高くても半分には届かない期間でした。'; }],
  ];
  for (const [code, edit] of cases) {
    const ai = todaV5Model(); edit(ai);
    const document = compose(ai, todaV5Pack, todaTopic), issues = check(document, todaV5Pack);
    assert.ok(warnings(issues).includes(code), `${code}: ${warnings(issues)}`);
    // A numbered label ("発見②") is also a heading figure no text supports: the existing check (heading_unsupported) blocks that.
    assert.deepEqual(blocking(issues).filter(c => c !== (code === 'internal_heading_label' ? 'heading_unsupported' : null)), [], `${code} never blocks`);
    assert.ok(scores(document, todaV5Pack).some(s => s < 5), `${code} costs a point`);
    // The same article on a version 4 pack: no PHASE 5.0 note.
    assert.deepEqual(warnings(check(compose(ai, v4, todaTopic), v4)).filter(c => V5_CODES.includes(c)), [], code);
  }
  // Without any lesson, the explanation axis stops at 4 (version 5 only).
  const bare = todaV5Model();
  bare.sections[1].blocks[0].turns[1].text = 'この期間の1着率では、1コースの数字が表の中で最も高いね。';
  bare.sections[2].blocks[0].text = bare.sections[2].blocks[0].text.replace(/。3コース.*$/, '。');
  bare.summary = 'この期間の戸田は、1コースが最も高くても半分には届かない期間でした。';
  const explanation = pack => { const document = compose(bare, pack, todaTopic); return scorecard({ document, pack, issues: check(document, pack) }).axes.find(a => a.key === 'explanation'); };
  assert.ok(explanation(todaV5Pack).score <= 4);
  assert.ok(explanation(todaV5Pack).notes.includes('数字の読み方（何を示し、何を示さないか）の説明なし'));
  assert.ok(!explanation(v4).notes.includes('数字の読み方（何を示し、何を示さないか）の説明なし'));
});

test('statements, version 5 packs: the contrast, close / equal / near, the outward order, 50%', () => {
  const V5 = { extended: true };
  // 1コース the highest yet below half, in one sentence: both readings and their contrast.
  assert.deepEqual(keys('1コースの1着率は42.8%で、6つのコースの中で最も高いのに、半分には届きません。', todaFacts, V5).sort(), ['contrast:1', 'top:1:高', 'under_half:1']);
  // Close: within 1.0 point (editorial convention), never blocking; outside it, shown for review.
  assert.equal(CLOSE, 1.0);
  assert.deepEqual(keys('3コース（14.9%）と4コース（14.2%）は、順位は違いますが差は小さいです。', todaFacts, V5), ['close:3:4']);
  assert.deepEqual(verdict('3コース（14.9%）と4コース（14.2%）は、順位は違いますが差は小さいです。', todaFacts, V5), [0, 0]);
  assert.deepEqual(verdict('2コース（17.0%）と3コース（14.9%）は、差は小さいです。', todaFacts, V5), [0, 1]);
  // "差がない" / "同じ数字" for different values contradicts the data.
  assert.deepEqual(verdict('3コースと4コースの1着率は差がありません。', todaFacts, V5), [1, 0]);
  assert.deepEqual(verdict('3コースと4コースの1着率は同じ数字です。', todaFacts, V5), [1, 0]);
  // Denying it is no claim (Kiryu model, 2026-10-15: "同じ数字ではないけれど" was read as "同じ数字で").
  for (const text of ['2コースと3コースは同じ数字ではないけれど、順位だけで判断しません。', '2コースと3コースの1着率は同じ数字ではありません。', '2コースと3コースの1着率は同じ数字でもない。'])
    assert.deepEqual(verdict(text, kiryuV5Pack.facts, V5), [0, 0], text);
  assert.deepEqual(verdict('2コースと3コースの1着率は同じ数字で、差がない。', kiryuV5Pack.facts, V5), [1, 0]);
  // "ほぼ同じ" is never wrong; beyond 0.5 points it is shown for review.
  assert.deepEqual(verdict('3コースと4コースの1着率はほぼ同じです。', todaFacts, V5), [0, 1]);
  assert.match(comparisonFindings('3コースと4コースの1着率はほぼ同じです。', todaFacts, V5).unclear[0], /「ほぼ同じ」は差が0\.5ポイント以内のときに使います/);
  // The outward order, as the in-order lesson words it (past form included).
  assert.deepEqual(keys('1着率は外側のコースほど順に低くなりました。', todaFacts, V5), ['sequence:in']);
  assert.deepEqual(verdict('1着率は外側のコースほど順に低くなりました。', todaFacts, V5), [0, 0]);
  assert.deepEqual(verdict('1着率は外側のコースほど順に低くなりました。', tokonameFacts, V5), [1, 0], 'Tokoname has 4 > 3');
  // The half lesson's wording is read as "above half".
  const half = rate => `この集計期間では、1コースの1着率は${rate}%で、1コースから進入した艇が、半分を超えるレースで1着になりました。`;
  assert.deepEqual(keys(half('61.2'), tokonameFacts, V5), ['half:1']);
  assert.deepEqual(verdict(half('61.2'), tokonameFacts, V5), [0, 0]);
  assert.deepEqual(verdict(half('42.8'), todaFacts, V5), [1, 0]);
  // Exactly 50%: neither above nor below half.
  const fifty = stadiumFacts('テスト', ['50.0', '15.0', '12.0', '10.0', '8.0', '5.0']);
  assert.deepEqual(verdict('1コースの1着率は50.0%で、半分を超えています。', fifty, V5), [1, 0]);
  assert.deepEqual(verdict('1コースの1着率は50.0%で、半分に届いていません。', fifty, V5), [1, 0]);
  assert.ok(!courseReadings(fifty, { extended: true }).some(r => ['half', 'top_not_majority'].includes(r.kind)));
});

test('near and same: "ほぼ並んでいます" only for a gap above 0 and up to 0.5 points; the same value is "同じ値" (version 5)', () => {
  const tie = stadiumFacts('テスト', ['55.0', '13.4', '13.4', '9.0', '6.0', '3.0']); // 2コース = 3コース
  const close = stadiumFacts('テスト', ['55.0', '13.2', '13.4', '9.0', '6.0', '3.0']); // 0.2 apart
  const v5 = courseReadings(tie, { extended: true }), v4 = courseReadings(tie);
  // Version 5: the tie is its own reading, keyed as an article states it, with its own lesson; no "near" for it.
  assert.deepEqual(v5.filter(r => ['near', 'same'].includes(r.kind)).map(r => [r.kind, r.key, r.text]),
    [['same', 'equal:2:3', '2コース（13.4%）と3コース（13.4%）の1着率は同じ値']]);
  assert.ok(v5.find(r => r.kind === 'same').featured);
  assert.equal(READING_LESSONS.find(l => l.kind === 'same').text, 'この集計期間では、2つのコースの1着率は同じ値です。');
  assert.doesNotMatch(READING_LESSONS.find(l => l.kind === 'same').text, /ほぼ|同じ数字ではありません/);
  // A gap above 0 stays "near", whose lesson says the figures are not the same.
  assert.deepEqual(courseReadings(close, { extended: true }).filter(r => ['near', 'same'].includes(r.kind)).map(r => r.kind), ['near']);
  assert.match(READING_LESSONS.find(l => l.kind === 'near').text, /ほぼ並んでいます（同じ数字ではありません）/);
  // Version 4 keeps its reading of a tie (the existing "同じ値" note inside the near reading).
  assert.deepEqual(v4.filter(r => ['near', 'same'].includes(r.kind)).map(r => [r.kind, r.text]), [['near', '2コース（13.4%）と3コース（13.4%）の1着率はほぼ同じ水準（同じ値）']]);
  // Statements: "同じ値" for a tie is right; "ほぼ同じ" for a tie is shown for review (version 5 only), never blocking.
  const V5 = { extended: true };
  assert.deepEqual(keys('2コースと3コースの1着率は同じ値です。', tie, V5), ['equal:2:3']);
  assert.deepEqual(verdict('2コースと3コースの1着率は同じ値です。', tie, V5), [0, 0]);
  assert.deepEqual(verdict('2コースと3コースの1着率は同じ値です。', close, V5), [1, 0], 'not the same value');
  assert.deepEqual(verdict('2コースと3コースの1着率はほぼ同じです。', tie, V5), [0, 1]);
  assert.match(comparisonFindings('2コースと3コースの1着率はほぼ同じです。', tie, V5).unclear[0], /同じ値なので「同じ値」と書きます/);
  assert.deepEqual(verdict('2コースと3コースの1着率はほぼ同じです。', close, V5), [0, 0], 'above 0 and up to 0.5: right');
  assert.deepEqual(verdict('2コースと3コースの1着率はほぼ同じです。', tie), [0, 0], 'version 4: as before');
  // A plan with a tie gives it the "same" lesson, not the near one.
  const pack = asV5(kiryuV5Pack, { facts: tie.map(f => ({ ...f, label: f.label.replace('テスト', '桐生') })) });
  const lessons = articlePlan(pack).discoveries.flatMap(d => [d.main, ...d.also]).filter(r => /^equal:/.test(r.key)).map(r => r.lesson);
  assert.deepEqual(lessons, ['この集計期間では、2つのコースの1着率は同じ値です。']);
});

test('in_order: the lesson describes how the period\'s figures stand, not a change or its cause', () => {
  const lesson = READING_LESSONS.find(l => l.kind === 'in_order').text;
  assert.equal(lesson, 'この集計期間では、外側のコースほど、1着率が順に低く並んでいます。これは、その期間の集計結果です。');
  assert.doesNotMatch(lesson, /なりました|なった|下がって|ため|から低/);
  // Read and checked as the inside-first order (version 5).
  const sentence = '外側のコースほど、1着率が順に低く並んでいます。';
  assert.deepEqual(keys(sentence, todaFacts, { extended: true }), ['sequence:in']);
  assert.deepEqual(verdict(sentence, todaFacts, { extended: true }), [0, 0]);
  assert.deepEqual(verdict(sentence, tokonameFacts, { extended: true }), [1, 0], 'Tokoname has 4 > 3');
  // The prompt's summary example and rules say it the same way.
  const prompt = buildInstructions(todaV5Pack);
  assert.match(prompt, /また、外側のコースほど、1着率が順に低く並んでいました。/);
  assert.match(prompt, /「低くなった」「下がってきた」のような時間の変化や、その原因の説明にはしません/);
  assert.doesNotMatch(prompt, /順に低くなっていました|順に低くなりました/);
});

test('statements, older packs: read exactly as before PHASE 5.0 (the new patterns and statements are version 5 only)', () => {
  // None of the PHASE 5.0 statements is read without the extended option…
  for (const [text, facts] of [
    ['1コースの1着率は42.8%で、6つのコースの中で最も高いのに、半分には届きません。', todaFacts],
    ['3コース（14.9%）と4コース（14.2%）は、順位は違いますが差は小さいです。', todaFacts],
    ['3コースと4コースの1着率は差がありません。', todaFacts],
    ['3コースと4コースの1着率は同じ数字です。', todaFacts],
    ['1着率は外側のコースほど順に低くなりました。', tokonameFacts],
    ['この集計期間では、1コースの1着率は42.8%で、1コースから進入した艇が、半分を超えるレースで1着になりました。', todaFacts],
  ]) {
    assert.ok(!keys(text, facts).some(k => /^(contrast|close|equal)/.test(k)), text);
    assert.deepEqual(verdict(text, facts), [0, 0], text);
  }
  // …and "ほぼ同じ" beyond 0.5 points is not noted for them.
  assert.deepEqual(verdict('3コースと4コースの1着率はほぼ同じです。', todaFacts), [0, 0]);
  // The statements they had are still checked as before.
  assert.deepEqual(keys('1コースの1着率は42.8%で、半分に届いていません。', todaFacts), ['under_half:1']);
  assert.deepEqual(verdict('1コースの1着率は61.2%で、半分に届いていません。', tokonameFacts), [1, 0]);
  assert.deepEqual(verdict('1コースの1着率は42.8%で、半分を超えています。', todaFacts), [1, 0]);
  assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高くなっています。', tokonameFacts), [1, 0]);
  // The v4 regression drafts and the version 4 model articles are covered by the regression test above.
});

test('correction for every version: "かな" / "かも" inside a word is no hedge (stricter, never looser)', () => {
  // Before PHASE 5.0, "かな" anywhere in the sentence ("届かない", "なかなか") made an inside-first claim a hedge, so a
  // contradiction there was only shown for review. A real guess is still a hedge, in every version.
  for (const options of [{}, { extended: true }]) {
    assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高い表で、外のコースは内側に届かない。', tokonameFacts, options), [1, 0], 'wrong, and now said for certain');
    assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高い表で、しかも例外はない。', tokonameFacts, options), [1, 0]);
    assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高いのかな', tokonameFacts, options), [0, 1], 'a guess: review only');
    assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高いかもしれません', tokonameFacts, options), [0, 1]);
    // A right claim stays right.
    assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高い表で、外のコースは内側に届かない。', todaFacts, options), [0, 0]);
  }
});

test('plans from version 5 packs: two discoveries, each with its lesson; the dialogue takes one', () => {
  const summary = pack => { const plan = articlePlan(pack); return [plan.discoveries.map(d => `${d.main.key}${d.also.map(a => `+${a.key}`).join('')}@${d.place}`), plan.dialogueFocus?.key ?? null, plan.sections]; };
  assert.deepEqual(summary(todaV5Pack), [['contrast:1@dialogue', 'sequence:in+close:3:4@body'], 'contrast:1', { min: 4, max: 4 }]);
  assert.deepEqual(summary(tokonameV5Pack), [['half:1@body', 'pair:4>3+except:2:高@dialogue'], 'pair:4>3', { min: 4, max: 4 }]);
  assert.deepEqual(summary(hamanakoV5Pack), [['half:1@body', 'pair:3>2+close:2:3@dialogue'], 'pair:3>2', { min: 4, max: 4 }]);
  assert.deepEqual(summary(kiryuV5Pack)[0], ['half:1@body', 'near:2:3+except:3:高@dialogue']);
  assert.deepEqual(summary(tamagawaV5Pack)[0].slice(0, 2).map(s => s.split('@')[0].split('+')[0]), ['half:1', 'pair:3>2']);
  for (const pack of [todaV5Pack, tokonameV5Pack, hamanakoV5Pack, kiryuV5Pack]) {
    const plan = articlePlan(pack);
    assert.ok(plan.discoveries.every(d => d.main.lesson || d.also.some(a => a.lesson)), pack.stadium.name);
    assert.ok(plan.dialogueFocus.lesson, pack.stadium.name);
  }
  // The water theme keeps its PHASE 4.7 plan (no discoveries); a version 4 pack keeps the old plan.
  assert.deepEqual(articlePlan(tokonameWaterV5Pack).discoveries, []);
  assert.deepEqual(articlePlan({ ...todaPack }).discoveries, []);
  // New packs are version 5, with the extended readings.
  const topic = candidateTopics({ categorySlug: 'stadium-basics', stadiumSlug: 'toda' }).find(x => x.angle === 'course');
  const pack = buildSourcePack({ topic, documents: [], now: () => new Date('2026-10-14T00:00:00Z') });
  assert.equal(pack.version, 5);
  assert.deepEqual(pack.readings, courseReadings(pack.facts, { extended: true }));
});

test('prompt blog-ai-v12 rules kept in v13: discoveries with their lessons, honest titles, descriptive headings, no computed gaps', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v13');
  const toda = buildInstructions(todaV5Pack);
  assert.match(toda, /②発見の節：readings の「1コースの1着率（42\.8%）は6つのコースの中で最も高いが、半分には届いていない」。この節は dialogue で伝えます/);
  assert.match(toda, /③発見の節：readings の「1着率は外側のコースほど順に低い/);
  assert.match(toda, /問いにしたときは、本文でその問いに必ず答えます。数字と感嘆符だけで目を引く書き方（「42\.8%！」など）はしません/);
  assert.match(toda, /「発見①」のような番号やラベルは付けず、説明の文にします/);
  assert.match(toda, /2つの数字の差を計算した数字（「0\.7ポイント差」「〇倍」など）は書きません。差が小さいときは、facts の元の数字を2つとも示して「差は小さい」と書きます/);
  assert.match(toda, /「ほぼ同じ」は、readings で「ほぼ同じ水準」とされた2つのコースだけに使い、「同じ」「差がない」とは書きません/);
  assert.match(toda, /ちょうど50%のときはどちらも使いません/);
  assert.match(toda, /説明は必ず「この集計期間では」のように集計期間と対象（そのコースから進入した艇）に限り、これからのレースの結果・勝つ確率・原因・舟券の有利不利には広げません/);
  assert.match(toda, /この会話は数字の読み方の話なので、当日の確認項目（スタート展示など）には触れず、読み方を答えて終えます/);
  // blog-ai-v13 (PHASE 5.1) keeps the rule; the summary is no longer told to take two sentences or a fixed closing.
  assert.match(toda, /「一方で」は、2つが対照的なとき.*だけに使います/);
  assert.match(toda, /「〜と捉えると読み違えにくくなります」のような中身のない文にしません/);
  // The category's own rules stay (the outer theme is in the stadiums category).
  assert.match(buildInstructions(tokonameOuterV5Pack), /展開予想・買い目・選手評価は書きません/);
  assert.match(buildInstructions(tokonameOuterV5Pack), /②発見の節/);
  // A title question only where the reading is the highest-yet-below-half contrast.
  assert.doesNotMatch(buildInstructions(tokonameV5Pack), /問いの形にしてもかまいません/);
  // An exception keeps the entry pointer (who enters the outer course matters there).
  assert.match(buildInstructions(tokonameV5Pack), /下の確認項目のスタート展示で見てみよう/);
  // Every example comes from the stadium's own data: no other stadium's name, and no example the data contradicts.
  const others = ['戸田', '常滑', '桐生', '浜名湖', '多摩川'];
  for (const pack of [todaV5Pack, tokonameV5Pack, kiryuV5Pack, hamanakoV5Pack, tamagawaV5Pack, tokonameOuterV5Pack, tokonameWaterV5Pack]) {
    const prompt = buildInstructions(pack);
    for (const name of others.filter(n => n !== pack.stadium.name)) assert.ok(!prompt.includes(name), `${pack.stadium.name}: ${name}`);
    const examples = [...prompt.matchAll(/例：?「([^」]{6,})」/g)].map(m => m[1]);
    for (const example of examples) assert.deepEqual(verdict(example, pack.facts), [0, 0], `${pack.stadium.name}: ${example}`);
  }
  // blog-ai-v13: the takeaways name the topics of the discoveries' sections (an older pack keeps the stadium's example).
  assert.match(toda, /この記事の発見の節で実際に扱う話題と一致させます（例：「1コースの数字の読み方」「6つのコースの並び方」）/);
  assert.match(buildInstructions(todaPack), /話題だけを短く書き（例：「戸田のコース別1着率の見方」「1コースの数字の読み方」）/);
  // The input carries the lessons the discoveries use.
  const input = buildInput(todaV5Pack);
  const lessons = (typeof input === 'string' ? JSON.parse(input) : input).reading_lessons;
  assert.ok(lessons.length >= 2 && lessons.every(l => READING_LESSONS.some(r => r.text === l.lesson)));
});

test('the reading lessons: scoped to the period, no figures, no chance, cause or betting; listed in the review doc', () => {
  for (const { kind, text } of READING_LESSONS) {
    assert.match(text, /この集計期間/, kind);
    assert.doesNotMatch(text, /\d+(\.\d+)?%|\d+\.\d/, kind);
    assert.doesNotMatch(text, /(確率|勝ちやす|有利|不利|狙い目|買い|舟券|ため|から有利)/, kind);
  }
  const doc = readFileSync(new URL('../../docs/blog/AI-QUALITY-REVIEW.md', import.meta.url), 'utf8');
  for (const { kind, text } of READING_LESSONS) assert.ok(doc.includes(`| ${kind} | ${text} |`), `${kind} is listed for review`);
});

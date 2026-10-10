import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { v4Topic, v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { v6Pack, v6Document } from './_tokonameV6.mjs';
import { v7Pack, v7Document } from './_tokonameV7.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { buildInstructions, buildInput } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { GLOSSARY, DATA_CHECK_PURPOSES, RATE_WARNING, dataCheckLine } from '../../lib/blog/ai/glossary.mjs';

const codes = issues => [...new Set(issues.map(i => i.code))].sort();
const warnings = issues => codes(issues.filter(i => i.level === 'warning'));
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const scores = (document, pack, issues = validateAiDocument({ document, pack })) => scorecard({ document, pack, issues });
// The Tokoname pack as PHASE 4.5 builds it (version 4: the WARNING carries the course-rate caveat).
const v8Pack = () => ({ ...structuredClone(v6Pack), version: 4, comparison: undefined });
const compose = (ai, pack = v8Pack()) => composeDocument({ ai, pack, topic: v4Topic, catalogue });
const check = (document, pack = v8Pack()) => validateAiDocument({ document, pack });
const ICHIKA = 'いい発見だね。理由は表だけでは分からないけど、並び方に例外がある期間だと覚えておこう。誰が4コースに入りそうかは、下の確認項目のスタート展示で見てみよう。';
const V7_ICHIKA = 'この期間の集計では、内側から順に並ぶわけではないと読めるよ。表は過去の集計期間の数字で、当日の進入はスタート展示で参考に見られるけど、本番で変わることもあるんだ。';

// The theme written as blog-ai-v8 asks: the 号艇/course difference once before the table, 一果 pointing at the DATA
// CHECK instead of restating it, the caveat once in the WARNING (right after the DATA CHECK), and a summary that
// recalls the two findings in new words.
const ideal = () => ({
  title: '常滑のコース別1着率｜1コースは半分超え、では2番手は？',
  excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  seo_title: '常滑のコース別1着率を読む', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  takeaways: ['1コースの1着率の高さと、1コース以外で目立つコース', '号艇とコースの違い', '当日に確かめる項目とその理由'],
  lead: '常滑は海水で、干満差はない水面です。そのコース別1着率の表には、内側から順に並んでいないところがあります。どこなのか、1コースの数字から見ていきましょう。',
  sections: [
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。', ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        { character: 'kiina', pose: 'pose3', text: 'あれ、4コースの1着率10.0%が3コースの8.5%より上だ。外の方が上って、ちょっと意外じゃない？' },
        { character: 'ichika', pose: 'pose1', text: ICHIKA }] },
    ] },
    { heading: '当日に確かめること', blocks: [
      t('data_check', DATA_CHECK_PURPOSES.map(dataCheckLine).join('\n')),
      t('warning', RATE_WARNING),
    ] },
  ],
  summary: 'この期間の常滑は、1コースが半分を超える一方で、外の4コースが3コースを上回る例外もありました。表を見るときは、高い順だけでなく並び方の例外にも目を向けてみてください。',
  needs_check: [],
});
const variant = change => { const ai = ideal(); change(ai); const { document } = compose(ai); return { document, issues: check(document) }; };

test('regression (Tokoname v7 draft 2026-10-10): one finding per repetition; the two missed repetitions are now noted', () => {
  const issues = check(v7Document, v7Pack);
  assert.deepEqual(issues.filter(i => i.level === 'blocking').map(i => i.code), ['comparison_draft']);
  assert.deepEqual(warnings(issues), ['dialogue_repeats_note', 'explanation_repeated', 'repeated_caveat', 'summary_restates']);
  // The definition's caveat (block 4) and the WARNING (block 8): one note naming both, no second "misplaced" note.
  const caveat = issues.filter(i => ['repeated_caveat', 'caveat_misplaced'].includes(i.code));
  assert.equal(caveat.length, 1);
  assert.match(caveat[0].message, /ブロック4（TEXT）、ブロック8（WARNING）.*WARNING以外：ブロック4（TEXT）/);
  assert.match(issues.find(i => i.code === 'explanation_repeated').message, /ブロック4（TEXT）、ブロック7（TEXT）/);
  assert.match(issues.find(i => i.code === 'dialogue_repeats_note').message, /^ブロック9（DIALOGUE_SCENE）：.*本番で/);
  const sc = scores(v7Document, v7Pack, issues);
  assert.deepEqual(sc.axes.map(a => a.score), [5, 5, 2, 5, 4, 5, 5]);
  assert.equal(sc.average, 4.3); assert.equal(sc.average_all, 4.4);
});

test('regression: the v4〜v6 scores do not move', () => {
  const table = [[v4Document, v4Pack, [5, 4, 1, 3, 4, 2, null], 3.2], [v5Document, v5Pack, [5, 5, 3, 5, 4, 4, null], 4.3], [v6Document, v6Pack, [5, 5, 5, 5, 4, 5, null], 4.8]];
  for (const [document, pack, expected, average] of table) {
    const sc = scores(document, pack);
    assert.deepEqual(sc.axes.map(a => a.score), expected); assert.equal(sc.average, average);
  }
  // None of the new notes apply to them: no v8 caveat check for packs before version 4, nothing restated by a dialogue.
  for (const [document, pack] of [[v4Document, v4Pack], [v5Document, v5Pack], [v6Document, v6Pack]])
    assert.deepEqual(check(document, pack).filter(i => ['explanation_repeated', 'dialogue_repeats_note', 'warning_note_missing', 'exhibition_as_entry', 'rate_as_chance'].includes(i.code)), []);
});

test('the article blog-ai-v8 asks for: no quality note, every axis at 5', () => {
  const pack = v8Pack(), { document } = compose(ideal(), pack);
  const issues = check(document, pack);
  assert.equal(blockingCount(issues), 0, JSON.stringify(issues.filter(i => i.level === 'blocking')));
  assert.deepEqual(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited'), []);
  const sc = scorecard({ document, pack, issues });
  assert.deepEqual(sc.axes.map(a => [a.key, a.score, a.score === 5 ? '' : a.notes.join()]), sc.axes.map(a => [a.key, 5, '']));
  // The caveat is in the WARNING, once, right after the DATA CHECK, and nowhere else.
  const types = document.blocks.filter(b => !b.data.system).map(b => b.type);
  assert.equal(types[types.indexOf('DATA_CHECK') + 1], 'WARNING');
  const caveat = document.blocks.filter(b => /勝つ確率/.test([b.data.text, ...(b.data.turns || []).map(x => x.text)].join()));
  assert.deepEqual(caveat.map(b => b.type), ['WARNING']);
  assert.equal(document.blocks.filter(b => /本番で(は)?変わる/.test(b.data.text || '')).map(b => b.type).join(), 'DATA_CHECK');
});

test('duplication: each repetition costs one point, and a meaningful recap or the takeaways do not count', () => {
  // The caveat in the definition as well: one note (it used to be two).
  for (const caveat of ['過去の集計期間の数字で、これからのレースで勝つ確率ではありません。', '過去の集計であり、これからのレースで勝つ確率を示す数字ではありません。']) {
    const { document, issues } = variant(ai => { ai.sections[0].blocks[0].text = ai.sections[0].blocks[0].text.replace('1着になった割合です。', `1着になった割合です。${caveat}`); });
    assert.deepEqual(warnings(issues).filter(c => c !== 'auto_cited'), ['repeated_caveat'], caveat);
    assert.equal(scores(document, v8Pack(), issues).axes[2].score, 4);
  }
  // The 号艇/course explanation once is fine; said again after the table, it is a repetition.
  const twice = variant(ai => { ai.sections[0].blocks.splice(2, 0, t('text', 'どちらの数字も号艇別ではなく、そのコースから進入した艇を数えています。', ['S2'])); });
  assert.deepEqual(warnings(twice.issues).filter(c => c !== 'auto_cited'), ['explanation_repeated']);
  // A summary that restates the body's sentences is noted; the ideal's recap in new words is not.
  const restated = variant(ai => { ai.summary = '2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。'; });
  assert.deepEqual(warnings(restated.issues).filter(c => c !== 'auto_cited'), ['summary_restates']);
  // Takeaways that share words with the headings are a table of contents, not a repetition.
  const toc = variant(ai => { ai.takeaways[2] = '当日に確かめること'; });
  assert.deepEqual(warnings(toc.issues).filter(c => c !== 'auto_cited'), []);
  // A sentence with nothing new after the DATA CHECK is noted as such.
  const filler = variant(ai => { ai.sections[1].blocks.splice(1, 0, t('text', '以上の項目を、当日に順番に確認してみましょう。')); });
  assert.deepEqual(warnings(filler.issues).filter(c => c !== 'auto_cited'), ['low_information']);
});

test('characters: a dialogue may point at the DATA CHECK, but restating it or the WARNING is noted', () => {
  const restating = variant(ai => { ai.sections[0].blocks[2].turns[1].text = V7_ICHIKA; });
  assert.deepEqual(warnings(restating.issues).filter(c => c !== 'auto_cited'), ['dialogue_repeats_note']);
  assert.equal(scores(restating.document, v8Pack(), restating.issues).axes.find(a => a.key === 'characters').score, 4);
  const caveat = variant(ai => { ai.sections[0].blocks[2].turns[1].text = 'いい発見だね。でもこれは、これからのレースで勝つ確率ではないんだ。'; });
  assert.ok(caveat.issues.some(i => i.code === 'dialogue_repeats_note'));
  // Pointing at the item to check is not a restatement (the ideal's line).
  assert.ok(!check(compose(ideal()).document).some(i => i.code === 'dialogue_repeats_note'));
});

test('composing (packs from version 4): the course-rate caveat is always in the WARNING', () => {
  const warningsOf = document => document.blocks.filter(b => b.type === 'WARNING' && !b.data.system).map(b => b.data.text);
  // Already there: left as written, not doubled.
  assert.deepEqual(warningsOf(compose(ideal()).document), [RATE_WARNING]);
  // A WARNING without it: added to that WARNING.
  const own = ideal(); own.sections[1].blocks[1].text = '過去の集計期間の数字だけで、当日のレースを判断しないようにしましょう';
  assert.deepEqual(warningsOf(compose(own).document), [`過去の集計期間の数字だけで、当日のレースを判断しないようにしましょう。${RATE_WARNING}`]);
  // No WARNING: one is added at the end of the body (before the summary and the system notes).
  const none = ideal(); none.sections[1].blocks.splice(1, 1);
  const document = compose(none).document;
  assert.deepEqual(warningsOf(document), [RATE_WARNING]);
  const placed = document.blocks.filter(b => !b.data.system).map(b => b.type + (b.data.placement ? `/${b.data.placement}` : ''));
  assert.deepEqual(placed.slice(-3), ['DATA_CHECK', 'WARNING', 'TEXT/summary']);
  assert.ok(!check(document).some(i => i.code === 'warning_note_missing'));
  // Earlier packs (blog-ai-v7 and before) are composed as they were.
  assert.deepEqual(warningsOf(compose(none, { ...v8Pack(), version: 3 }).document), []);
  // Without a course-rate table, nothing is added.
  const facts = v8Pack(); facts.facts = facts.facts.filter(f => !/コース1着率$/.test(f.label));
  assert.deepEqual(warningsOf(compose(none, facts).document), []);
});

test('framing: a WARNING edited so that it no longer carries the caveat is noted (packs from version 4)', () => {
  const { document } = compose(ideal());
  document.blocks.find(b => b.type === 'WARNING' && !b.data.system).data.text = '過去の数字だけで判断しないようにしましょう。';
  const issues = check(document);
  assert.deepEqual(warnings(issues).filter(c => c !== 'auto_cited'), ['warning_note_missing']);
  assert.equal(scorecard({ document, pack: v8Pack(), issues }).axes.at(-1).score, 4);
  assert.ok(!check(document, { ...v8Pack(), version: 3 }).some(i => i.code === 'warning_note_missing'));
});

test('accuracy: the exhibition entry as the race entry, or a past rate as today\'s chance, is noted', () => {
  const said = text => { const r = variant(ai => { ai.sections[0].blocks[2].turns[1].text = text; }); return { codes: warnings(r.issues), sc: scores(r.document, v8Pack(), r.issues) }; };
  const fixed = said('いい発見だね。スタート展示で4コースに入った艇が、そのまま本番も4コースだよ。');
  assert.ok(fixed.codes.includes('exhibition_as_entry')); assert.equal(fixed.sc.axes[0].score, 4);
  assert.ok(said('今日のレースでも1コースの勝つ確率は61.2%だね。').codes.includes('rate_as_chance'));
  // The caveats themselves deny it, and are not claims.
  for (const text of [...GLOSSARY.map(g => g.text), RATE_WARNING, ...DATA_CHECK_PURPOSES.map(dataCheckLine), ICHIKA])
    assert.deepEqual(said(text).codes.filter(c => ['exhibition_as_entry', 'rate_as_chance'].includes(c)), [], text);
});

test('prompt blog-ai-v8: the caveat in the WARNING, the dialogue points at the DATA CHECK, the summary recalls in new words', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v8');
  const pack = v8Pack(), prompt = buildInstructions(pack);
  assert.deepEqual(JSON.parse(buildInput(pack)).warning_notes, [RATE_WARNING]);
  assert.match(prompt, /warning ブロック1つだけに書き、入力JSONの warning_notes の文をそのまま含めます/);
  assert.match(prompt, /data_check のすぐ後に置き、data_check の後に補足の文章（text）は書きません/);
  assert.match(prompt, /「本番では変わることもある」は data_check の項目だけ/);
  assert.match(prompt, /「号艇別ではなく…」と言い直さない/);
  assert.match(prompt, /下の確認項目のスタート展示で見てみよう/);
  assert.match(prompt, /warning や data_check の理由（過去の集計であること、本番で変わることもある、など）は会話で言い直しません/);
  assert.match(prompt, /スタート展示の進入を本番の進入と同じものとして話さず、過去の1着率を当日の勝つ確率や舟券の判断に結びつけません/);
  assert.match(prompt, /発見は本文とは違う言葉で短く振り返り.*数字・集計期間・本文の文は繰り返しません/);
  // The blog-ai-v7 example that led 一果 to restate the caveats is gone.
  assert.doesNotMatch(prompt, /当日の進入はスタート展示で参考に見られるけど、本番で変わることもある/);
  // The definition no longer carries the caveat; RATE_WARNING does.
  assert.doesNotMatch(GLOSSARY.find(g => g.term === 'コース別1着率').text, /勝つ確率/);
});

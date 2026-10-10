import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { kiryuPageRow } from './_kiryuRegression.mjs';
import { v3Topic, v3Document } from './_kiryuV3.mjs';
import { v4Topic, v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { comparisonFindings, comparisonMismatches, courseReadings, rateStatements } from '../../lib/blog/ai/dataReadings.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildInstructions, buildInput } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';

const codes = issues => [...new Set(issues.map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking');
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const facts = v4Pack.facts;
const kiryuNow = () => new Date('2026-10-09T20:21:00Z');
const QUALITY = ['repeated_content', 'repeated_fact', 'stock_phrase', 'too_long_for_facts', 'dialogue_restates', 'cast_mismatch', 'too_many_dialogues', 'unexplained_data', 'causal_claim',
  'course_frame_confusion', 'repeated_caveat', 'summary_restates', 'empty_data_check', 'dialogue_missing', 'numbers_without_reading', 'comparison_mismatch', 'comparison_unclear',
  'table_mismatch', 'repeated_reading', 'takeaways_restate', 'caveat_misplaced', 'low_information', 'rate_numbers_repeated', 'character_role', 'statement_without_source',
  'table_restated', 'data_check_overlap'];

// The Tokoname pack as PHASE 4.3 builds it for a course-rate article: no undated race time slot, so no repository copy.
const v6Pack = () => ({ ...structuredClone(v5Pack), sources: [structuredClone(v5Pack.sources[1])], facts: facts.filter(f => f.source_id === 'S2'),
  readings: courseReadings(facts), comparison: undefined });

// The theme written as blog-ai-v6 asks: the body tells two readings, キイナ brings the third (4 > 3) as her find,
// 一果 says how to read it, the DATA CHECK has three distinct items and the summary keeps one point.
const ideal = () => ({
  title: '常滑のコース別1着率：1コースは半分超え、外の4コースにも注目',
  excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  seo_title: '常滑のコース別1着率を読む', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  takeaways: ['常滑の水質と干満差', '1コースの1着率の高さと、1コース以外で目立つコース', '当日に確かめる項目'],
  sections: [
    { heading: '常滑は海水で干満差なし', blocks: [t('text', '常滑の水質は海水で、干満差は「なし」です。', ['S2'])] },
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', 'コース別1着率は、そのコースから進入した艇が1着になった割合で、枠番（号艇）別の数字ではありません。2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。', ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        { character: 'kiina', pose: 'pose3', text: '表を見て気づいたんだけど、4コースの1着率10.0%は3コースの8.5%より上なんだね。外の方が高いところがあるのは、ちょっと意外。' },
        { character: 'ichika', pose: 'pose1', text: 'いいところに気づいたね。この期間の常滑は、内側から順に1着率が下がっていくわけじゃないんだ。理由は表からは分からないから、並び方には例外があると覚えておくといいよ。' }] },
    ] },
    { heading: '当日に確かめること', blocks: [
      t('data_check', '・出走表の枠番と選手\n・スタート展示の進入コース\n・展示後の直前情報'),
      t('warning', 'コース別1着率は過去の集計で、これからのレースの結果を示すものではありません。'),
    ] },
  ],
  summary: '常滑の表は、内側から順に並んでいないところが見どころです。次は気になるレースで、どの艇が4コースに入るかを確かめてみてください。',
  needs_check: [],
});

test('regression (Tokoname v5 draft 2026-10-10): the restating dialogue, the summary repeating the DATA CHECK, the order the table shows and the overlapping items are reported', () => {
  const issues = validateAiDocument({ document: v5Document, pack: v5Pack });
  assert.deepEqual(blocking(issues).map(i => i.code), ['comparison_draft'], 'only the comparison-draft mark blocks; no wrong figure');
  assert.deepEqual(codes(issues.filter(i => QUALITY.includes(i.code))), ['caveat_misplaced', 'data_check_overlap', 'dialogue_restates', 'table_restated']);
  assert.match(issues.find(i => i.code === 'table_restated').message, /^ブロック7（TEXT）：「高い順に見ると、1コース、2コース、4コース、3コース、5コース、6コース」/);
  assert.match(issues.find(i => i.code === 'data_check_overlap').message, /^ブロック10（DATA_CHECK）.*「当日の出走表・進入」/);
  assert.match(issues.find(i => i.code === 'caveat_misplaced').message, /ブロック12（TEXT）/);
  // Block 7's "4コースは3コースより高く、…わけではありません" is now read as the 4 > 3 reading.
  assert.deepEqual(rateStatements(v5Document.blocks[6].data.text, facts).map(s => s.key), ['order', 'pair:4>3']);
});

test('scorecard: v4 and v5 rescored, with the reasons that changed', () => {
  const rate = (document, pack) => scorecard({ document, pack, issues: validateAiDocument({ document, pack }) });
  const v4 = rate(v4Document, v4Pack), v5 = rate(v5Document, v5Pack);
  // v5 (PHASE 4.2: 5,5,3,4,4,5 → 4.3): the reversal is credited (numbers 4→5); the restating dialogue costs a point
  // under characters only (no longer under duplication as well), where the order told again now does; the
  // overlapping DATA CHECK costs a point of readability.
  assert.deepEqual(v5.axes.map(a => a.score), [5, 5, 3, 5, 4, 4, null]); assert.equal(v5.average, 4.3);
  assert.deepEqual(v5.axes.find(a => a.key === 'duplication').notes, ['注意書きの置き場所', '表の並びを本文で再掲']);
  assert.deepEqual(v5.axes.find(a => a.key === 'characters').notes, ['会話が本文の言い換え']);
  assert.match(v5.axes.find(a => a.key === 'explanation').notes.join(), /注目したい特徴 3個のうち本文で説明 3個/);
  // v4: its DATA CHECK overlaps as well (readability 3→2).
  assert.deepEqual(v4.axes.map(a => a.score), [5, 4, 1, 3, 4, 2, null]);
  // The article blog-ai-v6 asks for: every axis at 5, no quality note.
  const pack = v6Pack(), { document } = composeDocument({ ai: ideal(), pack, topic: v4Topic, catalogue });
  const issues = validateAiDocument({ document, pack });
  assert.equal(blockingCount(issues), 0, JSON.stringify(blocking(issues)));
  assert.deepEqual(issues.filter(i => QUALITY.includes(i.code)), []);
  assert.deepEqual(scorecard({ document, pack, issues }).axes.map(a => a.score), [5, 5, 5, 5, 5, 5, null], 'framing applies from blog-ai-v7 packs');
});

test('negation: a comparison stands when the negation belongs to another clause; a negated comparison states nothing', () => {
  const keys = text => rateStatements(text, facts).map(s => s.key);
  assert.deepEqual(keys('4コースの1着率は3コースより高く、内側から順に下がるわけではありません。'), ['pair:4>3']);
  assert.deepEqual(keys('4コースの1着率が3コースより高いわけではありません。'), []);
  assert.deepEqual(keys('3コースの1着率は4コースより高いとは言えません。'), []);
  assert.deepEqual(keys('6コースが最も低い1着率とは限りません。'), []);
  assert.deepEqual(keys('4コースの1着率が3コースより高いのではなく、ほぼ同じです。'), []);
  // A wrong comparison next to a negation in another clause: clear, so it blocks approval.
  assert.equal(comparisonMismatches('3コースの1着率は4コースより高く、内側から順に下がるわけではありません。', facts).length, 1);
  // After a negation in its own clause ("3コースではなく4コースが…"), the meaning is not certain: shown for review only.
  const unclear = comparisonFindings('1着率は、3コースではなく4コースが5コースより低い。', facts);
  assert.deepEqual([unclear.certain.length, unclear.unclear.length], [0, 1]);
  const doc = structuredClone(v5Document);
  doc.blocks[6].data.text = '1着率は、3コースではなく4コースが5コースより低い。';
  const issues = validateAiDocument({ document: doc, pack: v5Pack });
  assert.ok(issues.some(i => i.code === 'comparison_unclear' && i.level === 'warning' && /ブロック7（TEXT）/.test(i.message)));
  assert.ok(!issues.some(i => i.code === 'comparison_mismatch'));
});

test('order and rank: the order is checked against the data; several periods are certain only when every one disagrees', () => {
  assert.deepEqual(comparisonMismatches('1着率の高い順は1コース、2コース、4コース、3コース、5コース、6コースです。', facts), []);
  assert.match(comparisonMismatches('1着率の高い順は1コース→2コース→3コース→4コース→5コース→6コースです。', facts)[0], /高い順は1コース→2コース→4コース→3コース→5コース→6コース/);
  assert.deepEqual(comparisonMismatches('1着率の低い順に、6コース、5コース、3コースです。', facts), []);
  assert.equal(comparisonMismatches('1着率の低い順に、6コース、3コース、5コースです。', facts).length, 1);
  assert.deepEqual(comparisonMismatches('4コースの1着率は3番目に高い。', facts), []);
  assert.equal(comparisonMismatches('3コースの1着率は3番目に高い。', facts).length, 1);
  // "高い順に見ると、…" names no rate itself: read because the block speaks of the 1着率.
  assert.deepEqual(rateStatements('高い順に見ると、1コース、2コース、3コースの順です。1着率の表です。', facts).map(s => s.key), ['order']);
  assert.deepEqual(rateStatements('高い順に見ると、1コース、2コース、3コースの順です。', facts), [], 'nothing says it is about the 1着率');
  // Two periods: contradicting one of them is for review; contradicting both is certain.
  const spring = facts.filter(f => f.period).map(f => ({ ...f, period: '2026/03/01〜2026/05/31', value: f.label.includes('の4コース') ? '7.0' : f.value }));
  const both = [...facts, ...spring];
  assert.deepEqual(comparisonFindings('4コースの1着率は3コースより高い。', both).certain, []);
  assert.equal(comparisonFindings('4コースの1着率は3コースより高い。', both).unclear.length, 1);
  assert.match(comparisonFindings('2コースの1着率が最も高い。', both).certain[0], /どの集計期間の値とも合いません/);
});

test('DATA CHECK: items that repeat other items are reported; distinct items are not', () => {
  const pack = v6Pack();
  const check = text => { const doc = structuredClone(v5Document); doc.blocks[9].data.text = text; return validateAiDocument({ document: doc, pack: v5Pack }).filter(i => i.code === 'data_check_overlap'); };
  assert.equal(check('・当日の出走表・進入\n・出走表の枠番\n・スタート展示の進入').length, 1);
  assert.equal(check('・出走表の枠番\n・出走表の枠番').length, 1);
  assert.deepEqual(check('・出走表の枠番と選手\n・スタート展示の進入コース\n・展示後の直前情報'), []);
  assert.deepEqual(check('・出走表の枠番\n・スタート展示の進入\n・風と波の状況\n・モーターの情報'), []);
  assert.ok(pack.sources.length === 1);
});

test('plan and prompt blog-ai-v6: each featured reading told once, in the body or by the partner in the dialogue', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v8', 'PHASE 4.5 keeps the blog-ai-v6 rules checked here');
  const tokoname = articlePlan(v6Pack());
  assert.deepEqual(tokoname.placements, { 'half:1': 'body', 'except:2:高': 'body', 'pair:4>3': 'dialogue' });
  assert.deepEqual(tokoname.dialogueFocus, { kind: 'reading', key: 'pair:4>3', text: '4コースの1着率（10.0%）は3コース（8.5%）より高い' });
  const prompt = buildInstructions(v6Pack());
  assert.match(prompt, /R2・R4 は本文で、R5 は会話で、それぞれ1回だけ説明します/);
  assert.match(prompt, /キイナが表を見て「4コースの1着率（10\.0%）は3コース（8\.5%）より高い」に気づき、それを発見として話します（質問の形にしません）/);
  assert.match(prompt, /高い順・低い順の並び（readings の order）は表を見れば分かるので、文章で並べ直しません/);
  assert.match(prompt, /data_check は「読者が当日に確認する項目」を、重ならない3〜4項目/);
  // blog-ai-v7 rewords the summary rule: one or two findings, no definitions, caveats or DATA CHECK items.
  assert.match(prompt, /summary：1〜2文。この記事で分かった重要な発見を.*定義・注意書き・data_check の項目も繰り返しません/);
  assert.match(prompt, /理由やレース展開を推測せず/);
  assert.match(prompt, /質問より発見として話す/);
  const input = JSON.parse(buildInput(v6Pack()));
  assert.deepEqual(input.readings.map(r => [r.id, r.place]), [['R1', 'reference'], ['R2', 'body'], ['R3', 'reference'], ['R4', 'body'], ['R5', 'dialogue'], ['R6', 'reference']]);
  // 初音 as the partner (no outer course above an inner one): a beginner's question, every reading in the body.
  const kiryu = buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: kiryuNow });
  const plan = articlePlan(kiryu);
  assert.equal(plan.partner, 'hatsune'); assert.equal(plan.dialogueFocus.kind, 'question');
  assert.ok(Object.values(plan.placements).every(p => p === 'body'));
  assert.match(buildInstructions(kiryu), /初音が初心者の疑問として「出走表の号艇（枠番）と、表の進入コースは同じものか」を質問し/);
  // A short article: no dialogue, nothing placed there.
  const charm = { ...v6Pack(), facts: [], readings: [], topic: { ...v6Pack().topic, category_slug: 'stadium-charm', angle: 'gourmet' } };
  assert.equal(articlePlan(charm).dialogueFocus, null);
});

test('S1: the undated race time slot is left out of course-rate articles, kept for the water theme with a review note', () => {
  const course = buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: kiryuNow });
  assert.ok(!course.facts.some(f => /レース時間帯/.test(f.label)));
  assert.deepEqual(course.sources.map(s => [s.id, s.kind]), [['S2', 'official_data']], 'the other ids are kept');
  assert.deepEqual(course.facts.filter(f => /水質|干満差/.test(f.label)).map(f => [f.value, f.source_id]), [['淡水', 'S2'], ['なし', 'S2']]);
  const water = buildSourcePack({ topic: { ...v3Topic, angle: 'water' }, documents: [kiryuPageRow], now: kiryuNow });
  assert.deepEqual(water.facts.filter(f => /レース時間帯/.test(f.label)).map(f => [f.value, f.source_id]), [['ナイター', 'S1']]);
  const note = validateAiDocument({ document: v3Document, pack: water }).find(i => i.code === 'source_without_fetch_time');
  assert.match(note.message, /レース時間帯「ナイター」/);
  assert.match(note.message, /「人が追記した事実の出典を登録する」でURL・確認日時と一緒に登録/);
  assert.equal(note.level, 'warning');
  // No guessed dates: the copy has none.
  assert.equal(water.sources[0].fetched_at, null);
  // Packs stored with earlier drafts are used as they are (the v5 pack still has S1 and its race time).
  assert.ok(validateAiDocument({ document: v5Document, pack: v5Pack }).some(i => i.code === 'source_without_fetch_time' && /デイ/.test(i.message)));
});

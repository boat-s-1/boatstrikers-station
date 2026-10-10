import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { kiryuPageRow } from './_kiryuRegression.mjs';
import { v3Topic } from './_kiryuV3.mjs';
import { v4Topic, v4Pack, v4Document } from './_tokonameV4.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { courseReadings, comparisonMismatches, rateStatements } from '../../lib/blog/ai/dataReadings.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildInstructions, buildInput, ARTICLE_SCHEMA } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';

const QUALITY = ['repeated_content', 'repeated_fact', 'stock_phrase', 'too_long_for_facts', 'dialogue_restates', 'cast_mismatch', 'too_many_dialogues', 'unexplained_data', 'causal_claim',
  'course_frame_confusion', 'repeated_caveat', 'summary_restates', 'empty_data_check', 'dialogue_missing', 'numbers_without_reading', 'comparison_mismatch',
  'table_mismatch', 'repeated_reading', 'takeaways_restate', 'caveat_misplaced', 'low_information', 'rate_numbers_repeated', 'character_role', 'statement_without_source'];
const codes = issues => [...new Set(issues.map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking');
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';

// The Tokoname pack as PHASE 4.2 builds it: the repository copy linked to BoatStrikers' own stadium page and named
// after the fact it supplies, and the readings computed again (the v4 pack holds only three).
const v5Pack = () => ({ ...structuredClone(v4Pack),
  sources: [{ ...v4Pack.sources[0], url: '/races/08/info', official_url: OFFICIAL, label: 'BoatStrikers収録データ（常滑の基本情報：レース時間帯）' }, structuredClone(v4Pack.sources[1])],
  readings: courseReadings(v4Pack.facts) });
const compose = (ai, pack = v5Pack()) => composeDocument({ ai, pack, topic: v4Topic, catalogue });
const check = (document, pack = v5Pack()) => validateAiDocument({ document, pack });

// The same theme written as PHASE 4.2 intends: topics in the takeaways, one definition, the system table, the three
// featured readings told once, キイナ noticing the 4コース reversal, caveats in their places.
const improved = () => ({
  title: '常滑のコース別1着率：1コースは61.2%、4コースが3コースを上回る',
  excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。どのコースが高いのか、内側から順に並ばないところはどこかを初心者向けに整理します。',
  seo_title: '常滑のコース別1着率を読む', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。どのコースが高いのか、内側から順に並ばないところはどこかを初心者向けに整理します。',
  takeaways: ['常滑で1着率が最も高いコースと、その数字の大きさ', '内側から順に並ばないコースの関係', 'レース当日に確認したい項目'],
  sections: [
    { heading: '常滑はデイ開催・海水・干満差なし', blocks: [t('text', '常滑のレース時間帯はデイです。水質は海水で、干満差は「なし」です。', ['S1', 'S2'])] },
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', 'コース別1着率は、そのコースから進入した艇が1着になった割合で、枠番（号艇）別の数字ではありません。2026年7月1日から9月30日の集計を表にまとめました。', ['S2']),
      t('rate_table', null),
      t('text', '1コースの1着率は61.2%で、半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。4コースの1着率（10.0%）は3コース（8.5%）より高くなっています。内側のコースほど1着率が高いとは限りません。', ['S2']),
      { type: 'dialogue', text: null, items: [], source_ids: [], turns: [
        { character: 'kiina', pose: 'pose3', text: '3コースより4コースの方が1着率が高いのって、ちょっと意外じゃない？' },
        { character: 'ichika', pose: 'pose1', text: 'この期間の数字ではそうなっているね。理由は表だけでは分からないけど、外側のコースが内側を上回ることもあると分かるよ。' }] },
    ] },
    { heading: '当日に確認したいこと', blocks: [
      t('data_check', '・出走表で各艇の枠番と選手\n・スタート展示での進入コース\n・展示後の直前情報'),
      t('warning', 'コース別1着率は過去の集計で、これからのレースの結果を示すものではありません。'),
    ] },
  ],
  summary: '次は、気になるレースの出走表で、どの艇が4コースに入りそうかを確かめてみてください。',
  needs_check: [],
});

test('regression (Tokoname v4 draft 2026-10-10): uncited takeaways, scattered caveats, a repeated reading and empty sentences are reported', () => {
  const issues = check(v4Document, v4Pack);
  assert.equal(blockingCount(issues), 0, 'as on staging: no wrong figure');
  assert.deepEqual(codes(issues.filter(i => QUALITY.includes(i.code))),
    ['caveat_misplaced', 'low_information', 'repeated_caveat', 'repeated_reading', 'statement_without_source', 'takeaways_restate']);
  assert.match(issues.find(i => i.code === 'statement_without_source').message, /^ブロック1（LIST）.*該当する出典：S2/);
  assert.match(issues.find(i => i.code === 'repeated_reading').message, /1コースが最も高い：ブロック1（LIST）、ブロック7（TEXT）/);
  assert.match(issues.find(i => i.code === 'source_without_fetch_time').message, /この出典の事実：レース時間帯「デイ」/);
  assert.deepEqual(issues.filter(i => i.code === 'low_information').map(i => i.message.split('：')[0]), ['ブロック7（TEXT）', 'ブロック11（TEXT）']);
  assert.ok(!issues.some(i => i.code === 'repeated_fact'), 'the dialogue bringing 61.2% back is not counted as a repetition');
});

test('comparisons: wrong ones in the forms of the Tokoname draft block approval; right, negated and partial ones do not', () => {
  const facts = v4Pack.facts;
  const wrong = ['常滑の2コース1着率は、6つのコースの中で最も高い数字です。', '4コースの1着率10.0%は3コースの8.5%を下回る。', '3コースの1着率は1コース以外で最も高い。',
    '1コース以外では、4コースの1着率が最も高い。', '3コースの1着率は2番目に高い。', '3コースの1着率は半分を超えています。'];
  for (const text of wrong) assert.equal(comparisonMismatches(text, facts).length, 1, text);
  const right = ['常滑の1コース1着率は、6つのコースの中で最も高い数字です。', '4コースの1着率10.0%は3コースの8.5%を上回る。', '2コースの1着率（14.4%）は1コース以外で最も高い。',
    '2026/07/01〜2026/09/30の集計では、1コースの1着率が最も高く、半分を超えています。', '4コースの1着率は3番目に高い。', '6コースが最も低い1着率とは限りません。',
    '4〜6コースの中では4コースの1着率が最も高い。', '1コースは61.2%、2コースは14.4%で最も高い外側のコースです。', '2コースが最も速いスタートです。'];
  for (const text of right) assert.deepEqual(comparisonMismatches(text, facts), [], text);
  // A dialogue whose question names the 1着率: the answer is read in that context.
  const doc = structuredClone(v4Document);
  doc.blocks[7].data.turns[1].text = '2026/07/01〜2026/09/30の常滑では、6つのコースの中で2コースが最も高い数字だよ。';
  doc.blocks[0].data.items[0] = '常滑の2コース1着率は、6つのコースの中で最も高い数字です。';
  const issues = check(doc, v4Pack);
  assert.deepEqual(blocking(issues).map(i => i.message.split('：')[0]), ['ブロック1（LIST）', 'ブロック8（DIALOGUE_SCENE）']);
  assert.ok(blocking(issues).every(i => i.code === 'comparison_mismatch'));
});

test('readings: rank order, reversals and the best of the rest; 2〜3 featured, never a new number', () => {
  const tokoname = courseReadings(v4Pack.facts);
  assert.deepEqual(tokoname.map(r => [r.kind, r.text, r.featured]), [
    ['top', '1コースの1着率（61.2%）が6つのコースの中で最も高い', false],
    ['half', '1コースの1着率（61.2%）は半分を超えている', true],
    ['bottom', '6コースの1着率（2.2%）が最も低い', false],
    ['except_top', '2コースの1着率（14.4%）は1コース以外で最も高い', true],
    ['reversal', '4コースの1着率（10.0%）は3コース（8.5%）より高い', true],
    ['order', '1着率の高い順：1コース→2コース→4コース→3コース→5コース→6コース', false],
  ]);
  for (const r of tokoname) for (const n of r.text.match(/\d+\.\d+/g) || []) assert.ok(v4Pack.facts.some(f => f.value === n), `${n} is a recorded value`);
  const kiryu = buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') }).readings;
  assert.deepEqual(kiryu.filter(r => r.featured).map(r => r.kind), ['half', 'except_top', 'near'], 'a near tie is not reported as a reversal');
  assert.ok(!kiryu.some(r => r.kind === 'reversal'));
  const input = JSON.parse(buildInput(v5Pack()));
  assert.deepEqual(input.rate_table, { available: true, source_id: 'S2', period: '2026/07/01〜2026/09/30' });
  assert.deepEqual(JSON.parse(buildInput({ ...v5Pack(), facts: v4Pack.facts.filter(f => !/6コース/.test(f.label)) })).rate_table, { available: false });
});

test('rate table: built by the system from the official facts, cited with its period; never guessed', () => {
  const { document, issues: composed } = compose(improved());
  const table = document.blocks.find(b => b.type === 'TABLE');
  assert.deepEqual(table.data.rows, [['コース', '1着率'], ['1コース', '61.2%'], ['2コース', '14.4%'], ['3コース', '8.5%'], ['4コース', '10.0%'], ['5コース', '4.4%'], ['6コース', '2.2%']]);
  assert.equal(table.data.caption, '常滑のコース別1着率（集計期間 2026/07/01〜2026/09/30）');
  assert.deepEqual([table.data.source_ids, table.data.source_url, table.data.generated], [['S2'], OFFICIAL, 'rate_table']);
  assert.ok(!composed.some(i => i.level === 'blocking'));
  // Edited by hand to another value → blocked; the figure exists elsewhere in the data, so only this check sees it.
  const edited = structuredClone(document);
  edited.blocks.find(b => b.type === 'TABLE').data.rows[3][1] = '10.0%';
  assert.deepEqual(blocking(check(edited)).map(i => i.code), ['table_mismatch']);
  assert.match(blocking(check(edited))[0].message, /3コース「10\.0%」（公式データ 8\.5%）/);
  // An incomplete table is never filled in.
  const partial = { ...v5Pack(), facts: v4Pack.facts.filter(f => !/6コース/.test(f.label)) };
  const without = compose(improved(), partial);
  assert.ok(!without.document.blocks.some(b => b.type === 'TABLE'));
  assert.ok(without.issues.some(i => i.code === 'rate_table_unavailable'));
  // Left out by the AI: placed after the first block of the 1着率 section, unless the AI listed the rates itself.
  const omitted = improved(); omitted.sections[1].blocks.splice(1, 1);
  const placed = compose(omitted).document.blocks;
  assert.equal(placed[placed.findIndex(b => b.type === 'HEADING' && /1着率/.test(b.data.text)) + 2].type, 'TABLE');
  const listed = improved(); listed.sections[1].blocks[1] = { type: 'list', text: null, items: ['1コース：61.2％', '2コース：14.4％', '3コース：8.5％', '4コース：10.0％', '5コース：4.4％', '6コース：2.2％'], turns: [], source_ids: ['S2'] };
  assert.ok(!compose(listed).document.blocks.some(b => b.type === 'TABLE'), 'answers written before blog-ai-v5 keep their own list');
});

test('regression (Tokoname theme): written as PHASE 4.2 intends, it passes every check with no quality notes', () => {
  const pack = v5Pack();
  const { document } = compose(improved(), pack);
  const issues = check(document, pack);
  assert.equal(blockingCount(issues), 0, JSON.stringify(blocking(issues)));
  assert.deepEqual(issues.filter(i => QUALITY.includes(i.code)), []);
  assert.deepEqual(document.blocks.filter(b => b.data.placement === 'sources').map(b => [b.data.text, b.data.source_url]), [
    ['BoatStrikers収録データ（常滑の基本情報：レース時間帯）｜取得日時 記録なし', '/races/08/info'],
    ['BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 2026/07/01〜2026/09/30｜取得日時 2026/10/10 18:34', OFFICIAL],
  ]);
});

test('sources: comparisons without numbers are cited too; the repository copy links to the page that shows it', () => {
  const ai = improved();
  ai.takeaways = ['常滑の1コース1着率は、6つのコースの中で最も高い数字です。', 'レース時間帯はデイ開催'];
  const { document, issues } = compose(ai);
  assert.deepEqual(document.blocks[0].data.source_ids, ['S2', 'S1']);
  assert.equal(document.blocks[0].data.source_url, OFFICIAL, 'the fetched official page first');
  assert.match(issues.find(i => i.code === 'auto_cited').message, /^ブロック1（LIST）：比較・事実の出典を自動で設定しました（S2・S1）/);
  // A block resting only on the repository copy links to BoatStrikers' stadium page, not to an official page
  // that does not show the race time slot.
  const only = improved(); only.sections[0].blocks = [t('text', '常滑のレース時間帯はデイです。')];
  const basic = compose(only).document.blocks.find(b => b.type === 'TEXT' && /デイ/.test(b.data.text));
  assert.deepEqual([basic.data.source_ids, basic.data.source_url], [['S1'], '/races/08/info']);
  // Built from the code: the copy is named after what it supplies and keeps the official page it was taken from.
  // Since PHASE 4.3 it supplies the race time slot only to the water theme (course-rate articles have no use for it).
  const kiryu = buildSourcePack({ topic: { ...v3Topic, angle: 'water' }, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') });
  assert.deepEqual([kiryu.sources[0].url, kiryu.sources[0].official_url, kiryu.sources[0].label],
    ['/races/01/info', 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01', 'BoatStrikers収録データ（桐生の基本情報：レース時間帯）']);
  const noPage = buildSourcePack({ topic: v3Topic, now: () => new Date('2026-10-09T20:21:00Z') });
  assert.equal(noPage.sources[0].label, 'BoatStrikers収録データ（BOAT RACE公式・桐生・2026/05/01〜2026/07/31集計）', 'the dated copy keeps its period in the name');
  // Removing a citation from such a statement is reported, without blocking approval.
  const doc = structuredClone(document); delete doc.blocks[0].data.source_url;
  const after = check(doc);
  assert.ok(after.some(i => i.code === 'statement_without_source' && i.level === 'warning'));
  assert.equal(blockingCount(after), 0);
});

test('characters: the partner follows the data; each does their part; nobody is forced in', () => {
  const tokoname = articlePlan(v5Pack());
  assert.deepEqual([tokoname.lead, tokoname.partner, tokoname.allowed], ['ichika', 'kiina', ['ichika', 'hatsune', 'kiina']]);
  const kiryu = articlePlan(buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') }));
  assert.equal(kiryu.partner, 'hatsune', 'no outer course above an inner one: the reader\'s questions instead');
  const prompt = buildInstructions(v5Pack());
  assert.match(prompt, /登場するのは一果・キイナだけです/);
  assert.match(prompt, /外コースや、内側から順に並ばない意外なデータに気づいて話題にする/);
  assert.match(prompt, /初心者向けに、データの読み方/);
  // Role checks on the dialogue.
  const ai = improved();
  ai.sections[1].blocks[3].turns = [
    { character: 'hatsune', pose: 'pose1', text: '女子戦でも1着率は同じように読めますね。' },
    { character: 'kiina', pose: 'pose2', text: '1コースの1着率はやっぱり高いね。' },
    { character: 'ichika', pose: 'pose1', text: 'この期間ではそうだね。' }];
  const message = check(compose(ai).document).find(i => i.code === 'character_role').message;
  assert.match(message, /初音が読者の疑問を質問していません/); assert.match(message, /初音が出典にない女子戦の話をしています/);
  assert.match(message, /キイナが外コースや意外なデータに触れていません/);
  // The v4 draft with 初音 stays without a cast note: she is still suited to the theme.
  assert.ok(!check(v4Document, v4Pack).some(i => i.code === 'cast_mismatch'));
});

test('scorecard: six axes for the reviewer, higher for the article PHASE 4.2 intends; no effect on approval', () => {
  const before = scorecard({ document: v4Document, pack: v4Pack, issues: check(v4Document, v4Pack) });
  const pack = v5Pack(), { document } = compose(improved(), pack), issues = check(document, pack);
  const after = scorecard({ document, pack, issues });
  assert.equal(after.reference_only, true);
  // PHASE 4.4 adds a seventh axis (framing), scored for blog-ai-v7 packs only; the six classic ones stay comparable.
  assert.deepEqual(after.axes.map(a => a.key), ['accuracy', 'sources', 'duplication', 'explanation', 'characters', 'readability', 'framing']);
  assert.deepEqual(after.axes.map(a => a.score), [5, 5, 5, 5, 5, 5, null]);
  // PHASE 4.3: the overlapping DATA CHECK item (「当日の出走表のコース進入」) now costs a point of readability.
  assert.deepEqual(before.axes.map(a => a.score), [5, 4, 1, 3, 4, 2, null]);
  assert.ok(after.average > before.average);
  assert.match(before.axes.find(a => a.key === 'explanation').notes.join(), /未使用：.*4コースの1着率（10\.0%）は3コース（8\.5%）より高い/);
  // A wrong figure scores 1 on accuracy, and approval is decided by the blocking checks exactly as before.
  const wrong = structuredClone(document); wrong.blocks.find(b => b.type === 'TABLE').data.rows[1][1] = '14.4%';
  const wrongIssues = check(wrong, pack);
  assert.equal(scorecard({ document: wrong, pack, issues: wrongIssues }).axes[0].score, 1);
  assert.equal(blockingCount(wrongIssues), 1);
  // A short article without data: no dialogue is right, the numbers axis does not apply.
  const charm = { ...pack, facts: [], readings: [], topic: { ...pack.topic, category_slug: 'stadium-charm', angle: 'gourmet' } };
  const short = scorecard({ document: { ...document, blocks: document.blocks.filter(b => b.type !== 'DIALOGUE_SCENE') }, pack: charm, issues: [] });
  assert.equal(short.axes.find(a => a.key === 'explanation').score, null);
  assert.equal(short.axes.find(a => a.key === 'characters').score, 5);
});

test('prompt blog-ai-v5: system table, featured readings, takeaways without figures, caveats in their place', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v7', 'PHASE 4.4 (the blog-ai-v5 rules below are kept)');
  const types = ARTICLE_SCHEMA.properties.sections.items.properties.blocks.items.properties.type.enum;
  assert.ok(types.includes('rate_table'));
  const prompt = buildInstructions(v5Pack());
  assert.match(prompt, /\{"type":"rate_table"\}/);
  assert.match(prompt, /readings の R2・R4・R5（featured）/);
  assert.match(prompt, /takeaways：.*数値・比較・注意書きは書きません/);
  assert.match(prompt, /「過去の数字だけで判断しない」は warning ブロック1つだけ（.*?）、「当日の出走表・進入を確認する」は data_check の項目だけ/);
  assert.match(buildInstructions({ ...v5Pack(), facts: v4Pack.facts.filter(f => !/6コース/.test(f.label)) }), /rate_table は使いません/);
  // Statements are read the same way the prompt asks them to be written.
  assert.deepEqual(rateStatements('4コースの1着率（10.0%）は3コース（8.5%）より高い', v4Pack.facts).map(s => s.key), ['pair:4>3']);
});

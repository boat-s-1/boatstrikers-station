import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { kiryuTopic, kiryuPageRow, storedPack, storedDocument } from './_kiryuRegression.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { qualityIssues, similarity } from '../../lib/blog/ai/quality.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';

const QUALITY = ['repeated_content', 'repeated_fact', 'stock_phrase', 'too_long_for_facts', 'dialogue_restates', 'cast_mismatch', 'too_many_dialogues', 'unexplained_data', 'causal_claim', 'course_frame_confusion'];
const freshPack = () => buildSourcePack({ topic: kiryuTopic, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') });
const codes = issues => [...new Set(issues.map(i => i.code))].sort();
const block = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });

// The Kiryu theme written as PHASE 4 intends: short (4 kinds of information), one guide, rates explained once,
// period and source on every figure, a dialogue that adds a reading tip instead of repeating the text.
const wellWritten = () => ({
  title: '桐生の水面と干満差：淡水・干満差なしとコース別1着率の読み方',
  excerpt: '桐生の水質と干満差、そして2026年7月1日から9月30日のコース別1着率を、BOAT RACE公式データで確認します。数字が何を示すのかも、初心者向けに一緒に整理します。',
  seo_title: '桐生の水面と干満差の基本', seo_description: '桐生の水質・干満差と、2026年7月1日から9月30日のコース別1着率をBOAT RACE公式データで確認。コース別1着率が何を示す数字かも初心者向けに説明します。',
  takeaways: ['桐生の水質と干満差（BOAT RACE公式データ）', '2026年7月1日から9月30日のコース別1着率と、その読み方'],
  sections: [
    { heading: '水質は淡水、干満差はなし', blocks: [block('text', '桐生の水質は淡水で、干満差は「なし」とBOAT RACE公式データに記載されています。レースはナイター開催です。', ['S2', 'S1'])] },
    { heading: 'コース別1着率は1コースが54.7%', blocks: [
      block('text', 'コース別1着率は、そのコースから進入した艇が1着になった割合です。枠番（号艇）ではなく、実際に進入したコースで集計されています。2026年7月1日から9月30日の集計では、1コースが54.7%と6つのコースの中で最も高く、半分を超えています。2コース（13.2%）と3コース（13.4%）はほぼ同じ水準で、6コース（3.0%）が最も低くなっています。', ['S2']),
      { type: 'list', text: null, items: ['1コース：54.7%', '2コース：13.2%', '3コース：13.4%', '4コース：9.4%', '5コース：6.8%', '6コース：3.0%'], turns: [], source_ids: ['S2'] },
      { type: 'dialogue', text: null, items: [], turns: [{ character: 'ichika', pose: 'pose2', text: '進入したコースの成績だから、出走表の枠番とは分けて読もうね。' }], source_ids: [] },
    ] },
    { heading: '当日に確認したいこと', blocks: [
      block('data_check', '出走表の枠番と、スタート展示での進入コースを見比べます。'),
      block('warning', 'コース別1着率は過去の集計で、これからのレース結果を示すものではありません。'),
    ] },
  ],
  summary: '桐生の基本情報とコース別1着率は、BOAT RACE公式データで確かめられます。当日は出走表とスタート展示で進入コースを確かめてから、数字を見比べてみてください。',
  needs_check: [],
});

test('regression (Kiryu draft 2026-10-10): the repetitive first draft is reported for each quality problem', () => {
  const issues = qualityIssues({ document: storedDocument, pack: storedPack });
  // PHASE 4.5: a repeated caveat is one finding (naming the places outside its home); caveat_misplaced is for one written once.
  assert.deepEqual(codes(issues), ['dialogue_restates', 'low_information', 'numbers_without_reading', 'repeated_caveat', 'repeated_fact', 'stock_phrase', 'summary_restates', 'too_long_for_facts', 'too_many_dialogues', 'unexplained_data']);
  assert.ok(issues.every(i => i.level === 'warning'), 'quality notes do not change what blocks approval');
  assert.match(issues.find(i => i.code === 'repeated_fact').message, /桐生の干満差：4か所/);
  assert.match(issues.find(i => i.code === 'stock_phrase').message, /「判断材料」2回/);
  assert.match(issues.find(i => i.code === 'too_long_for_facts').message, /11個、目安9個まで/);
  assert.match(issues.find(i => i.code === 'dialogue_restates').message, /^ブロック4（DIALOGUE_SCENE）/);
  // The PHASE 2 result for the same draft is unchanged: only the two uncited blocks block approval.
  assert.deepEqual(validateAiDocument({ document: storedDocument, pack: storedPack }).filter(i => i.level === 'blocking').map(i => i.code), ['missing_source', 'missing_source']);
});

test('regression (Kiryu draft 2026-10-10): the same theme written well passes every source check with no quality notes', () => {
  const pack = freshPack();
  const { document } = composeDocument({ ai: wellWritten(), pack, topic: kiryuTopic, catalogue });
  const issues = validateAiDocument({ document, pack });
  assert.equal(blockingCount(issues), 0, JSON.stringify(issues.filter(i => i.level === 'blocking')));
  assert.deepEqual(issues.filter(i => QUALITY.includes(i.code)), []);
  // Still strict: the stale 2026/05〜07 figure is blocked even in a well-written article.
  const stale = wellWritten(); stale.sections[1].blocks[1].items[0] = '1コース：52.2%';
  assert.ok(validateAiDocument({ document: composeDocument({ ai: stale, pack, topic: kiryuTopic, catalogue }).document, pack }).some(i => i.level === 'blocking' && i.code === 'unsupported_number'));
});

test('duplicate detection: reworded sentences and facts repeated across sections', () => {
  assert.ok(similarity('桐生の水質は淡水で、干満差はなしです。', '桐生の水質は淡水で干満差は「なし」です') > 0.8);
  assert.ok(similarity('桐生の水質は淡水で、干満差はなしです。', 'スタート展示で進入コースを確認します。') < 0.3);
  const pack = freshPack(), ai = wellWritten();
  ai.sections[2].blocks.push(block('text', '桐生の水質は淡水で、干満差は「なし」とBOAT RACE公式データに記載されています。', ['S2']));
  const issues = qualityIssues({ document: composeDocument({ ai, pack, topic: kiryuTopic, catalogue }).document, pack });
  assert.match(issues.find(i => i.code === 'repeated_content').message, /ブロック3（TEXT）とブロック\d+（TEXT）/);
});

test('data explanation: course rates must be explained, never presented as 号艇 rates, and no causes are invented', () => {
  const pack = freshPack();
  const check = mutate => { const ai = wellWritten(); mutate(ai); return validateAiDocument({ document: composeDocument({ ai, pack, topic: kiryuTopic, catalogue }).document, pack }); };
  // Explanation removed from the text and from the dialogue (which also explained it: "進入したコースの成績").
  let issues = check(ai => { ai.sections[1].blocks[0].text = '2026年7月1日から9月30日の集計では、1コースが54.7%でした。'; ai.sections[1].blocks[2].turns[0].text = '数字を見るときは、集計期間も一緒に見ようね。'; });
  assert.ok(issues.some(i => i.code === 'unexplained_data' && i.level === 'warning'));
  issues = check(ai => { ai.sections[1].blocks[1].items[0] = '1号艇の1着率：54.7%'; });
  assert.deepEqual(issues.filter(i => i.level === 'blocking').map(i => i.code), ['course_frame_confusion']);
  issues = check(ai => { ai.sections[0].blocks[0].text += '淡水なので1コースが逃げやすい水面です。'; });
  assert.ok(issues.some(i => i.code === 'causal_claim' && /淡水なので/.test(i.message)));
});

test('characters: the guide suited to the theme, at most one partner, and dialogue that adds something', () => {
  const pack = freshPack();
  const ai = wellWritten();
  ai.sections[0].blocks.push({ type: 'dialogue', text: null, items: [], turns: [{ character: 'hatsune', pose: 'pose1', text: '淡水の水面なんですね。' }, { character: 'kiina', pose: 'pose3', text: '干満差がないの、意外かも？' }], source_ids: [] });
  const issues = qualityIssues({ document: composeDocument({ ai, pack, topic: kiryuTopic, catalogue }).document, pack });
  assert.match(issues.find(i => i.code === 'cast_mismatch').message, /案内役（一果）以外.*初音・キイナ/);
  assert.match(issues.find(i => i.code === 'too_many_dialogues').message, /2個、目安1個まで/);
  // Plans per theme: the lead plus at most one partner, never all three by default.
  const plan = (category_slug, angle, extra = {}) => articlePlan({ ...pack, topic: { ...pack.topic, category_slug, angle, ...extra } }).cast;
  assert.deepEqual(plan('stadium-basics', 'water'), ['ichika']);
  assert.deepEqual(plan('stadium-basics', 'course'), ['ichika', 'hatsune']);
  assert.deepEqual(plan('stadiums', 'inside'), ['ichika']);
  assert.deepEqual(plan('stadiums', 'outer'), ['ichika', 'kiina']);
  assert.deepEqual(plan('stadium-charm', 'gourmet'), ['hatsune']);
  assert.deepEqual(plan('characters', 'walk-kiina', { character_key: 'kiina' }), ['kiina']);
});

test('structure: the size of the article follows the information available, per category', () => {
  const pack = freshPack();
  const basics = articlePlan(pack);
  assert.deepEqual([basics.groups, basics.maxBodyBlocks, basics.sections, basics.maxDialogues], [4, 9, { min: 2, max: 3 }, 1]);
  const charm = articlePlan({ ...pack, facts: [], documents: [{ source_id: 'S1', excerpt: '売店' }], topic: { ...pack.topic, category_slug: 'stadium-charm', angle: 'gourmet' } });
  assert.deepEqual([charm.groups, charm.maxBodyBlocks, charm.sections], [1, 5, { min: 2, max: 2 }]);
  const lab = articlePlan(buildSourcePack({ topic: { topic_key: 'data-lab:all:inside-24', category_slug: 'data-lab', stadium_slug: null, angle: 'inside-24', title_hint: '24場の1コース1着率' }, now: () => new Date() }));
  assert.equal(lab.maxBodyBlocks, 14); assert.deepEqual(lab.sections, { min: 3, max: 5 });
});

test('prompt: plan, category structure, cast and data rules are given, and the PHASE 1–2 fact rules are kept', () => {
  const pack = freshPack();
  const basics = buildInstructions(pack);
  assert.match(basics, /sections：2〜3個。全セクションの本文ブロックの合計は9個まで/);
  assert.match(basics, /登場するのは一果だけです/); assert.ok(!/- 初音（/.test(basics) && !/- キイナ（/.test(basics));
  assert.match(basics, /枠番（号艇）別の数字ではありません/); assert.match(basics, /「判断材料」/);
  assert.match(basics, /使ってよい事実は、入力JSONの facts と documents/); assert.match(basics, /source_ids に必ず入れます/); assert.match(basics, /period（集計期間）/);
  const outer = buildInstructions({ ...pack, topic: { ...pack.topic, category_slug: 'stadiums', angle: 'outer' } });
  assert.match(outer, /登場するのは一果・キイナだけです/); assert.match(outer, /展開予想・買い目・選手評価は書きません/);
  const charm = buildInstructions({ ...pack, topic: { ...pack.topic, category_slug: 'stadium-charm', angle: 'gourmet', character_key: null } });
  assert.match(charm, /数値データや舟券の攻略は扱いません/); assert.match(charm, /案内役は初音/);
});

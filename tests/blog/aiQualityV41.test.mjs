import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { kiryuPageRow } from './_kiryuRegression.mjs';
import { v3Topic, v3Document } from './_kiryuV3.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { composeDocument, sourceLine } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { qualityIssues } from '../../lib/blog/ai/quality.mjs';
import { courseReadings, comparisonMismatches } from '../../lib/blog/ai/dataReadings.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildInstructions, buildInput } from '../../lib/blog/ai/prompt.mjs';

const QUALITY = ['repeated_content', 'repeated_fact', 'stock_phrase', 'too_long_for_facts', 'dialogue_restates', 'cast_mismatch', 'too_many_dialogues', 'unexplained_data', 'causal_claim',
  'course_frame_confusion', 'repeated_caveat', 'summary_restates', 'empty_data_check', 'dialogue_missing', 'numbers_without_reading', 'comparison_mismatch'];
// The pack as stored with the v3 draft (built before PHASE 4.3): the repository copy (S1) still supplied the race time
// slot to course-rate articles. Rebuilt here from the current code plus that copy, so ids and facts are as stored.
const pack = () => {
  const now = () => new Date('2026-10-09T20:21:00Z');
  const p = buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now });
  const water = buildSourcePack({ topic: { ...v3Topic, angle: 'water' }, documents: [kiryuPageRow], now });
  return { ...p, sources: [water.sources[0], ...p.sources], facts: [{ ...water.facts[0], id: 'F0' }, ...p.facts] };
};
const codes = issues => [...new Set(issues.map(i => i.code))].sort();
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });

// The course theme written as PHASE 4.1 intends: readings instead of a bare list, one caveat, a DATA CHECK with
// items, a reader's question answered by 一果, and a summary that points to the next step.
const improved = () => ({
  title: '桐生のコース別1着率を読む：1コースは半分を超える54.7%',
  excerpt: '桐生のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。数字が何を示すのか、どのコースが高いのかを初心者向けに整理します。',
  seo_title: '桐生のコース別1着率を読む', seo_description: '桐生のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。数字が示すものと、どのコースが高いのかを初心者向けに整理します。',
  takeaways: ['コース別1着率が示すもの', '2026年7月1日から9月30日の集計で目立つ特徴'],
  sections: [
    { heading: 'コース別1着率は進入コースごとの1着の割合', blocks: [t('text', 'コース別1着率は、そのコースから進入した艇が1着になった割合です。枠番（号艇）ではなく、実際に進入したコースで集計されています。', ['S2'])] },
    { heading: '1コースが54.7%で最も高い', blocks: [
      t('text', '2026年7月1日から9月30日の集計では、1コースの1着率が54.7%と6つのコースの中で最も高く、半分を超えています。2コース（13.2%）と3コース（13.4%）はほぼ同じ水準で、わずかに3コースが高くなっています。最も低いのは6コースの3.0%です。', ['S2']),
      { type: 'list', text: null, items: ['1コース：54.7%', '2コース：13.2%', '3コース：13.4%', '4コース：9.4%', '5コース：6.8%', '6コース：3.0%'], turns: [], source_ids: ['S2'] },
      { type: 'dialogue', text: null, items: [], source_ids: [], turns: [
        { character: 'hatsune', pose: 'pose3', text: '1コース以外の数字は、どう読めばいいんですか？' },
        { character: 'ichika', pose: 'pose1', text: '2コースと3コースはほぼ並んでいるから、どちらか一方だけが抜けているわけじゃないんだ。まずは1コースに入る選手を出走表で見て、そこから外の艇を比べると読みやすいよ。' }] },
    ] },
    { heading: '当日に確認したいこと', blocks: [
      t('data_check', '・出走表の枠番\n・スタート展示での進入コース'),
      t('warning', 'コース別1着率は過去の集計で、これからのレース結果を示すものではありません。'),
    ] },
  ],
  summary: '次は、気になるレースの出走表とスタート展示で、どの艇が1コースに入るかを確かめてみてください。',
  needs_check: [],
});

test('regression (Kiryu v3 draft 2026-10-10): caveats, the empty DATA CHECK, the missing dialogue and the bare list are reported', () => {
  const issues = validateAiDocument({ document: v3Document, pack: pack() });
  assert.equal(blockingCount(issues), 0, 'as on staging: no source problem');
  assert.deepEqual(codes(issues.filter(i => QUALITY.includes(i.code))), ['dialogue_missing', 'empty_data_check', 'numbers_without_reading', 'repeated_caveat', 'stock_phrase']);
  const caveats = issues.filter(i => i.code === 'repeated_caveat').map(i => i.message);
  assert.match(caveats[0], /過去の数字だけで判断しない）が4か所/); assert.match(caveats[1], /当日の出走表・進入を確認する）が4か所/);
  assert.match(issues.find(i => i.code === 'empty_data_check').message, /^ブロック9（DATA_CHECK）/);
  assert.ok(!issues.some(i => i.code === 'causal_claim'), 'the disclaimer "…断定することはできません" is not a causal claim');
});

test('regression (Kiryu v3 theme): written as PHASE 4.1 intends, it passes every check with no quality notes', () => {
  const p = pack();
  const { document } = composeDocument({ ai: improved(), pack: p, topic: v3Topic, catalogue });
  const issues = validateAiDocument({ document, pack: p });
  assert.equal(blockingCount(issues), 0, JSON.stringify(issues.filter(i => i.level === 'blocking')));
  assert.deepEqual(issues.filter(i => QUALITY.includes(i.code)), []);
});

test('readings: what the official rates show, computed without new numbers', () => {
  const p = pack();
  // The PHASE 4.1 readings stay; PHASE 4.2 adds the best of the rest and the order (aiQualityV42.test.mjs).
  const texts = p.readings.map(r => r.text);
  for (const text of ['1コースの1着率（54.7%）が6つのコースの中で最も高い', '1コースの1着率（54.7%）は半分を超えている', '6コースの1着率（3.0%）が最も低い',
    '2コース（13.2%）と3コース（13.4%）の1着率はほぼ同じ水準（わずかに3コースが高い）']) assert.ok(texts.includes(text), text);
  assert.ok(p.readings.every(r => r.source_id === 'S2' && r.period === '2026/07/01〜2026/09/30'));
  assert.deepEqual(JSON.parse(buildInput(p)).readings.length, p.readings.length);
  assert.deepEqual(courseReadings(p.facts.filter(f => !/6コース/.test(f.label))), [], 'no readings from an incomplete table');
  assert.deepEqual(JSON.parse(buildInput({ ...p, readings: undefined })).readings, [], 'older packs without readings still work');
});

test('comparisons: wrong ones block approval only when course and direction are certain', () => {
  const facts = pack().facts;
  assert.deepEqual(comparisonMismatches('1コースの1着率が最も高い。3コースは2コースより1着率が高い。6コースが最も低い1着率です。', facts), []);
  assert.equal(comparisonMismatches('2コースの1着率が最も高い。', facts).length, 1);
  assert.equal(comparisonMismatches('2コースは3コースより1着率が高い。', facts).length, 1);
  assert.equal(comparisonMismatches('5コースの1着率は4コースを上回る6.8%です。', facts).length, 1);
  assert.deepEqual(comparisonMismatches('2コースが最も速いスタートです。', facts), [], 'not about the 1着率');
  assert.deepEqual(comparisonMismatches('5コースが最も低い1着率とは限りません。', facts), [], 'negated');
  const twoPeriods = [...facts, ...facts.filter(f => f.period).map(f => ({ ...f, period: '2026/03/01〜2026/05/31', value: '50.0' }))];
  assert.deepEqual(comparisonMismatches('2コースの1着率が最も高い。', twoPeriods), [], 'with several periods the table is not certain');
  const p = pack(), ai = improved();
  ai.sections[1].blocks[0].text = ai.sections[1].blocks[0].text.replace('わずかに3コースが高くなっています', '2コースは3コースより1着率が高くなっています');
  const issues = validateAiDocument({ document: composeDocument({ ai, pack: p, topic: v3Topic, catalogue }).document, pack: p });
  assert.deepEqual(issues.filter(i => i.level === 'blocking').map(i => i.code), ['comparison_mismatch']);
  assert.match(issues.find(i => i.code === 'comparison_mismatch').message, /2コース13\.2%、3コース13\.4%/);
});

test('sources section: name, collection period and retrieval time for readers; ids and checks unchanged', () => {
  const p = pack();
  assert.equal(p.sources[1].label, 'BOAT RACE公式 ボートレース場データ（桐生）');
  assert.equal(p.sources[1].page_title, 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト');
  const lines = composeDocument({ ai: improved(), pack: p, topic: v3Topic, catalogue }).document.blocks.filter(b => b.data.placement === 'sources').map(b => b.data.text);
  assert.deepEqual(lines, ['BoatStrikers収録データ（桐生の基本情報：レース時間帯）｜取得日時 記録なし', 'BOAT RACE公式 ボートレース場データ（桐生）｜集計期間 2026/07/01〜2026/09/30｜取得日時 2026/10/10 05:20']);
  assert.equal(sourceLine({ label: '施設案内', fetched_at: '2026-10-09T01:30:00Z' }), '施設案内｜取得日時 2026/10/09 10:30', 'manual sources keep their format');
});

test('dialogue: used when the article has room for it, never forced into a short one', () => {
  const p = pack();
  const charm = { ...p, facts: [], readings: [], documents: [{ source_id: 'S1', excerpt: '売店' }], topic: { ...p.topic, category_slug: 'stadium-charm', angle: 'gourmet', character_key: null } };
  assert.equal(articlePlan(charm).maxDialogues, 0);
  assert.match(buildInstructions(charm), /この記事は短いので、dialogue は使いません/);
  const course = buildInstructions(p);
  assert.match(course, /登場するのは一果・初音だけです/); assert.match(course, /2発言目で一果が「データからどう読むか」を答えます/); assert.match(course, /readings/);
  // A short data article without a dialogue is not asked to add one.
  const short = improved(); short.sections = short.sections.slice(0, 2); short.sections[1].blocks = short.sections[1].blocks.slice(0, 2);
  assert.ok(!qualityIssues({ document: composeDocument({ ai: short, pack: p, topic: v3Topic, catalogue }).document, pack: p }).some(i => i.code === 'dialogue_missing'));
});

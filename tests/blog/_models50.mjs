// PHASE 5.0 model articles: what blog-ai-v12 asks for, written by hand against source packs version 5. Each is built
// around the plan's discoveries (a reading with its lesson), states no figure the facts do not have (no computed gap such
// as "0.7ポイント"), and keeps every lesson to the period counted.
//
// Where each pack's figures come from (DATA_ORIGIN below):
// - official: figures read from a BOAT RACE official page the system actually fetched, kept as a fixture —
//   Toda (staging v11 draft's pack, fetched 2026-10-12, fixtures/toda-v11-staging-20261012.json), Tokoname (staging v6
//   draft's pack, fetched 2026-10-10) and Kiryu (fixtures/kiryu-stadium-data-20261010.txt, built here by
//   buildSourcePack from the stored page row). Only the pack version and the readings (version 5) are new.
// - synthetic: made-up figures for checking the logic on a shape the official fixtures lack (a reversal with a close
//   pair). Hamanako and Tamagawa are synthetic: their figures match neither a fetched page nor the repository dataset,
//   and their source is marked as such. A model article on them checks the code, not the data.
import { todaV11Pack } from './_todaV11.mjs';
import { v6Pack } from './_tokonameV6.mjs';
import { kiryuTopic, kiryuPageRow } from './_kiryuRegression.mjs';
import { courseReadings } from '../../lib/blog/ai/dataReadings.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { DATA_CHECK_PURPOSES, RATE_WARNING, dataCheckLine } from '../../lib/blog/ai/glossary.mjs';

export const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const talk = turns => ({ type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns });
const checks = () => [t('data_check', DATA_CHECK_PURPOSES.map(dataCheckLine).join('\n')), t('warning', RATE_WARNING)];
const PERIOD = '2026/07/01〜2026/09/30';

// A pack as buildSourcePack makes it from version 5 on (extended readings), from an older one.
export const asV5 = (base, { facts, topic, stadium, sources, documents } = {}) => {
  const pack = { ...structuredClone(base), version: 5, comparison: undefined };
  if (facts) pack.facts = facts;
  if (topic) pack.topic = { ...pack.topic, ...topic };
  if (stadium) pack.stadium = { ...pack.stadium, ...stadium };
  if (sources) pack.sources = sources;
  if (documents) pack.documents = documents;
  pack.readings = courseReadings(pack.facts, { extended: true });
  return pack;
};
// Six course rates plus 水質・干満差 for a stadium, cited to S2. Used for synthetic packs only.
export const stadiumFacts = (name, values) => [...values.map((value, i) => ({ id: `F${i + 1}`, unit: '%', label: `${name}の${i + 1}コース1着率`, value, period: PERIOD, source_id: 'S2' })),
  { id: 'F7', unit: '', label: `${name}の水質`, value: '淡水', source_id: 'S2' }, { id: 'F8', unit: '', label: `${name}の干満差`, value: 'なし', source_id: 'S2' }];
// A synthetic pack: made-up figures under a source that says so (never an official URL or page text).
const synthetic = (slug, name, courseCode, values) => {
  const label = `検証用の合成データ（${name}）`;
  return { ...asV5(todaV11Pack, { facts: stadiumFacts(name, values),
    topic: { topic_key: `stadium-basics:${slug}:course`, title_hint: `${name}のコース別1着率を確認する`, stadium_slug: slug }, stadium: { name, slug, course_code: courseCode },
    sources: [{ id: 'S2', url: `https://example.invalid/synthetic/${slug}`, kind: 'official_data', label, page_title: label, fetched_at: '2026-10-15T00:00:00.000+00:00', tables: [{ label: '最近3ヶ月', period: PERIOD }] }],
    documents: [{ source_id: 'S2', title: label, excerpt: `${label}\n水質\n淡水\n干満差\nなし` }] }), official: { period: PERIOD, status: 'synthetic', skipped: [], source_id: 'S2' }, synthetic: true };
};

export const todaTopic = { id: 'topic-toda', topic_key: 'stadium-basics:toda:course', category_slug: 'stadium-basics', stadium_slug: 'toda', angle: 'course', title_hint: '戸田のコース別1着率を確認する', character_key: 'ichika', status: 'candidate' };
export const tokonameTopic = { id: 'topic-tokoname', topic_key: 'stadium-basics:tokoname:course', category_slug: 'stadium-basics', stadium_slug: 'tokoname', angle: 'course', title_hint: '常滑のコース別1着率を確認する', character_key: 'ichika', status: 'candidate' };
export const hamanakoTopic = { id: 'topic-hamanako', topic_key: 'stadium-basics:hamanako:course', category_slug: 'stadium-basics', stadium_slug: 'hamanako', angle: 'course', title_hint: '浜名湖のコース別1着率を確認する', character_key: 'ichika', status: 'candidate' };

// Official figures.
export const todaV5Pack = asV5(todaV11Pack);
export const tokonameV5Pack = asV5(v6Pack);
export const kiryuCourseTopic = { ...kiryuTopic, id: 'topic-kiryu-course', topic_key: 'stadium-basics:kiryu:course', angle: 'course', title_hint: '桐生のコース別1着率を確認する', character_key: 'ichika' };
export const kiryuV5Pack = buildSourcePack({ topic: kiryuCourseTopic, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') });
// Synthetic figures.
export const hamanakoV5Pack = synthetic('hamanako', '浜名湖', 6, ['54.4', '12.8', '13.5', '11.6', '6.7', '2.1']);
export const tamagawaV5Pack = synthetic('tamagawa', '多摩川', 5, ['54.7', '11.9', '13.7', '10.9', '6.3', '2.8']);
export const DATA_ORIGIN = { toda: 'official', tokoname: 'official', kiryu: 'official', hamanako: 'synthetic', tamagawa: 'synthetic' };

// Toda: 1コース is the highest yet below half (初音 asks, 一果 gives the lesson); the rates fall course by course
// outwards, 3コース and 4コース close together. No "0.7ポイント", no "42.8%！".
export const todaV5Model = () => ({
  title: '戸田の1コースは一番高いのに半分未満？コース別1着率を読む',
  excerpt: '戸田のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの数字の読み方と、6つのコースの並び方を初心者向けに整理します。',
  seo_title: '戸田のコース別1着率を読む', seo_description: '戸田のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの数字の読み方と、6つのコースの並び方を初心者向けに整理します。',
  takeaways: ['1コースの1着率の読み方', '6つのコースの並び方', '当日に確かめる項目とその理由'],
  lead: '戸田は淡水で、干満差はない水面です。6つのコースの1着率は、どんな順番で並んでいるでしょうか。',
  sections: [
    { heading: '戸田のコース別1着率は、進入したコースで数える', blocks: [
      t('text', '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。', ['S2']),
      t('rate_table', null),
    ] },
    { heading: '1コースの数字は、どう読む？', blocks: [
      talk([
        { character: 'hatsune', pose: 'pose3', text: '1コースの1着率は42.8%で、6つのコースの中で最も高いのに、半分には届いていないんですね。これはどう読めばいいんですか？' },
        { character: 'ichika', pose: 'pose1', text: 'この期間では、6つのコースの中で最も高いことと、半分以上のレースで1着になったことは別なんだよ。順位と割合を分けて読もう。' }]),
    ] },
    { heading: '外側のコースほど1着率が低い期間', blocks: [
      t('text', '2026年7月1日から9月30日の集計では、1着率は外側のコースほど順に低く、1コースから6コースまで順番の入れ替わりがありません。3コース（14.9%）と4コース（14.2%）は、順位は違いますが差は小さく、順位だけで差の大きさは判断できません。', ['S2']),
    ] },
    { heading: '当日に確かめること', blocks: checks() },
  ],
  summary: 'この期間の戸田は、1コースが最も高くても半分には届かない期間でした。また、外側のコースほど1着率が順に低いことも、この期間の集計結果として表から読めます。',
  needs_check: [],
});

// Tokoname: 1コース above half; 4コース above 3コース (キイナ finds it, 一果 gives the lesson), 2コース the best of the rest.
export const tokonameV5Model = () => ({
  title: '常滑のコース別1着率｜1コースは半分を超え、4コースが3コースを上回る',
  excerpt: '常滑のコース別1着率を、BOAT RACE公式データの集計期間で確認します。1コースの数字と、内側から順に並ばないところを初心者向けに整理します。',
  seo_title: '常滑のコース別1着率を読む', seo_description: '常滑のコース別1着率を、BOAT RACE公式データの集計期間で確認。1コースの数字と、内側から順に並ばないところを初心者向けに整理します。',
  takeaways: ['1コースの1着率の読み方', '内側から順に並ばないところ', '当日に確かめる項目とその理由'],
  lead: '常滑は海水の水面です。6つのコースの1着率は、内側から順に並んでいるでしょうか。',
  sections: [
    { heading: '常滑のコース別1着率は、進入したコースで数える', blocks: [
      t('text', '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。', ['S2']),
      t('rate_table', null),
    ] },
    { heading: '1コースは61.2%で、半分を超えた', blocks: [
      t('text', 'この集計期間では、1コースの1着率は61.2%で、1コースから進入した艇が半分を超えるレースで1着になりました。', ['S2']),
    ] },
    { heading: '4コースと3コースの数字を比べる', blocks: [
      talk([
        { character: 'kiina', pose: 'pose2', text: '見て、4コースの10.0%が、内側の3コースの8.5%より高いよ！' },
        { character: 'ichika', pose: 'pose1', text: 'この期間では、内側のコースほど1着率が高いとは限らないんだ。どれくらいの差かは、表の数字で確かめよう。' }]),
      t('text', '1コース以外では、2コースの1着率（14.4%）が最も高くなっています。', ['S2']),
    ] },
    { heading: '当日に確かめること', blocks: checks() },
  ],
  summary: '常滑のこの期間は、1コースの1着率が半分を超えた表でした。また、4コースが3コースを上回るところがあり、内側のコースほど高いとは限らないことも読み取れます。',
  needs_check: [],
});

// Hamanako: 1コース above half; 3コース above 2コース, yet only a little (the close reading's lesson in the dialogue).
export const hamanakoV5Model = () => ({
  title: '浜名湖のコース別1着率｜3コースが2コースを上回る期間',
  excerpt: '浜名湖のコース別1着率を、BOAT RACE公式データの集計期間で確認します。1コースの数字と、2コース・3コースの並びを初心者向けに整理します。',
  seo_title: '浜名湖のコース別1着率を読む', seo_description: '浜名湖のコース別1着率を、BOAT RACE公式データの集計期間で確認。1コースの数字と、2コース・3コースの並びを初心者向けに整理します。',
  takeaways: ['1コースの1着率の読み方', '2コースと3コースの並び', '当日に確かめる項目とその理由'],
  lead: '浜名湖は淡水で、干満差はない水面です。6つのコースの1着率は、内側から順に並んでいるでしょうか。',
  sections: [
    { heading: '浜名湖のコース別1着率は、進入したコースで数える', blocks: [
      t('text', '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。', ['S2']),
      t('rate_table', null),
    ] },
    { heading: '1コースは54.4%で、半分を超えた', blocks: [
      t('text', 'この集計期間では、1コースの1着率は54.4%で、1コースから進入した艇が半分を超えるレースで1着になりました。', ['S2']),
    ] },
    { heading: '2コースと3コースの数字を比べる', blocks: [
      talk([
        { character: 'kiina', pose: 'pose2', text: '3コースの13.5%が、内側の2コースの12.8%より高いよ！' },
        { character: 'ichika', pose: 'pose1', text: 'この期間の1着率は、内側のコースほど高いとは限らないね。ただ、2コースと3コースは順位は違っても差は小さいから、順位だけで差の大きさを判断しないでおこう。' }]),
    ] },
    { heading: '当日に確かめること', blocks: checks() },
  ],
  summary: '浜名湖のこの期間は、1コースの1着率が半分を超えた表でした。また、3コースが2コースを上回るところがあり、内側のコースほど高いとは限らないことも読み取れます。',
  needs_check: [],
});

// The Tokoname pack under the other two themes: 初音 leading the water theme (no discoveries; 一果 still answers with
// the lesson), and キイナ leading the outer-course theme (she brings the exception, 一果 gives its lesson).
export const tokonameWaterV5Pack = asV5(v6Pack, { topic: { category_slug: 'stadium-basics', angle: 'water-hatsune', character_key: 'hatsune', topic_key: 'stadium-basics:tokoname:water-hatsune' } });
export const tokonameOuterV5Pack = asV5(v6Pack, { topic: { category_slug: 'stadiums', angle: 'outer-kiina', character_key: 'kiina', topic_key: 'stadiums:tokoname:outer-kiina' } });
const EXPL = '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。';

export const hatsuneWaterV5Model = () => ({
  title: '初音と見る常滑の水面と干満差', excerpt: '常滑の水質・干満差と、2026年7月1日から9月30日のコース別1着率を、初心者の疑問から整理します。BOAT RACE公式データをもとに、表の読み方を紹介します。',
  seo_title: '初音と見る常滑の水面と干満差', seo_description: '常滑の水質・干満差と、2026年7月1日から9月30日のコース別1着率を、初心者の疑問から整理します。BOAT RACE公式データをもとに、表の読み方を紹介します。',
  takeaways: ['常滑の水質と干満差', 'コース別1着率の表の読み方', '当日に確かめる項目とその理由'],
  lead: '常滑の水面の基本を確かめたあと、コース別1着率の表も見てみます。6つのコースの数字は、内側から順に並んでいるでしょうか。',
  sections: [
    { heading: '常滑は海水で、干満差はなし', blocks: [t('text', '常滑の水質は海水で、干満差は「なし」です。', ['S2'])] },
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', `${EXPL}2026年7月1日から9月30日の集計では、1コースの1着率は61.2%で、1コースから進入した艇が半分を超えるレースで1着になりました。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。`, ['S2']),
      t('rate_table', null),
      talk([
        { character: 'hatsune', pose: 'pose3', text: '4コースの1着率が10.0%で、内側の3コースの8.5%より高いんですね。これはどう読めばいいんですか？' },
        { character: 'ichika', pose: 'pose1', text: 'この期間の1着率は、内側のコースほど高いとは限らない、という読み方だよ。どれくらいの差かは、表の数字で確かめよう。' }]),
    ] },
    { heading: '当日に確かめること', blocks: checks() },
  ],
  summary: '海水で干満差のない常滑は、この期間、1コースの1着率が半分を超えた表でした。また、4コースが3コースを上回るところもありました。',
  needs_check: [],
});

export const kiinaOuterV5Model = () => ({
  title: 'キイナと見る常滑の外コース｜4コースが3コースを上回る期間', excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの数字と、外の4コースに見られる例外を初心者向けに整理します。',
  seo_title: 'キイナと見る常滑の外コース', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの数字と、外の4コースに見られる例外を初心者向けに整理します。',
  takeaways: ['1コースの1着率の読み方', '外のコースで目立つところ', '当日に確かめる項目とその理由'],
  lead: '常滑は海水で、干満差はない水面です。コース別1着率の表には、外のコースに意外なところがあります。どこでしょうか。',
  sections: [
    { heading: '常滑のコース別1着率は、進入したコースで数える', blocks: [t('text', EXPL, ['S2']), t('rate_table', null)] },
    { heading: '1コースは61.2%で、半分を超えた', blocks: [
      t('text', '2026年7月1日から9月30日の集計では、1コースの1着率は61.2%で、1コースから進入した艇が半分を超えるレースで1着になりました。', ['S2']),
    ] },
    { heading: '外の4コースに注目', blocks: [
      talk([
        { character: 'kiina', pose: 'pose3', text: 'ねえ、4コースの1着率10.0%が、内側の3コースの8.5%より上だよ。ちょっと意外じゃない？' },
        { character: 'ichika', pose: 'pose1', text: 'いい発見だね。この期間の1着率は、内側のコースほど高いとは限らないんだ。どれくらいの差かは、表の数字で確かめよう。' }]),
      t('text', '1コース以外では、2コースの1着率（14.4%）が最も高くなっています。', ['S2']),
    ] },
    { heading: '当日に確かめること', blocks: checks() },
  ],
  summary: '常滑のこの期間は、1コースの1着率が半分を超えた表でした。また、外の4コースが3コースを上回るところがあり、内側のコースほど高いとは限らないことも読み取れます。',
  needs_check: [],
});

// Kiryu (official figures, page fetched 2026-10-10): 1コース above half; 2コース and 3コース nearly level (初音 asks
// whether the outer one is "higher", 一果 gives the near lesson); 3コース the best of the rest.
export const kiryuV5Model = () => ({
  title: '桐生のコース別1着率｜1コースは54.7%で半分を超える',
  excerpt: '桐生のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの数字と、2コース・3コースの数字の読み方を初心者向けに整理します。',
  seo_title: '桐生のコース別1着率を読む', seo_description: '桐生のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの数字と、2コース・3コースの数字の読み方を初心者向けに整理します。',
  takeaways: ['1コースの1着率の読み方', '2コースと3コースの数字の読み方', '当日に確かめる項目とその理由'],
  lead: '桐生は淡水で、干満差はない水面です。2コースと3コースの数字は、どちらが高いでしょうか。',
  sections: [
    { heading: '桐生のコース別1着率は、進入したコースで数える', blocks: [
      t('text', '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。', ['S2']),
      t('rate_table', null),
    ] },
    { heading: '1コースは54.7%で、半分を超えた', blocks: [
      t('text', '2026年7月1日から9月30日の集計では、1コースの1着率は54.7%で、1コースから進入した艇が半分を超えるレースで1着になりました。1コース以外では、3コースの1着率（13.4%）が最も高くなっています。', ['S2']),
    ] },
    { heading: '2コースと3コースの数字をどう読む？', blocks: [
      talk([
        { character: 'hatsune', pose: 'pose3', text: '2コースが13.2%、3コースが13.4%ですね。外側のほうが上、と読めばいいんですか？' },
        { character: 'ichika', pose: 'pose1', text: 'この期間の2コースと3コースの1着率は、ほぼ同じ水準なんだ。同じ数字ではないけれど、順位だけで差の大きさを判断しないでおこう。' }]),
    ] },
    { heading: '当日に確かめること', blocks: checks() },
  ],
  summary: '桐生のこの期間は、1コースの1着率が半分を超えた表でした。また、2コースと3コースはほぼ並び、順位だけでは差の大きさが分からないことも読み取れます。',
  needs_check: [],
});

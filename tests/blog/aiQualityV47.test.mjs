import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { v4Topic, v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { v6Pack, v6Document } from './_tokonameV6.mjs';
import { v7Pack, v7Document } from './_tokonameV7.mjs';
import { v8Pack, v8Document } from './_tokonameV8.mjs';
import { v9Pack, v9Document } from './_tokonameV9.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument } from '../../lib/blog/ai/validate.mjs';
import { qualityIssues, withoutPeriod } from '../../lib/blog/ai/quality.mjs';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { candidateTopics, angleBase } from '../../lib/blog/ai/topics.mjs';
import { DATA_CHECK_PURPOSES, RATE_WARNING, dataCheckLine } from '../../lib/blog/ai/glossary.mjs';

const warnings = issues => [...new Set(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited').map(i => i.code))].sort();
const check = (document, pack) => validateAiDocument({ document, pack });
const scores = (document, pack) => scorecard({ document, pack, issues: check(document, pack) });
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const turn = (character, text, pose = 'pose1') => ({ character, pose, text });
const DC = () => t('data_check', DATA_CHECK_PURPOSES.map(dataCheckLine).join('\n'));
const W = () => t('warning', RATE_WARNING);
// The Tokoname pack (official page fetched 2026-10-10, version 4) under another theme and lead.
const packFor = (category_slug, angle, character_key) => ({ ...structuredClone(v6Pack), version: 4, comparison: undefined,
  topic: { ...v6Pack.topic, category_slug, angle, character_key, topic_key: `${category_slug}:tokoname:${angle}` } });
const compose = (ai, pack) => composeDocument({ ai, pack, topic: { ...v4Topic, ...pack.topic }, catalogue }).document;
// A stadium's pack from the repository dataset (lib/stadiumBasicGuide24.js): the official pages of Toda, Tamagawa and
// Hamanako could not be fetched for this test (the session's network policy refused www.boatrace.jp), so the plans
// below rest on the copy in the repository. On the day, the fetched page decides the readings.
const repositoryPack = (stadiumSlug, categorySlug, angle) => {
  const topic = candidateTopics({ categorySlug, stadiumSlug }).find(x => x.angle === angle);
  return buildSourcePack({ topic, documents: [], now: () => new Date('2026-10-12T00:00:00Z') });
};
const EXPL = '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。';

test('regression (Tokoname v9 draft 2026-10-12): a shared 集計期間 is no longer a repeated sentence', () => {
  const issues = check(v9Document, v9Pack);
  assert.deepEqual(issues.filter(i => i.level === 'blocking').map(i => i.code), ['comparison_draft']);
  assert.deepEqual(warnings(issues), []);
  const sc = scorecard({ document: v9Document, pack: v9Pack, issues });
  assert.deepEqual(sc.axes.map(a => a.score), [5, 5, 5, 5, 5, 5, 5]);
  assert.equal(sc.average, 5); assert.equal(sc.average_all, 5);
});

test('regression: the v4〜v8 findings and scores do not move', () => {
  const table = [[v4Document, v4Pack, [5, 4, 1, 3, 4, 2, null], 3.2], [v5Document, v5Pack, [5, 5, 3, 5, 4, 4, null], 4.3], [v6Document, v6Pack, [5, 5, 5, 5, 4, 5, null], 4.8],
    [v7Document, v7Pack, [5, 5, 2, 5, 4, 5, 5], 4.3], [v8Document, v8Pack, [5, 5, 2, 5, 5, 5, 5], 4.5]];
  for (const [document, pack, expected, average] of table) {
    const sc = scores(document, pack);
    assert.deepEqual(sc.axes.map(a => a.score), expected); assert.equal(sc.average, average);
  }
});

test('repeated sentences: the period is set aside before comparing, real repeats are still found', () => {
  assert.equal(withoutPeriod('今回の集計期間は2026/07/01〜2026/09/30です'), '今回の集計期間は期間です');
  assert.equal(withoutPeriod('2026年7月1日から9月30日の集計では'), '期間の集計では');
  const pack = packFor('stadium-basics', 'course', 'ichika');
  const with2 = (a, b) => qualityIssues({ pack, document: { ...v9Document, blocks: [
    { id: 'a', type: 'TEXT', data: { text: a, source_ids: ['S2'] } }, { id: 'b', type: 'TEXT', data: { text: b, source_ids: ['S2'] } }] } }).some(i => i.code === 'repeated_content');
  // Only the period in common (the v9 pair): not a repeat.
  assert.equal(with2('今回の集計期間は2026/07/01〜2026/09/30です。', '2026/07/01〜2026/09/30の集計では、1コースの1着率は半分を超えています。'), false);
  // The same sentence, whatever way the period is written: a repeat.
  assert.equal(with2('2026/07/01〜2026/09/30の集計では、1コースの1着率は半分を超えています。', '2026年7月1日から9月30日の集計では、1コースの1着率は半分を超えています。'), true);
  // A light rewording of the same explanation: still a repeat.
  assert.equal(with2('コース別1着率は、そのコースから進入した艇が1着になった割合です。', 'コース別1着率とは、そのコースから進入した艇が1着になった割合のことです。'), true);
});

test('prompt blog-ai-v10: periods with their numbers, no period-only sentence, basics placed by theme', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v11', 'PHASE 4.9 keeps the blog-ai-v10 rules checked here');
  const course = buildInstructions(packFor('stadium-basics', 'course', 'ichika'));
  assert.match(course, /「今回の集計期間は〜です」のような期間だけの文は書かず、期間は数値の文に添えます/);
  assert.match(course, /その期間の数値を最初に書く文に期間を添えます.*期間の違う数値を同じ文で混ぜません/);
  // The course theme: basics in the lead, no basics section; the water theme keeps its basics section.
  assert.match(course, /セクションの役割を分けます：①コース別1着率（定義・表・特徴）②読者が当日に確認すること/);
  assert.doesNotMatch(course, /①場の基本情報/);
  assert.match(course, /facts の基本情報（水質・干満差など）は1文にまとめて導入に入れ/);
  const water = buildInstructions(packFor('stadium-basics', 'water-hatsune', 'hatsune'));
  assert.match(water, /①場の基本情報（水質・干満差・時間帯）/);
  assert.doesNotMatch(water, /1文にまとめて導入に入れ/);
});

test('stadium plans: Toda, Tamagawa and Hamanako (repository data) get the right cast, focus and framing', () => {
  const toda = articlePlan(repositoryPack('toda', 'stadium-basics', 'course'));
  // Toda's 1コース is below half: the title takes that (PHASE 4.9); no reversal, so 初音 asks a beginner's question
  // about the reading the lead hints at.
  assert.deepEqual([toda.cast, toda.explainer, toda.speaker, toda.dialogueFocus.kind, toda.dialogueFocus.key, toda.framing.title.key], [['ichika', 'hatsune'], 'ichika', 'hatsune', 'question', 'except:3:高', 'under_half:1']);
  const tamagawa = articlePlan(repositoryPack('tamagawa', 'stadium-basics', 'course'));
  // Tamagawa (repository data) falls from 1コース to 6コース in order: that is the hook and 初音's question (PHASE 4.9).
  assert.deepEqual([tamagawa.cast, tamagawa.dialogueFocus.kind, tamagawa.dialogueFocus.key, tamagawa.framing.title.key, tamagawa.framing.hook.key, tamagawa.framing.basicsInLead], [['ichika', 'hatsune'], 'question', 'sequence:in', 'half:1', 'sequence:in', true]);
  // Hamanako: 3コース above 2コース, so キイナ joins and brings it up as a find.
  const hamanako = articlePlan(repositoryPack('hamanako', 'stadium-basics', 'course'));
  assert.deepEqual([hamanako.cast, hamanako.speaker, hamanako.dialogueFocus.key, hamanako.placements['pair:3>2']], [['ichika', 'kiina'], 'kiina', 'pair:3>2', 'dialogue']);
  // Every plan of the three stadiums has two characters for a dialogue and 一果 explaining.
  for (const slug of ['toda', 'tamagawa', 'hamanako']) for (const [cat, angle] of [['stadium-basics', 'course'], ['stadium-basics', 'water-hatsune'], ['stadiums', 'outer-kiina']]) {
    const plan = articlePlan(repositoryPack(slug, cat, angle));
    assert.equal(plan.cast.length, 2, `${slug} ${angle}`); assert.equal(plan.explainer, 'ichika'); assert.equal(plan.maxDialogues, 1);
  }
});

test('leads: 初音 and キイナ can lead their themes; 一果 explains in the dialogue, each keeps their part', () => {
  assert.equal(angleBase('stadium-basics', 'water-hatsune'), 'water'); assert.equal(angleBase('stadiums', 'outer-kiina'), 'outer');
  assert.deepEqual(candidateTopics({ categorySlug: 'stadium-basics', stadiumSlug: 'hamanako' }).find(x => x.angle === 'water-hatsune'),
    { topic_key: 'stadium-basics:hamanako:water-hatsune', category_slug: 'stadium-basics', stadium_slug: 'hamanako', angle: 'water-hatsune', title_hint: '初音と見る浜名湖の水面と干満差', character_key: 'hatsune' });
  assert.equal(candidateTopics({ categorySlug: 'stadiums', stadiumSlug: 'hamanako' }).find(x => x.angle === 'outer-kiina').character_key, 'kiina');
  // The water theme led by 初音 keeps the race time slot (as the water theme does) and its basics section.
  const water = repositoryPack('hamanako', 'stadium-basics', 'water-hatsune');
  assert.ok(water.facts.some(f => /レース時間帯$/.test(f.label)));
  const hp = articlePlan(water);
  assert.deepEqual([hp.lead, hp.cast, hp.explainer, hp.speaker, hp.dialogueFocus.kind, hp.dialogueFocus.key, hp.framing.basicsInLead], ['hatsune', ['hatsune', 'ichika'], 'ichika', 'hatsune', 'question', 'pair:3>2', false]);
  const kp = articlePlan(repositoryPack('hamanako', 'stadiums', 'outer-kiina'));
  assert.deepEqual([kp.lead, kp.cast, kp.explainer, kp.speaker, kp.dialogueFocus.key], ['kiina', ['kiina', 'ichika'], 'ichika', 'kiina', 'pair:3>2']);
  // Without a reversal キイナ still opens with a find about the outer courses: none of them rises above an inner one.
  assert.equal(articlePlan(repositoryPack('tamagawa', 'stadiums', 'outer-kiina')).dialogueFocus.key, 'sequence:in');
  // The prompt names who opens and who explains, with their parts.
  const hi = buildInstructions(water);
  assert.match(hi, /主に案内するのは初音です（初音の個性：/);
  assert.match(hi, /1発言目は初音が役割どおりに話し（初音の役割：初心者が抱きそうな疑問を、読者の目線で質問する/);
  assert.match(hi, /2発言目で一果が「データからどう読むか」を答えます/);
  assert.match(hi, /初音が表を見て、readings の「3コースの1着率（13\.5%）は2コース（11\.9%）より高い」について初心者の疑問として質問し.*一果が、その数字が何を示すかを答えます/);
  assert.match(hi, /号艇とコースの違いは本文と data_check で説明しているので、会話では扱いません/);
  const ki = buildInstructions(repositoryPack('hamanako', 'stadiums', 'outer-kiina'));
  assert.match(ki, /主に案内するのはキイナです/);
  assert.match(ki, /1発言目はキイナが役割どおりに話し（キイナの役割：外コースや、内側から順に並ばない意外なデータに気づいて話題にする/);
  assert.match(ki, /キイナが表を見て「3コースの1着率（13\.5%）は2コース（11\.9%）より高い」に気づき.*一果は、この期間は内側から順に並ぶわけではない/);
  assert.match(ki, /展開予想・買い目・選手評価は書きません/);
});

// Model articles for the two new leads (Tokoname data), as blog-ai-v10 asks.
const hatsuneArticle = () => ({
  title: '初音と見る常滑の水面｜海水・干満差なしの水面と1着率の表', excerpt: '常滑の水質と干満差を確認し、2026年7月1日から9月30日のコース別1着率の表の読み方を、初心者の疑問から整理します。BOAT RACE公式データをもとにしています。',
  seo_title: '初音と見る常滑の水面と干満差', seo_description: '常滑の水質・干満差と、2026年7月1日から9月30日のコース別1着率を、初心者の疑問から整理します。BOAT RACE公式データをもとに、表の読み方を紹介します。',
  takeaways: ['常滑の水質と干満差', 'コース別1着率の表の読み方', '当日に確かめる項目とその理由'],
  lead: '常滑のコース別1着率の表には、内側から順に並んでいないところがあります。初めて表を見るとき、どこに目を向ければよいのでしょうか。水面の基本から順に確かめます。',
  sections: [
    { heading: '常滑は海水で、干満差はなし', blocks: [t('text', '常滑の水質は海水で、干満差は「なし」です。', ['S2'])] },
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', `${EXPL}2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。また、4コースの1着率（10.0%）は3コース（8.5%）より高く、内側から順には並んでいません。`, ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        turn('hatsune', '出走表で1号艇の選手は、この表の1コースの数字で見ればよいのでしょうか？', 'pose3'),
        turn('ichika', 'そこは分けて考えよう。この表はスタートで入った位置ごとの数字だから、まず出走表で各号艇の選手を見て、どこに入りそうかは下の確認項目のスタート展示で見てみよう。')] },
    ] },
    { heading: '当日に確かめること', blocks: [DC(), W()] },
  ],
  summary: 'この期間の常滑は、1コースが半分を超える一方で、外の4コースが3コースを上回る例外もありました。海水で干満差のない水面の表として、並び方の例外にも目を向けてみてください。',
  needs_check: [],
});
const kiinaArticle = () => ({
  title: 'キイナが気づいた常滑の外コース｜4コースが3コースより上？', excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの高さと、外の4コースに見られる例外を初心者向けに整理します。',
  seo_title: 'キイナが気づいた常滑の外コース', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの高さと、外の4コースに見られる例外を初心者向けに整理します。',
  takeaways: ['1コースの1着率の高さ', '外のコースで目立つところ', '当日に確かめる項目とその理由'],
  lead: '常滑は海水で、干満差はない水面です。コース別1着率の表には、外のコースに意外なところがあります。どこなのか、1コースの数字から見ていきましょう。',
  sections: [
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', `${EXPL}2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。`, ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        turn('kiina', 'ねえ、4コースの1着率10.0%が3コースの8.5%より上だよ。外の方が上って、ちょっと意外じゃない？', 'pose3'),
        turn('ichika', 'いい発見だね。理由は表だけでは分からないけど、並び方に例外がある期間だと覚えておこう。誰が4コースに入りそうかは、下の確認項目のスタート展示で見てみよう。')] },
    ] },
    { heading: '当日に確かめること', blocks: [DC(), W()] },
  ],
  summary: 'この期間の常滑は、1コースが半分を超える一方で、外の4コースが3コースを上回る例外もありました。高い順だけでなく、外のコースの並び方にも目を向けてみてください。',
  needs_check: [],
});

test('model articles led by 初音 and by キイナ: no quality note, every axis at 5', () => {
  for (const [ai, pack] of [[hatsuneArticle(), packFor('stadium-basics', 'water-hatsune', 'hatsune')], [kiinaArticle(), packFor('stadiums', 'outer-kiina', 'kiina')]]) {
    const document = compose(ai, pack), issues = check(document, pack);
    assert.deepEqual(issues.filter(i => i.level === 'blocking'), []);
    assert.deepEqual(warnings(issues), [], pack.topic.angle);
    assert.deepEqual(scorecard({ document, pack, issues }).axes.map(a => a.score), [5, 5, 5, 5, 5, 5, 5], pack.topic.angle);
    // The lead character is the article's author.
    assert.deepEqual(document.author_ids, [catalogue.authorIds[pack.topic.character_key]]);
  }
});

test('characters out of their part are noted, whoever leads', () => {
  const hp = packFor('stadium-basics', 'water-hatsune', 'hatsune');
  // 初音 explaining instead of asking.
  const explaining = hatsuneArticle(); explaining.sections[1].blocks[2].turns[0].text = '出走表の号艇と、この表のコースは別のものです。';
  assert.match(check(compose(explaining, hp), hp).find(i => i.code === 'character_role').message, /初音が読者の疑問を質問していません/);
  // キイナ not bringing up an outer course or a surprise.
  const kp = packFor('stadiums', 'outer-kiina', 'kiina');
  const plain = kiinaArticle(); plain.sections[0].blocks[2].turns[0].text = 'この表、見やすいね。';
  assert.match(check(compose(plain, kp), kp).find(i => i.code === 'character_role').message, /キイナが外コースや意外なデータに触れていません/);
  // A character outside the theme's cast.
  const third = kiinaArticle(); third.sections[0].blocks[2].turns.push(turn('hatsune', 'どういう意味ですか？', 'pose3'));
  assert.ok(check(compose(third, kp), kp).some(i => i.code === 'cast_mismatch'));
});

test('one character alone: no dialogue is planned or asked for, and one written anyway is noted', () => {
  for (const [cat, angle, key] of [['stadium-basics', 'water', null], ['stadiums', 'inside', null], ['characters', 'walk-kiina', 'kiina'], ['characters', 'walk-hatsune', 'hatsune'], ['stadium-charm', 'facilities', null]]) {
    const pack = packFor(cat, angle, key), plan = articlePlan(pack);
    assert.equal(plan.cast.length, 1, angle); assert.equal(plan.maxDialogues, 0, angle);
    assert.equal(plan.dialogueFocus, null, angle);
    assert.match(buildInstructions(pack), /だけなので、dialogue は使いません（1人だけの会話は作りません）/, angle);
  }
  // A monologue "dialogue" in a theme with one character.
  const pack = packFor('characters', 'walk-kiina', 'kiina'), ai = kiinaArticle();
  ai.sections[0].blocks[2].turns = [turn('kiina', '4コースの1着率10.0%が3コースの8.5%より上だよ。', 'pose3')];
  assert.match(check(compose(ai, pack), pack).find(i => i.code === 'too_many_dialogues').message, /1個、目安0個まで/);
});

test('evaluation sheet: the automatic table in the docs is what the local script computes from the fixtures', async () => {
  const { readFile } = await import('node:fs/promises');
  const { ARTICLES, evaluate, markdown } = await import('../../scripts/blog/ai-evaluation.mjs');
  const docs = await readFile(new URL('../../docs/blog/AI-EVALUATION.md', import.meta.url), 'utf8');
  const auto = docs.split('<!-- ai-evaluation:auto:start -->')[1].split('<!-- ai-evaluation:auto:end -->')[0].trim();
  assert.equal(auto, markdown());
  const rows = Object.fromEntries(ARTICLES.map(a => [a.name, evaluate(a)]));
  assert.deepEqual([rows['常滑 v8'].source_id_errors, rows['常滑 v8'].duplication, rows['常滑 v9'].duplication, rows['常滑 v9'].average], [3, 2, 5, 5]);
  // Every item of the sheet has its row, and the human and editor sheets list every article.
  for (const item of ['事実と数値の正確性', '出典IDの正確性', '文章の重複', '読みやすさ', 'キャラクターらしさ', '記事としての面白さ', '編集者が修正する箇所']) assert.ok(docs.includes(`| ${item} |`), item);
  for (const a of ARTICLES) assert.ok(docs.split(`| ${a.name} |`).length - 1 >= 3, a.name);
});

test('scheduled topics: the new character-led variants are never registered automatically', async () => {
  const { nextAutoTopic } = await import('../../lib/blog/ai/schedule.mjs');
  // Every water and course topic already taken: the rotation moves on to the next category, not to water-hatsune.
  const taken = candidateTopics({ categorySlug: 'stadium-basics' }).filter(c => !c.angle.includes('-')).map(c => c.topic_key);
  const next = nextAutoTopic({ existingKeys: taken, categories: ['stadium-basics', 'stadiums'], now: () => new Date('2026-10-12T00:00:00Z') });
  assert.equal(next.category_slug, 'stadiums'); assert.equal(next.angle, 'inside');
  const none = nextAutoTopic({ existingKeys: taken, categories: ['stadium-basics'], now: () => new Date('2026-10-12T00:00:00Z') });
  assert.equal(none, null);
});

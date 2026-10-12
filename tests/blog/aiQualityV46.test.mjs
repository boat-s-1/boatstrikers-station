import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, NOW, basicsTopic, goodAi, memoryStore, memoryRepo, fakeCover, html, fakeFetch } from './_aiFixtures.mjs';
import { v4Topic, v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { v6Pack, v6Document } from './_tokonameV6.mjs';
import { v7Pack, v7Document } from './_tokonameV7.mjs';
import { v8Pack, v8Document, generationValidation } from './_tokonameV8.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument } from '../../lib/blog/ai/validate.mjs';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { approveDraft, draftStatus, sourceIdNotes } from '../../lib/blog/ai/approval.mjs';
import { DATA_CHECK_PURPOSES, RATE_WARNING, dataCheckLine } from '../../lib/blog/ai/glossary.mjs';

const warnings = issues => [...new Set(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited').map(i => i.code))].sort();
const check = (document, pack) => validateAiDocument({ document, pack });
const scores = (document, pack) => scorecard({ document, pack, issues: check(document, pack) });
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const pack = () => ({ ...structuredClone(v6Pack), version: 4, comparison: undefined });
const DEFINITION = 'コース別1着率は、そのコースから進入した艇が1着になった割合です。';
// The article blog-ai-v8/v9 asks for (as in aiQualityV45): basics only in the lead, the definition once.
const ideal = () => ({
  title: '常滑のコース別1着率｜1コースは半分超え、では2番手は？',
  excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  seo_title: '常滑のコース別1着率を読む', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  takeaways: ['1コースの1着率の高さと、1コース以外で目立つコース', '号艇とコースの違い', '当日に確かめる項目とその理由'],
  lead: '常滑は海水で、干満差はない水面です。そのコース別1着率の表には、内側から順に並んでいないところがあります。どこなのか、1コースの数字から見ていきましょう。',
  sections: [
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', `出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、${DEFINITION}2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。`, ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        { character: 'kiina', pose: 'pose3', text: 'あれ、4コースの1着率10.0%が3コースの8.5%より上だ。外の方が上って、ちょっと意外じゃない？' },
        { character: 'ichika', pose: 'pose1', text: 'いい発見だね。理由は表だけでは分からないけど、並び方に例外がある期間だと覚えておこう。誰が4コースに入りそうかは、下の確認項目のスタート展示で見てみよう。' }] },
    ] },
    { heading: '当日に確かめること', blocks: [t('data_check', DATA_CHECK_PURPOSES.map(dataCheckLine).join('\n')), t('warning', RATE_WARNING)] },
  ],
  summary: 'この期間の常滑は、1コースが半分を超える一方で、外の4コースが3コースを上回る例外もありました。表を見るときは、高い順だけでなく並び方の例外にも目を向けてみてください。',
  needs_check: [],
});
const variant = change => { const ai = ideal(); change(ai); const p = pack(); return warnings(check(composeDocument({ ai, pack: p, topic: v4Topic, catalogue }).document, p)); };
const addText = (ai, at, text) => ai.sections[0].blocks.splice(at, 0, t('text', text, ['S2']));

test('regression (Tokoname v8 draft 2026-10-12): the false caveat is gone; the basics and definition repeats are noted', () => {
  const issues = check(v8Document, v8Pack);
  assert.deepEqual(issues.filter(i => i.level === 'blocking').map(i => i.code), ['comparison_draft']);
  assert.deepEqual(warnings(issues), ['basics_repeated', 'caveat_misplaced', 'definition_repeated']);
  // "表をコース番号の順だけで決めつけず" is about reading the table, not the past-figures caveat: no repeated_caveat.
  assert.ok(!issues.some(i => i.code === 'repeated_caveat'));
  assert.match(issues.find(i => i.code === 'caveat_misplaced').message, /当日の出走表・進入を確認する.*ブロック13（TEXT）/);
  assert.match(issues.find(i => i.code === 'basics_repeated').message, /ブロック4（TEXT）：水質・干満差/);
  assert.match(issues.find(i => i.code === 'definition_repeated').message, /2回.*ブロック5（TEXT）、ブロック7（TEXT）/);
  const sc = scorecard({ document: v8Document, pack: v8Pack, issues });
  assert.deepEqual(sc.axes.map(a => a.score), [5, 5, 2, 5, 5, 5, 5]);
  assert.equal(sc.average, 4.5); assert.equal(sc.average_all, 4.6);
});

test('regression: the v4〜v7 findings and scores do not move', () => {
  const table = [[v4Document, v4Pack, [5, 4, 1, 3, 4, 2, null], 3.2], [v5Document, v5Pack, [5, 5, 3, 5, 4, 4, null], 4.3],
    [v6Document, v6Pack, [5, 5, 5, 5, 4, 5, null], 4.8], [v7Document, v7Pack, [5, 5, 2, 5, 4, 5, 5], 4.3]];
  for (const [document, p, expected, average] of table) {
    const sc = scores(document, p);
    assert.deepEqual(sc.axes.map(a => a.score), expected); assert.equal(sc.average, average);
    assert.deepEqual(check(document, p).filter(i => ['definition_repeated', 'basics_repeated'].includes(i.code)), []);
  }
});

test('the past-figures caveat: "決めつけ" counts only when it is about the figures', () => {
  // Still found: the caveat written about the figures, in two places.
  for (const text of ['過去の数字だけで決めつけないようにしましょう。', '1着率だけで決めつけず、表を読みましょう。'])
    assert.ok(variant(ai => { addText(ai, 2, text); }).includes('repeated_caveat'), text);
  // Not a caveat: how to read the table.
  assert.ok(!variant(ai => { addText(ai, 2, '4コースが3コースを上回るので、表をコース番号の順だけで決めつけずに読みます。'); }).includes('repeated_caveat'));
});

test('the rate definition: once is fine; said again in the body is noted', () => {
  assert.deepEqual(variant(() => {}), []);
  assert.deepEqual(variant(ai => { addText(ai, 2, '数字は、どのコースから進入した艇が1着になった割合かを確認して読みましょう。'); }), ['definition_repeated']);
  // A short recap in the summary, the dialogue and the 号艇/course explanation are not counted here.
  assert.deepEqual(variant(ai => { ai.summary = `${ai.summary.split('。')[0]}。そのコースから進入した艇が1着になった割合として、並び方の例外にも目を向けてみてください。`; }).filter(c => c === 'definition_repeated'), []);
  assert.deepEqual(variant(ai => { ai.sections[0].blocks[2].turns[1].text = 'いい発見だね。そのコースから進入した艇が1着になった割合だから、例外がある期間だと覚えておこう。'; }).filter(c => c === 'definition_repeated'), []);
  assert.deepEqual(variant(ai => { addText(ai, 2, 'この数字は号艇別ではなく、そのコースから進入した艇の数字です。'); }).filter(c => c === 'definition_repeated'), []);
});

test('basics: what the lead gave is not repeated in the body; elsewhere it is fine', () => {
  assert.deepEqual(variant(ai => { addText(ai, 0, '常滑の水質は海水、干満差は「なし」です。'); }), ['basics_repeated']);
  // Without the basics in the lead, one body sentence is the only place they are told.
  assert.deepEqual(variant(ai => { ai.lead = 'コース別1着率の表には、内側から順に並んでいないところがあります。どこなのか、1コースの数字から見ていきましょう。'; addText(ai, 0, '常滑の水質は海水、干満差は「なし」です。'); }), []);
  // The takeaways name the topic; the DATA CHECK says to check the water on the day.
  assert.deepEqual(variant(ai => { ai.takeaways[1] = '常滑の水質と干満差'; }), []);
});

test('prompt blog-ai-v9: summary close, source ids, basics and definition once', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v11');
  const prompt = buildInstructions(pack());
  assert.match(prompt, /締めの文は、発見が表の読み方にどう役立つかで終え、当日の確認（出走表・進入・展示）に話を戻しません/);
  assert.match(prompt, /source_ids に入れてよいのは sources の id だけです。readings の id（"R1" など）は出典IDではないので入れません/);
  assert.match(prompt, /reading 自体の id（"R2" など）は入れません/);
  assert.match(prompt, /導入で書いた基本情報は、本文で繰り返しません/);
  assert.match(prompt, /コース別1着率の定義は記事の中で1回だけ説明し、後の本文や表の説明で言い直しません/);
  // Still allowed: recalling the findings briefly.
  assert.match(prompt, /発見は本文とは違う言葉で短く振り返り/);
});

test('source ids: the AI\'s wrong ids are kept blocking at generation, shown apart from the score, and never lost', async () => {
  // The Tokoname v8 notes: reading ids, named as such.
  const notes = sourceIdNotes({ source_pack: v8Pack, validation: generationValidation });
  assert.deepEqual(notes.map(n => [n.code, n.level]), [['source_id_error', 'warning'], ['source_id_error', 'warning'], ['source_id_error', 'warning']]);
  assert.match(notes[0].message, /^作成時：セクション2・ブロック1で、AIが出典IDとして「R2」を使っていました（データの特徴 readings のIDで、出典IDではありません）/);
  assert.match(notes[2].message, /セクション2・ブロック3.*「R5」/);

  // A draft whose AI answer cites a reading id: composing still records it as blocking (unchanged).
  const store = memoryStore(), repo = memoryRepo();
  const ai = goodAi(); ai.sections[0].blocks[1].source_ids = ['S1', 'R2'];
  const r = await runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW,
    fetchImpl: fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } }), callAi: async () => ({ data: ai, model: 'm' }) });
  const postId = r.post_id, draft = await store.aiDraft(postId);
  assert.ok(draft.validation.some(i => i.code === 'unknown_source' && i.level === 'blocking' && /「R2」/.test(i.message)));
  assert.ok(draft.blocking_issues >= 1);
  const editor = await repo.editor(postId);
  assert.ok(!editor.document.blocks.some(b => (b.data.source_ids || []).includes('R2')), 'the id is never saved');
  // The editor shows it on its own, not in the score and not twice in the list.
  let status = await draftStatus({ repo, store, postId });
  assert.deepEqual(status.source_id_notes.map(n => n.code), ['source_id_error']);
  assert.match(status.source_id_notes[0].message, /「R2」/);
  assert.ok(!status.validation.some(i => /R2/.test(i.message)));
  assert.ok(!JSON.stringify(status.scorecard).includes('R2'));
  // Approval still depends on the live check alone; the note is recorded with it, as a warning, and stays visible.
  const result = await approveDraft({ repo, store, postId, version: editor.version, name: '山田', session: { hash: 'a'.repeat(32), loginAt: NOW().toISOString() } });
  assert.equal(result.approved, status.live_blocking === 0);
  const after = await store.aiDraft(postId);
  assert.ok(after.validation.some(i => i.code === 'source_id_error' && i.level === 'warning' && /「R2」/.test(i.message)));
  assert.ok(!after.validation.some(i => i.code === 'unknown_source'));
  status = await draftStatus({ repo, store, postId });
  assert.deepEqual(status.source_id_notes.map(n => n.code), ['source_id_error']);
  // An id that is not registered can never reach a saved block: the live check blocks it.
  const crafted = { ...editor.document, blocks: editor.document.blocks.map((b, i) => (i === 2 ? { ...b, data: { ...b.data, source_ids: ['S1', 'R2'] } } : b)) };
  assert.ok(validateAiDocument({ document: crafted, pack: draft.source_pack }).some(i => i.code === 'unknown_source' && i.level === 'blocking'));
});

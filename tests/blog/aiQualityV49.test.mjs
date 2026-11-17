import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, NOW, basicsTopic, goodAi, memoryStore, memoryRepo, fakeCover, html, fakeFetch } from './_aiFixtures.mjs';
import { v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { v6Pack, v6Document } from './_tokonameV6.mjs';
import { v7Pack, v7Document } from './_tokonameV7.mjs';
import { v8Pack, v8Document } from './_tokonameV8.mjs';
import { v9Pack, v9Document } from './_tokonameV9.mjs';
import { todaPack, todaDocument } from './_todaV10.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { qualityIssues } from '../../lib/blog/ai/quality.mjs';
import { comparisonFindings, courseReadings, rateStatements, inOrder } from '../../lib/blog/ai/dataReadings.mjs';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { DATA_CHECK_PURPOSES, RATE_WARNING, dataCheckLine } from '../../lib/blog/ai/glossary.mjs';

const warnings = issues => [...new Set(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited').map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking').map(i => i.code);
const check = (document, pack) => validateAiDocument({ document, pack });
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const todaTopic = { id: 'topic-toda', topic_key: 'stadium-basics:toda:course', category_slug: 'stadium-basics', stadium_slug: 'toda', angle: 'course', title_hint: '戸田のコース別1着率を確認する', character_key: 'ichika', status: 'candidate' };
const tokonameFacts = v6Pack.facts, todaFacts = todaPack.facts;
// [certain, unclear] findings of one sentence against one stadium's data.
const verdict = (text, facts, options) => { const f = comparisonFindings(text, facts, options); return [f.certain.length, f.unclear.length]; };

test('regression (Toda v10 draft 2026-10-12): the false lead now blocks approval; the false notes are gone, the real ones stay', () => {
  const issues = check(todaDocument, todaPack);
  assert.deepEqual(blocking(issues), ['comparison_mismatch']);
  const wrong = issues.find(i => i.code === 'comparison_mismatch');
  assert.match(wrong.message, /^ブロック2（TEXT）：比較がデータと合いません 「内側から順に並んでいないところがあります」（1コースから6コースまで内側から順に高くなっています：1コース42\.8%/);
  // Gone: the two sentences stating different readings (blocks 6 and 7), "2.8" inside "42.8" and the table counted as
  // a mention, and the heading read as a caveat. Kept: the dialogue restating the DATA CHECK, the preamble (now named
  // as such instead of an item without a reason), and the summary without a finding.
  assert.deepEqual(warnings(issues), ['data_check_preamble', 'dialogue_repeats_note', 'summary_without_finding']);
  assert.match(issues.find(i => i.code === 'data_check_preamble').message, /「当日に確認する項目は次の4つです。」/);
  const sc = scorecard({ document: todaDocument, pack: todaPack, issues });
  // Accuracy 1: a clear contradiction of the data. Explanation 4: Toda's own findings (below half, in order) untold.
  assert.deepEqual(sc.axes.map(a => a.score), [1, 5, 5, 4, 4, 4, 4]);
  assert.equal(sc.average, 3.8); assert.equal(sc.average_all, 3.9);
});

test('regression: the Tokoname v4〜v9 drafts gain no blocking issue, and their scores do not move', () => {
  const table = [[v4Document, v4Pack, [5, 4, 1, 3, 4, 2, null]], [v5Document, v5Pack, [5, 5, 3, 5, 4, 4, null]], [v6Document, v6Pack, [5, 5, 5, 5, 4, 5, null]],
    [v7Document, v7Pack, [5, 5, 2, 5, 4, 5, 5]], [v8Document, v8Pack, [5, 5, 2, 5, 5, 5, 5]], [v9Document, v9Pack, [5, 5, 5, 5, 5, 5, 5]]];
  for (const [document, pack, expected] of table) {
    const issues = check(document, pack);
    assert.ok(!issues.some(i => i.code === 'comparison_mismatch'), 'Tokoname has a reversal: "not in inside-first order" is true there');
    assert.deepEqual(scorecard({ document, pack, issues }).axes.map(a => a.score), expected);
  }
});

test('inside-first order: claims are checked against the data, clear ones block, hedged ones are shown, questions say nothing', () => {
  const rates = values => values.map((value, i) => ({ course: i + 1, value }));
  assert.equal(inOrder(rates([42.8, 17.0, 14.9, 14.2, 9.3, 2.8])), true, 'Toda');
  assert.equal(inOrder(rates([61.2, 14.4, 8.5, 10.0, 4.4, 2.2])), false, 'Tokoname: 4 > 3');
  assert.equal(inOrder(rates([54.7, 13.2, 13.4, 9.4, 6.8, 3.0])), null, 'Kiryu: 2 and 3 within the near margin');
  const notInOrder = 'コース別1着率の表には、内側から順に並んでいないところがあります。';
  assert.deepEqual(verdict(notInOrder, todaFacts), [1, 0], 'Toda is in order: the claim is wrong');
  assert.deepEqual(verdict(notInOrder, tokonameFacts), [0, 0], 'Tokoname has 4 > 3: the claim is right');
  const inOrderClaim = '戸田の1着率は、1コースから6コースまで内側から順に高くなっています。';
  assert.deepEqual(verdict(inOrderClaim, todaFacts), [0, 0]);
  assert.deepEqual(verdict(inOrderClaim, tokonameFacts), [1, 0]);
  // Negations read in their own clause, casual or polite.
  for (const text of ['この期間の表は、1着率が内側から順に並ぶわけではないと読めるよ。', '1着率は内側から順に並ぶわけじゃないデータもあるよね。', '4コースの1着率は3コースより高く、内側から順に下がるわけではありません。'])
    assert.deepEqual(verdict(text, tokonameFacts), [0, 0], text);
  assert.deepEqual(verdict('この期間の表は、1着率が内側から順に並ぶわけではないと読めるよ。', todaFacts), [1, 0]);
  // Hedged or rhetorical: shown for review, never blocking.
  assert.deepEqual(verdict('1着率が内側から順に並んでいるとは限りません。', todaFacts), [0, 1]);
  assert.deepEqual(verdict('1着率は、内側のコースほど順番に高い表ではないんじゃない？', todaFacts), [0, 1]);
  // A plain question claims nothing; a statement about part of the courses is not read.
  assert.deepEqual(verdict('コース別1着率の表は、内側から順に並んでいるでしょうか。', todaFacts), [0, 0]);
  assert.deepEqual(verdict('コース別1着率の表は、内側から順に並んでいるでしょうか。', tokonameFacts), [0, 0]);
  assert.deepEqual(verdict('外側のコースでは、1着率が内側から順に並んでいます。', tokonameFacts), [0, 0]);
  // Told from the outer courses.
  assert.deepEqual(verdict('1着率では、外のコースが内側のコースを上回るところがありません。', todaFacts), [0, 0]);
  assert.deepEqual(verdict('1着率では、外のコースが内側のコースを上回るところがありません。', tokonameFacts), [1, 0]);
  // A near tie between neighbours leaves either claim a judgement (Kiryu: 2コース 13.2%, 3コース 13.4%).
  const near = [['54.7', 1], ['13.2', 2], ['13.4', 3], ['9.4', 4], ['6.8', 5], ['3.0', 6]].map(([value, c]) => ({ id: `F${c}`, label: `桐生の${c}コース1着率`, value, unit: '%', period: '2026/07/01〜2026/09/30', source_id: 'S2' }));
  assert.deepEqual(verdict(notInOrder, near), [0, 0]); assert.deepEqual(verdict(inOrderClaim.replace('戸田', '桐生'), near), [0, 0]);
  // In the title, the excerpt and the SEO texts too.
  const titled = structuredClone(todaDocument); titled.blocks[1].data.text = '戸田の水質は淡水で、干満差はありません。'; titled.excerpt = '戸田のコース別1着率は、内側から順に並んでいないところがあります。';
  assert.ok(check(titled, todaPack).some(i => i.code === 'comparison_mismatch' && i.level === 'blocking' && /^抜粋/.test(i.message)));
});

test('below half: a new reading for Toda, checked both ways; Tokoname keeps its readings', () => {
  const toda = courseReadings(todaFacts).filter(r => r.featured).map(r => r.key);
  assert.deepEqual(toda, ['under_half:1', 'except:2:高', 'sequence:in']);
  assert.deepEqual(courseReadings(tokonameFacts).filter(r => r.featured).map(r => r.key), ['half:1', 'except:2:高', 'pair:4>3']);
  assert.deepEqual(rateStatements('1コースの1着率は42.8%で、半分に届いていません。', todaFacts).map(s => s.key), ['under_half:1']);
  assert.deepEqual(verdict('1コースの1着率は42.8%で、半分に届いていません。', todaFacts), [0, 0]);
  assert.deepEqual(verdict('1コースの1着率は半分を超えていません。', tokonameFacts), [1, 0]);
  assert.deepEqual(verdict('1コースの1着率は半分を超えています。', todaFacts), [1, 0]);
  assert.deepEqual(verdict('1コースの1着率は半分に届かないわけではありません。', todaFacts), [0, 0], 'negated: nothing stated');
});

test('false notes fixed, real repeats still found', () => {
  const pack = todaPack;
  const doc = blocks => ({ ...todaDocument, blocks: blocks.map((text, i) => ({ id: `b${i}`, type: 'TEXT', data: { text, source_ids: ['S2'] } })) });
  const codes = blocks => qualityIssues({ document: doc(blocks), pack }).map(i => i.code);
  // Different readings in the same frame: not a repeat. The same reading twice: still a repeated reading.
  assert.ok(!codes(['1コースの1着率は42.8%で、6つのコースの中で最も高い数字です。', '6コースの1着率は2.8%で、6つのコースの中で最も低い数字です。']).includes('repeated_content'));
  assert.ok(codes(['1コースの1着率は42.8%で、6つのコースの中で最も高い数字です。', '1コースの1着率は42.8%で、6つのコースの中で最も高い数値です。']).includes('repeated_content'));
  assert.ok(codes(['1コースの1着率は42.8%で、6つのコースの中で最も高い数字です。', 'この期間は、1コースが最も高い1着率でした。']).includes('repeated_reading'));
  // "2.8" is not in "42.8"; the system table is not a mention; three real mentions still are.
  assert.ok(!codes(['1コースの1着率は42.8%です。', '6コースの1着率は2.8%です。']).includes('repeated_fact'));
  assert.ok(codes(['6コースの1着率は2.8%です。', '外側の6コースは2.8%でした。', 'いちばん低いのは2.8%の6コース。']).includes('repeated_fact'));
  // A heading is not a caveat; the same words in a text are.
  const heading = structuredClone(todaDocument); heading.blocks[7].data.text = '当日は出走表と進入を確認する';
  assert.ok(!qualityIssues({ document: heading, pack }).some(i => /caveat/.test(i.code)));
  const text = structuredClone(todaDocument); text.blocks[6].data.text += '当日は出走表と進入を確認しましょう。';
  assert.ok(qualityIssues({ document: text, pack }).some(i => i.code === 'caveat_misplaced'));
});

test('DATA CHECK: a preamble is named as such; items without a reason are still noted', () => {
  const withBlock = text => { const d = structuredClone(todaDocument); d.blocks[9].data.text = text; return warnings(qualityIssues({ document: d, pack: todaPack })); };
  const items = DATA_CHECK_PURPOSES.map(dataCheckLine).join('\n');
  assert.ok(!withBlock(items).some(c => /data_check_(preamble|without_reason)/.test(c)));
  assert.deepEqual(withBlock(`当日に確認する項目は次の4つです。\n${items}`).filter(c => /data_check/.test(c)), ['data_check_preamble']);
  assert.deepEqual(withBlock('・出走表の号艇と選手\n・スタート展示の進入コース').filter(c => /data_check/.test(c)), ['data_check_without_reason']);
  assert.deepEqual(withBlock('出走表の号艇と選手\nスタート展示の進入コース').filter(c => /data_check/.test(c)), ['data_check_without_reason'], 'no bullets: every line is an item');
});

test('similar titles: the same theme at another stadium is no duplicate; the same stadium still is', async () => {
  const run = titles => { const store = memoryStore({ titles }), repo = memoryRepo();
    return runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW, fetchImpl: fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } }), callAi: async () => ({ data: goodAi(), model: 'm' }) }); };
  const other = await run([{ post_id: 'p-tokoname', title: '常滑の水面と干満差' }]);
  assert.ok(!other.issues.some(i => i.code === 'similar_title'), 'Tokoname\'s article on the same theme is not compared');
  await assert.rejects(run([{ post_id: 'p-kiryu', title: '桐生の水面と干満差の基本' }]), e => e.status === 409 && /よく似た記事があります/.test(e.message));
});

test('prompt blog-ai-v11: examples follow the stadium\'s own data; the dialogue and the DATA CHECK keep their places', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v14');
  const toda = buildInstructions(todaPack), tokoname = buildInstructions({ ...structuredClone(v6Pack), version: 4, comparison: undefined });
  // Tokoname's example is never handed to Toda.
  assert.doesNotMatch(toda, /内側から順に並んでいないところがあります/);
  assert.match(toda, /例：「6つのコースの数字は、どんな順番で並んでいるでしょうか」/);
  assert.match(tokoname, /例：「表には、内側から順に並んでいないところがあります。どこでしょうか」/);
  assert.match(toda, /例：「1コースが半分に届かない一方で、1コースから6コースまで順番どおりに並ぶ期間でした」/);
  assert.doesNotMatch(toda, /外の4コースが3コースを上回る/);
  // 初音 asks about Toda's order, not about 号艇 again; 一果 explains what the numbers show.
  assert.match(toda, /初音が表を見て、readings の「1着率は1コースから6コースまで、内側から順に高い（順番が入れ替わるところがない）」について初心者の疑問として質問し/);
  assert.match(toda, /号艇とコースの違いは本文と data_check で説明しているので、会話では扱いません/);
  assert.match(toda, /その数字が何を示すか・どう読むかを、初心者に分かる言葉で1つ加えます/);
  assert.match(toda, /dialogue は rate_table と特徴を説明するセクションに置き、当日に確認するセクションには置きません/);
  assert.match(toda, /data_check の text は項目の行だけにし、「当日に確認する項目は次の4つです」のような前置きの文は書きません/);
  assert.match(toda, /「内側から順に並ばない／並ぶ」「半分を超える／届かない」のような表全体の特徴は、readings にあるときだけ書きます/);
  assert.match(toda, /誰がどのコースに入りそうかは、下の確認項目のスタート展示で見てみよう/);
  // The plan behind it.
  const plan = articlePlan(todaPack);
  assert.deepEqual([plan.framing.title.key, plan.framing.hook.key, plan.dialogueFocus, plan.placements],
    ['under_half:1', 'sequence:in', { kind: 'question', key: 'sequence:in', text: '1着率は1コースから6コースまで、内側から順に高い（順番が入れ替わるところがない）' }, { 'under_half:1': 'body', 'except:2:高': 'body', 'sequence:in': 'dialogue' }]);
});

// Toda written as blog-ai-v11 asks: the title tells 1コース below half, the lead asks about the order, 初音 asks what the
// order means and 一果 answers, the DATA CHECK has its items only, and the summary keeps Toda's own two findings.
export const todaModel = () => ({
  title: '戸田のコース別1着率｜1コースは42.8%で半分に届かない',
  excerpt: '戸田のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの数字と、6つのコースの並び方を初心者向けに整理します。',
  seo_title: '戸田のコース別1着率を読む', seo_description: '戸田のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの数字と、6つのコースの並び方を初心者向けに整理します。',
  takeaways: ['1コースの1着率と、1コース以外で高いコース', '号艇とコースの違い', '当日に確かめる項目とその理由'],
  lead: '戸田は淡水で、干満差はない水面です。6つのコースの1着率は、どんな順番で並んでいるでしょうか。1コースの数字から見ていきます。',
  sections: [
    { heading: '1コースの1着率は42.8%で、半分に届かない', blocks: [
      t('text', '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。2026年7月1日から9月30日の集計では、1コースの1着率は42.8%で、半分に届いていません。1コース以外では、2コースの1着率（17.0%）が最も高くなっています。', ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        { character: 'hatsune', pose: 'pose3', text: '1着率が、1コースから6コースまで順番に小さくなっていますね。これはどう読めばいいんですか？' },
        { character: 'ichika', pose: 'pose1', text: 'この期間は、外のコースが内側のコースを上回るところがなかった、という読み方だよ。理由は表だけでは分からないけど、並び方に例外がない期間だと覚えておこう。' }] },
    ] },
    { heading: '当日に確かめること', blocks: [t('data_check', DATA_CHECK_PURPOSES.map(dataCheckLine).join('\n')), t('warning', RATE_WARNING)] },
  ],
  summary: 'この期間の戸田は、1コースが半分に届かない一方で、1コースから6コースまで順番どおりに並ぶ期間でした。表を見るときは、1コースの数字の大きさにも目を向けてみてください。',
  needs_check: [],
});

test('the Toda article blog-ai-v11 asks for: approvable, no quality note, every axis at 5', () => {
  const { document } = composeDocument({ ai: todaModel(), pack: todaPack, topic: todaTopic, catalogue });
  const issues = check(document, todaPack);
  assert.equal(blockingCount(issues), 0, JSON.stringify(issues.filter(i => i.level === 'blocking')));
  assert.deepEqual(warnings(issues), []);
  assert.deepEqual(scorecard({ document, pack: todaPack, issues }).axes.map(a => a.score), [5, 5, 5, 5, 5, 5, 5]);
  // The old dialogue (初音 asking about 号艇 again) in the same article is still noted.
  const old = todaModel(); old.sections[0].blocks[2].turns = todaDocument.blocks[8].data.turns.map(({ character, pose, text }) => ({ character, pose, text }));
  assert.ok(check(composeDocument({ ai: old, pack: todaPack, topic: todaTopic, catalogue }).document, todaPack).some(i => i.code === 'dialogue_repeats_note'));
  // Its lead with Tokoname's question blocks approval.
  const copied = todaModel(); copied.lead = '戸田は淡水で、干満差はない水面です。コース別1着率の表には、内側から順に並んでいないところがあります。どこでしょうか。';
  assert.deepEqual(blocking(check(composeDocument({ ai: copied, pack: todaPack, topic: todaTopic, catalogue }).document, todaPack)), ['comparison_mismatch']);
});

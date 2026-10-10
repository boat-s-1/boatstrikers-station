import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './_aiFixtures.mjs';
import { kiryuPageRow } from './_kiryuRegression.mjs';
import { v3Topic, v3Document } from './_kiryuV3.mjs';
import { v4Topic, v4Pack, v4Document } from './_tokonameV4.mjs';
import { v5Pack, v5Document } from './_tokonameV5.mjs';
import { v6Pack, v6Document } from './_tokonameV6.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';
import { buildInstructions, buildInput, ARTICLE_SCHEMA } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { GLOSSARY, DATA_CHECK_PURPOSES, dataCheckLine } from '../../lib/blog/ai/glossary.mjs';
import { articleSections } from '../../lib/blog/articleModel.mjs';
import { claimsIn } from '../../lib/blog/ai/claims.mjs';

const codes = issues => [...new Set(issues.map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking');
const t = (type, text, ids = []) => ({ type, text, items: [], turns: [], source_ids: ids });
const NEW = ['unsourced_claim', 'dialogue_echo', 'lead_missing', 'lead_without_hook', 'lead_repeats_title', 'frame_course_unexplained', 'data_check_without_reason', 'summary_without_finding', 'summary_repeats_definition'];
const QUALITY = ['repeated_content', 'repeated_fact', 'stock_phrase', 'too_long_for_facts', 'dialogue_restates', 'cast_mismatch', 'too_many_dialogues', 'unexplained_data', 'causal_claim',
  'course_frame_confusion', 'repeated_caveat', 'summary_restates', 'empty_data_check', 'dialogue_missing', 'numbers_without_reading', 'comparison_mismatch', 'comparison_unclear',
  'table_mismatch', 'repeated_reading', 'takeaways_restate', 'caveat_misplaced', 'low_information', 'rate_numbers_repeated', 'character_role', 'statement_without_source',
  'table_restated', 'data_check_overlap', ...NEW];
// The Tokoname pack as PHASE 4.4 builds it (version 3: the blog-ai-v7 structure is checked).
const v7Pack = () => ({ ...structuredClone(v6Pack), version: 3, comparison: undefined });
const compose = (ai, pack = v7Pack()) => composeDocument({ ai, pack, topic: v4Topic, catalogue });
const check = (document, pack = v7Pack()) => validateAiDocument({ document, pack });

// The theme written as blog-ai-v7 asks: the title states one finding, the lead asks about another and folds in the
// basics, the 号艇/course difference comes before the table, キイナ's find is answered with how to use it, the DATA
// CHECK says why, and the summary keeps the two findings.
const ideal = () => ({
  title: '常滑のコース別1着率｜1コースは半分超え、では2番手は？',
  excerpt: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認します。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  seo_title: '常滑のコース別1着率を読む', seo_description: '常滑のコース別1着率を、2026年7月1日から9月30日のBOAT RACE公式データで確認。1コースの高さと、内側から順に並ばないところを初心者向けに整理します。',
  takeaways: ['1コースの1着率の高さと、1コース以外で目立つコース', '号艇とコースの違い', '当日に確かめる項目とその理由'],
  lead: '常滑は海水で、干満差はない水面です。そのコース別1着率の表には、内側から順に並んでいないところがあります。どこなのか、1コースの数字から見ていきましょう。',
  sections: [
    { heading: '1コースの1着率は61.2%で半分を超える', blocks: [
      t('text', '出走表の号艇は艇ごとの番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、コース別1着率は、そのコースから進入した艇が1着になった割合です。2026年7月1日から9月30日の集計では、1コースの1着率が61.2%で半分を超えています。1コース以外では、2コースの1着率（14.4%）が最も高くなっています。', ['S2']),
      t('rate_table', null),
      { type: 'dialogue', text: null, items: [], source_ids: ['S2'], turns: [
        { character: 'kiina', pose: 'pose3', text: 'あれ、4コースの1着率10.0%が3コースの8.5%より上だ。外の方が上って、ちょっと意外じゃない？' },
        { character: 'ichika', pose: 'pose1', text: 'いい発見だね。理由は表だけでは分からないよ。表は過去の集計期間の数字で、レースの日の進入はスタート展示が参考になるけど、本番で変わることもあるんだ。' }] },
    ] },
    { heading: '当日に確かめること', blocks: [
      t('data_check', DATA_CHECK_PURPOSES.slice(0, 3).map(dataCheckLine).join('\n')),
      t('warning', 'コース別1着率は過去の集計で、これからのレースの結果を示すものではありません。'),
    ] },
  ],
  summary: 'この期間の常滑は、1コースの1着率が半分を超える一方で、4コースが3コースを上回る例外もありました。数字の高さだけでなく、並び方の例外にも目を向けてみてください。',
  needs_check: [],
});

test('regression (Tokoname v6 draft 2026-10-10): 5.0 before; 一果 echoing キイナ is now noted, the v7 structure checks stay off for its pack', () => {
  const issues = check(v6Document, v6Pack);
  assert.deepEqual(blocking(issues).map(i => i.code), ['comparison_draft']);
  assert.deepEqual(codes(issues.filter(i => QUALITY.includes(i.code))), ['dialogue_echo']);
  assert.match(issues.find(i => i.code === 'dialogue_echo').message, /^ブロック8（DIALOGUE_SCENE）：一果の発言が、直前の発言の言い直し/);
  const sc = scorecard({ document: v6Document, pack: v6Pack, issues });
  assert.deepEqual(sc.axes.map(a => a.score), [5, 5, 5, 5, 4, 5, null]);
  assert.equal(sc.average, 4.8); assert.equal(sc.axes.at(-1).notes[0], 'blog-ai-v7より前の記事（対象外）');
  // Read as a v7 article, what the new structure asks for is missing.
  const asV7 = check(v6Document, { ...v6Pack, version: 3 });
  assert.deepEqual(codes(asV7.filter(i => NEW.includes(i.code))),
    ['data_check_without_reason', 'dialogue_echo', 'frame_course_unexplained', 'lead_missing', 'summary_repeats_definition', 'summary_without_finding']);
  assert.equal(scorecard({ document: v6Document, pack: { ...v6Pack, version: 3 }, issues: asV7 }).axes.at(-1).score, 1);
});

test('regression: earlier drafts (Kiryu v3, Tokoname v4・v5) gain no blocking issue and no v7 structure note', () => {
  for (const [document, pack] of [[v4Document, v4Pack], [v5Document, v5Pack]]) {
    const issues = check(document, pack);
    assert.ok(!issues.some(i => ['comparison_mismatch', 'table_mismatch'].includes(i.code)));
    assert.ok(!issues.some(i => NEW.slice(2).includes(i.code)), 'v7 structure checks apply to version 3 packs only');
  }
  const kiryu = buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') });
  const stored = { ...kiryu, version: 2 };
  assert.ok(!check(v3Document, stored).some(i => i.code === 'comparison_mismatch'));
});

test('the article blog-ai-v7 asks for: no quality note, every axis at 5 including 導入とまとめ', () => {
  const pack = v7Pack(), { document } = compose(ideal(), pack);
  const issues = check(document, pack);
  assert.equal(blockingCount(issues), 0, JSON.stringify(blocking(issues)));
  assert.deepEqual(issues.filter(i => QUALITY.includes(i.code)), []);
  const sc = scorecard({ document, pack, issues });
  assert.deepEqual(sc.axes.map(a => a.key), ['accuracy', 'sources', 'duplication', 'explanation', 'characters', 'readability', 'framing']);
  assert.deepEqual(sc.axes.map(a => [a.key, a.score, a.score === 5 ? '' : a.notes.join()]), sc.axes.map(a => [a.key, 5, '']));
  assert.equal(sc.average, 5); assert.equal(sc.average_all, 5);
  // The lead opens the body: after the takeaways, before the first heading; shown as body text on the page.
  const lead = document.blocks.findIndex(b => b.data.placement === 'lead');
  assert.equal(lead, 1); assert.equal(document.blocks[lead + 1].type, 'HEADING');
  assert.deepEqual(document.blocks[lead].data.source_ids, ['S2'], 'its facts (海水・干満差なし) are cited automatically');
  const sections = articleSections(document.blocks.map((b, position) => ({ ...b, position })));
  assert.equal(sections.body[0].data.placement, 'lead');
  // The summary brings back the two findings without being counted as a repetition.
  assert.ok(!issues.some(i => i.code === 'repeated_reading'));
});

test('accuracy: comparisons in the title, excerpt and SEO texts are checked; general claims without a source are noted', () => {
  const pack = v7Pack(), base = compose(ideal(), pack).document;
  const titled = structuredClone(base); titled.title = '常滑のコース別1着率｜3コースは4コースより高い';
  assert.deepEqual(blocking(check(titled)).map(i => i.message.split('：')[0]), ['タイトル']);
  const seo = structuredClone(base); seo.seo.description = '常滑の1着率は2コースが最も高い。初心者向けに整理します。';
  assert.deepEqual(blocking(check(seo)).map(i => i.message.split('：')[0]), ['SEO説明文']);
  const unclear = structuredClone(base); unclear.excerpt = '常滑では、3コースではなく4コースが5コースより低い1着率です。';
  assert.ok(check(unclear).some(i => i.code === 'comparison_unclear' && /^抜粋/.test(i.message)));
  // General claims: noted wherever they are; sourced facts reported with "とされています" are not.
  const said = structuredClone(base);
  said.blocks[1].data.text = '常滑はインが強いと言われる水面です。一般的に1コースが有利です。';
  const note = check(said).find(i => i.code === 'unsourced_claim');
  assert.match(note.message, /インが強いと言われる水面です/); assert.match(note.message, /一般的に1コースが有利です/);
  assert.equal(note.level, 'warning');
  assert.ok(!check(v6Document, v6Pack).some(i => i.code === 'unsourced_claim'), '「干満差は「なし」とされています」 is a sourced fact');
  assert.equal(scorecard({ document: said, pack, issues: check(said) }).axes[0].score, 4);
});

test('v7 structure: the lead, the 号艇/course explanation, DATA CHECK reasons and the summary are each checked', () => {
  const pack = v7Pack();
  const variant = change => { const ai = ideal(); change(ai); return check(compose(ai, pack).document, pack).filter(i => NEW.includes(i.code)).map(i => i.code).sort(); };
  assert.deepEqual(variant(ai => { ai.lead = ''; }), ['lead_missing']);
  assert.deepEqual(variant(ai => { ai.lead = '常滑のコース別1着率を確認します。'; }), ['lead_without_hook']);
  assert.deepEqual(variant(ai => { ai.lead = '常滑では、1コースの1着率が半分を超えています。表で確かめましょう。'; }), ['lead_repeats_title']);
  assert.deepEqual(variant(ai => { ai.sections[0].blocks[0].text = ai.sections[0].blocks[0].text.replace('出走表の号艇は艇ごとの番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えていて、', ''); }), ['frame_course_unexplained']);
  assert.deepEqual(variant(ai => { ai.sections[1].blocks[0].text = '・出走表の号艇と選手\n・スタート展示の進入コース\n・展示後の直前情報'; }), ['data_check_without_reason']);
  assert.deepEqual(variant(ai => { ai.summary = '常滑のコース別1着率は、進入したコースごとの割合として読み取ることが大切です。'; }), ['summary_repeats_definition', 'summary_without_finding']);
  // One or two findings in the summary are a recap; restating more of the body is still a repetition.
  assert.deepEqual(variant(ai => { ai.summary = 'この期間の常滑は、1コースの1着率が半分を超えていました。'; }), []);
  const three = ideal(); three.summary = '1コースの1着率は半分を超え、1コース以外では2コースの1着率が最も高く、4コースの1着率は3コースより高い期間でした。';
  assert.ok(check(compose(three, pack).document, pack).some(i => i.code === 'repeated_reading'));
  // An echoing answer in the dialogue.
  assert.deepEqual(variant(ai => { ai.sections[0].blocks[2].turns[1].text = 'そうだね。4コースの1着率10.0%が3コースの8.5%より上で、外の方が上なんだね。'; }), ['dialogue_echo']);
});

test('prompt blog-ai-v7: lead, glossary, DATA CHECK reasons, findings in the summary, title and lead framing', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v7');
  assert.ok(ARTICLE_SCHEMA.required.includes('lead'));
  const pack = v7Pack();
  const plan = articlePlan(pack);
  assert.deepEqual([plan.framing.title.key, plan.framing.hook.key, plan.framing.summary.map(r => r.key), plan.framing.basicsInLead], ['half:1', 'pair:4>3', ['half:1', 'pair:4>3'], true]);
  const prompt = buildInstructions(pack);
  assert.match(prompt, /lead（導入文）：本文の最初に置く1〜3文/);
  assert.match(prompt, /「4コースの1着率（10\.0%）は3コース（8\.5%）より高い」を種明かしせずに問いかけ/);
  assert.match(prompt, /タイトルで述べた発見は繰り返しません/);
  assert.match(prompt, /基本情報（水質・干満差など）は1文にまとめて導入に入れ/);
  assert.match(prompt, /号艇（枠番）と進入コースの違いは、rate_table より前の本文で1回だけ/);
  assert.match(prompt, /「・確認項目 ― 確認する理由」/);
  assert.match(prompt, /理由で展開・有利不利・結果を推測せず、スタート展示の進入を本番の進入と同じものとして書きません/);
  assert.match(prompt, /重要な発見を（readings の「1コースの1着率（61\.2%）は半分を超えている」「4コースの1着率（10\.0%）は3コース（8\.5%）より高い」）1〜2個/);
  assert.match(prompt, /相手の言葉を繰り返さず/);
  assert.match(prompt, /出典のない一般論は書きません/);
  const input = JSON.parse(buildInput(pack));
  assert.deepEqual(input.glossary, GLOSSARY);
  assert.equal(input.data_check_purposes.length, DATA_CHECK_PURPOSES.length);
  assert.match(input.data_check_purposes[1], /^・スタート展示の進入コース ― /);
  // The glossary and DATA CHECK wording bring no figure into an article.
  for (const text of [...GLOSSARY.map(g => g.text), ...input.data_check_purposes]) assert.deepEqual(claimsIn(text), [], text);
  // New packs are version 3; answers without a lead (earlier prompts) still compose.
  assert.equal(buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: () => new Date() }).version, 3);
  const old = ideal(); delete old.lead;
  assert.ok(!compose(old).document.blocks.some(b => b.data.placement === 'lead'));
});

test('wording: the exhibition is never the race entry, and past course rates never become a chance of winning today', () => {
  const kiryu = buildSourcePack({ topic: v3Topic, documents: [kiryuPageRow], now: () => new Date('2026-10-09T20:21:00Z') });
  const texts = [...GLOSSARY.map(g => `${g.term}：${g.text}`), ...DATA_CHECK_PURPOSES.map(dataCheckLine), buildInstructions(v7Pack()), buildInstructions({ ...kiryu, version: 3 }),
    ...compose(ideal()).document.blocks.flatMap(b => [b.data.text, ...(b.data.turns || []).map(t => t.text)]).filter(Boolean)];
  for (const text of texts) {
    // 「当てはめる」: using a past rate on today's race; 「勝つ確率／勝率」 only as a negation ("…ではない").
    assert.ok(!/当てはめ/.test(text), text.slice(0, 80));
    for (const m of text.matchAll(/[^。\n]*(勝つ確率|勝率)[^。\n]*/g)) assert.match(m[0], /ではない|ではありません|結びつけません|導きません/, m[0]);
    // Every mention of the exhibition's entry says the race may differ; none says it is fixed.
    assert.ok(!/(スタート)?展示[^。]{0,30}(進入|コース)[^。]{0,20}(確定|必ず|そのまま|確かめられる)/.test(text), text.slice(0, 80));
    for (const m of text.matchAll(/スタート展示[^。]*進入[^。]*。?/g)) if (!/^スタート展示の進入コース$/.test(m[0]))
      assert.match(m[0], /(変わることもある|同じになるとは限らない|参考|同じものとして書きません)/, m[0]);
  }
  const glossary = Object.fromEntries(GLOSSARY.map(g => [g.term, g.text]));
  assert.match(glossary['コース別1着率'], /過去の集計で、これからのレースで勝つ確率ではない/);
  assert.match(glossary['号艇（枠番）'], /レースごとに出走表で決まる/);
  assert.match(glossary['スタート展示'], /本番の進入が同じになるとは限らない/);
  assert.match(glossary['集計期間'], /変わることもある/);
  assert.equal(glossary['進入コース'], 'スタートのときに艇が実際に入った位置。内側から順に番号で呼び、号艇と同じとは限らない。');
});

test('the glossary and DATA CHECK wording in the docs match the code', async () => {
  const { readFile } = await import('node:fs/promises');
  const docs = await readFile(new URL('../../docs/blog/AI-QUALITY-REVIEW.md', import.meta.url), 'utf8');
  for (const g of GLOSSARY) assert.ok(docs.includes(`| ${g.term} | ${g.text} |`), g.term);
  for (const d of DATA_CHECK_PURPOSES) assert.ok(docs.includes(`| ${d.item} | ${d.reason} |`), d.item);
  assert.match(docs, /スタート展示の正式な定義.*公式資料で確認/);
  assert.match(docs, /直前情報の具体的な中身.*公式資料で確認できるまで/);
});

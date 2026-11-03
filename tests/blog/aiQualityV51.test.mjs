import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { catalogue } from './_aiFixtures.mjs';
import { todaV12Staging, kiryuV12Staging, todaV12Pack, kiryuV12Pack, todaV12Document, kiryuV12Document } from './_v12Staging.mjs';
import { todaV11Pack, todaV11Document } from './_todaV11.mjs';
import { todaPack } from './_todaV10.mjs';
import { v6Pack } from './_tokonameV6.mjs';
import { asV5, todaV5Pack, kiryuV5Pack, kiryuCourseTopic, todaTopic, todaV5Model, kiryuV5Model } from './_models50.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { comparisonFindings, rateStatements, dialogueContext } from '../../lib/blog/ai/dataReadings.mjs';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';
import { PROMPT_VERSION } from '../../lib/blog/ai/config.mjs';
import { scorecard } from '../../lib/blog/ai/scorecard.mjs';
import { articlePlan } from '../../lib/blog/ai/articlePlan.mjs';

const warnings = issues => [...new Set(issues.filter(i => i.level === 'warning' && i.code !== 'auto_cited').map(i => i.code))].sort();
const blocking = issues => issues.filter(i => i.level === 'blocking').map(i => i.code);
const check = (document, pack) => validateAiDocument({ document, pack });
const scores = (document, pack) => scorecard({ document, pack, issues: check(document, pack) }).axes.map(a => a.score);
const compose = (ai, pack, topic) => composeDocument({ ai, pack, topic, catalogue }).document;
const V5 = { extended: true };
const keys = (text, facts, options) => rateStatements(text, facts, options).map(st => st.key + (st.certain === false ? '?' : ''));
const verdict = (text, facts, options) => { const f = comparisonFindings(text, facts, options); return [f.certain.length, f.unclear.length]; };

// Postgres' jsonb text form (keys by length, then bytes; ", " and ": "), so md5(jsonb::text) can be checked locally.
const jsonbString = s => '"' + s.replace(/[\\"\u0000-\u001f]/g, c => ({ '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' })[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + '"';
const jsonbText = v => v === null ? 'null' : Array.isArray(v) ? `[${v.map(jsonbText).join(', ')}]` : typeof v === 'object'
  ? `{${Object.keys(v).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b))).map(k => `${jsonbString(k)}: ${jsonbText(v[k])}`).join(', ')}}`
  : typeof v === 'string' ? jsonbString(v) : String(v);
const md5 = v => createHash('md5').update(jsonbText(v)).digest('hex');

test('the v12 fixtures are the staging drafts themselves, unedited (pack, blocks, SEO and notes match staging\'s md5)', () => {
  for (const s of [todaV12Staging, kiryuV12Staging]) {
    assert.equal(md5(s.source_pack), s.md5.source_pack, `${s.slug}: source pack`);
    assert.equal(md5(s.validation), s.md5.validation, `${s.slug}: validation`);
    assert.equal(md5(s.seo), s.md5.seo, `${s.slug}: seo`);
    assert.deepEqual(s.blocks.map(b => md5(b.data)), s.md5.blocks, `${s.slug}: blocks`);
    assert.equal(s.edit_version, 1, 'never edited after generation');
    assert.equal(s.prompt_version, 'blog-ai-v12');
    assert.equal(s.source_pack.version, 5);
    assert.equal(s.source_pack.comparison.prompt_version, 'blog-ai-v12');
    assert.match(s.source_pack.sources[0].url, /^https:\/\/www\.boatrace\.jp\/owpc\/pc\/data\/stadium\?jcd=0[12]$/);
  }
  assert.equal(todaV12Pack.sources[0].fetched_at, '2026-10-12T06:36:02.919+00:00');
  assert.equal(kiryuV12Pack.sources[0].fetched_at, '2026-10-10T08:22:28.799+00:00');
});

test('v12 drafts (2026-10-18): the false notes are gone; the real dialogue fault is named; the comparison mark still blocks', () => {
  // What was recorded at generation (PHASE 5.0 checks).
  const recorded = s => s.validation.filter(i => i.code !== 'auto_cited').map(i => i.code).sort();
  assert.deepEqual(recorded(todaV12Staging), ['comparison_draft', 'dialogue_restates_partner', 'summary_repeats_definition']);
  assert.deepEqual(recorded(kiryuV12Staging), ['comparison_draft', 'summary_repeats_definition', 'summary_without_finding']);
  // Toda: 一果 answers with the reading ("…という意味ではない", "分けて見よう"), and the summary holds no definition: no note.
  const toda = check(todaV12Document, todaV12Pack);
  assert.deepEqual(blocking(toda), ['comparison_draft']);
  assert.deepEqual(warnings(toda), []);
  // Kiryu: the summary's findings ("半分を超えて", "2コースは13.2%、3コースは13.4%と、ほぼ並んで") are read; what remains is
  // 初音 saying the reading first ("数字の差は小さく見えます"), which left 一果 only saying it again.
  const kiryu = check(kiryuV12Document, kiryuV12Pack);
  assert.deepEqual(blocking(kiryu), ['comparison_draft']);
  assert.deepEqual(warnings(kiryu), ['speaker_preempts_answer']);
  assert.match(kiryu.find(i => i.code === 'speaker_preempts_answer').message, /初音の質問（差が小さい・ほぼ並ぶ、順位と差の大きさは別）と一果の答えが同じ読み方で終わっています/);
  const sc = scorecard({ document: kiryuV12Document, pack: kiryuV12Pack, issues: kiryu });
  assert.equal(sc.axes.find(a => a.key === 'explanation').score, 5, 'the three featured readings are all told');
  assert.equal(sc.axes.find(a => a.key === 'characters').score, 4);
});

test('the faults are still found: Toda v11 as a version 5 pack, and each fault put into a model article', () => {
  const v11 = check(todaV11Document, { ...asV5(todaV11Pack), comparison: todaV11Pack.comparison });
  assert.deepEqual(warnings(v11), ['ambiguous_direction', 'definition_repeated', 'dialogue_offtopic_close', 'dialogue_restates_partner', 'empty_closing', 'weak_connective']);
  const cases = [
    // An answer that only says the observation back.
    ['dialogue_restates_partner', ai => { ai.sections[1].blocks[0].turns[1].text = 'この集計期間では、1コースは6つの中で最も高い位置にあって、半分には届いていないね。'; }],
    // 初音 giving the reading before 一果 does.
    // 初音 giving the reading, and 一果 adding nothing to it: the exchange ends where it began.
    ['speaker_preempts_answer', ai => { ai.sections[1].blocks[0].turns[0].text = '1コースの1着率は42.8%で一番高いですね。でも、一番高いことと半分以上で1着になったことは別なんですよね？';
      ai.sections[1].blocks[0].turns[1].text = 'この期間の1着率は、一番高くても、半分以上のレースで1着になったという意味ではないんだ。'; }],
    // A summary with no finding of this article.
    ['summary_without_finding', ai => { ai.summary = '表を見るときは、それぞれのコースの数字を落ち着いて見比べてみてください。'; }],
    // The definition said again in the summary.
    ['summary_repeats_definition', ai => { ai.summary = 'この期間の戸田は、1コースが最も高くても半分には届かない期間でした。コース別1着率は、そのコースから進入した艇が1着になった割合です。'; }],
    // An empty closing.
    ['empty_closing', ai => { ai.summary += '表を見るときは、この並び方を特徴として捉えると、数字の位置づけを読み違えにくくなります。'; }],
  ];
  for (const [code, edit] of cases) {
    const ai = todaV5Model(); edit(ai);
    const issues = check(compose(ai, todaV5Pack, todaTopic), todaV5Pack);
    assert.ok(warnings(issues).includes(code), `${code}: ${warnings(issues)}`);
    assert.equal(blockingCount(issues), 0, `${code} never blocks`);
  }
  // A plain closing about reading the table is not a fault by itself when the summary tells this article's findings.
  const plain = todaV5Model();
  plain.summary = 'この期間の戸田は、1コースが最も高くても半分には届かない期間でした。また、外側のコースほど1着率が順に低く並んでいます。表では順位だけでなく、割合の大きさも分けて読み取ります。';
  assert.deepEqual(warnings(check(compose(plain, todaV5Pack, todaTopic), todaV5Pack)), []);
});

test('a sentence read with its block (version 5): never another course, figure, denied, quoted or other-subject claim; never for certain', () => {
  const toda = todaV12Pack.facts, kiryu = kiryuV12Pack.facts;
  // Read with the sentence before it, so its reading counts; checked against the data, but a reading in context is shown
  // for review only (never a blocking finding): right for Kiryu (54.7%), doubtful for Toda (42.8%).
  const follow = rate => `1コースの1着率は${rate}%でした。この期間に1コースから進入した艇が、半分を超えるレースで1着になりました。`;
  assert.deepEqual(keys(follow('54.7'), kiryu, V5), ['half:1?']);
  assert.deepEqual(verdict(follow('54.7'), kiryu, V5), [0, 0]);
  assert.deepEqual(verdict(follow('42.8'), toda, V5), [0, 1]);
  // A sentence with its own figure is checked as before, for certain.
  assert.deepEqual(verdict('1コースの1着率は42.8%で、半分を超えています。', toda, V5), [1, 0]);
  // Another course is that course (2コース 13.2% is not above half): doubtful, not taken for 1コース.
  assert.deepEqual(keys('1コースの1着率は54.7%でした。2コースから進入した艇が、半分を超えるレースで1着になりました。', kiryu, V5), ['half:2?']);
  assert.deepEqual(verdict('1コースの1着率は54.7%でした。2コースから進入した艇が、半分を超えるレースで1着になりました。', kiryu, V5), [0, 1]);
  // Another figure is never read as the 1着率.
  for (const text of ['1コースの1着率は42.8%でした。1コースの2連対率は半分を超えています。', '1コースの1着率は42.8%でした。決まり手では、1コースの逃げが半分を超えています。',
    '1コースの1着率は42.8%でした。1コースの3着率は最も高くなっています。', '1コースの1着率は42.8%でした。枠番別コース取得率では、1コースが半分を超えています。']) {
    assert.deepEqual(keys(text, toda, V5), [], text);
    assert.deepEqual(verdict(text, toda, V5), [0, 0], text);
  }
  // Another subject (another stadium, another period, general talk) is not carried over.
  for (const text of ['1コースの1着率は42.8%です。ところで、別の場では1コースが半分を超えることもあります。', '1コースの1着率は42.8%です。春季の集計では、1コースが半分を超えていました。',
    '1コースの1着率は42.8%です。一般に、1コースが半分を超える場もあります。']) {
    assert.deepEqual(keys(text, toda, V5), [], text);
    assert.deepEqual(verdict(text, toda, V5), [0, 0], text);
  }
  // A denied claim states nothing.
  assert.deepEqual(verdict('1コースの1着率は42.8%でした。1コースから進入した艇が、半分を超えるレースで1着になったわけではありません。', toda, V5), [0, 0]);
  // A quoted view the text reports and then answers: shown for review, never blocking.
  assert.deepEqual(verdict('1コースの1着率は42.8%でした。「1コースが半分を超える」という見方もありますが、この期間は違います。', toda, V5), [0, 1]);
  assert.deepEqual(verdict('「1着率は内側から順に並ばない」という見方もありますが、戸田のこの期間は1コースから6コースまで内側から順に高くなっています。', toda, V5), [0, 1]);
  // An order claim told of another stadium: review only (version 5).
  assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高くなっています。ところで、別の場では1着率が内側から順に並ばないこともあります。', toda, V5), [0, 1]);
  // Version 4 packs read as before: the following sentence alone is not read, and quoted or other-subject claims keep
  // their PHASE 4.9 reading.
  assert.deepEqual(keys(follow('42.8'), toda), []);
  assert.deepEqual(verdict('1着率は1コースから6コースまで内側から順に高くなっています。ところで、別の場では1着率が内側から順に並ばないこともあります。', toda), [1, 0]);
  // Claims read before PHASE 5.1 keep their certainty: an order told without a figure, in a block about the 1着率.
  assert.deepEqual(verdict('高い順に見ると、1コース、2コース、3コースの順です。1着率の表です。', v6Pack.facts, V5), [1, 0]);
  assert.deepEqual(verdict('高い順に見ると、1コース、2コース、3コースの順です。1着率の表です。', v6Pack.facts), [1, 0]);
  // Each block is read on its own: the context never comes from another block.
  assert.deepEqual(keys('この期間に1コースから進入した艇が、半分を超えるレースで1着になりました。', toda, V5), []);
});

test('quotation marks alone never change the severity: quoted claims are checked like plain ones, unless reported and answered', () => {
  const toda = todaV12Pack.facts;
  // The same wrong claim, with and without quotation marks, plain or as a character's words: blocking every time.
  for (const text of ['1コースの1着率は42.8%で、半分を超えています。', '「1コースの1着率は42.8%で、半分を超えています」。', '『1コースの1着率は42.8%で、半分を超えています』。',
    '一果は「1コースの1着率は42.8%で、半分を超えているよ」と説明しました。', '「1着率は内側から順に並ばない」のが戸田の特徴です。', '1着率は内側から順に並ばない、というのが戸田の特徴です。']) {
    assert.deepEqual(verdict(text, toda, V5), [1, 0], text);
    assert.deepEqual(verdict(text, toda), [1, 0], `${text} (version 4)`);
  }
  // A right claim stays right, quoted or not.
  for (const text of ['1コースの1着率は42.8%で、半分に届いていません。', '「1コースの1着率は42.8%で、半分に届いていません」。'])
    assert.deepEqual(verdict(text, toda, V5), [0, 0], text);
  // A character's line is checked like the body.
  const line = { type: 'DIALOGUE_SCENE', data: { turns: [{ character: 'ichika', text: '1コースの1着率は42.8%で、半分を超えているよ。' }] } };
  assert.deepEqual(verdict(line.data.turns[0].text, toda, { ...V5, ...dialogueContext(line) }), [1, 0]);
  // A wrong view reported and then denied or answered: review only.
  for (const text of ['1コースの1着率は42.8%でした。「1コースが半分を超える」という見方もありますが、この期間は違います。',
    '1コースの1着率は42.8%です。「1コースは半分を超える」と言われることもあります。この期間はそうではありません。',
    '「1着率は内側から順に並ばない」という見方もありますが、戸田のこの期間は1コースから6コースまで内側から順に高くなっています。'])
    assert.deepEqual(verdict(text, toda, V5), [0, 1], text);
  // Reported but not answered, with a course and a figure: checked as usual.
  assert.deepEqual(verdict('「1コースの1着率は42.8%で、半分を超える」という特徴がありますが、2コースは17.0%です。', toda, V5), [1, 0]);
});

test('speaker_preempts_answer: only an exchange that ends where it began; touching on the reading in the question is fine', () => {
  const pack = kiryuV5Pack;
  const withTurns = (asked, answer) => { const ai = kiryuV5Model(); ai.sections[2].blocks[0].turns = [{ character: 'hatsune', pose: 'pose3', text: asked }, { character: 'ichika', pose: 'pose1', text: answer }]; return check(compose(ai, pack, kiryuCourseTopic), pack); };
  // The question touches on the reading, the answer adds a distinction it did not give: fine.
  assert.ok(!warnings(withTurns('2コースが13.2%、3コースが13.4%で、差は小さく見えますね。この2つは、どう読めばいいんでしょうか？',
    'この期間の2コースと3コースの1着率は、順位は違っても、順位だけで差の大きさを判断しないでおこう。')).includes('speaker_preempts_answer'));
  // Kiryu v12: both say "the gap is small" and "rank is not the size of the gap": the exchange ends where it began.
  const v12 = kiryuV12Document.blocks.find(b => b.type === 'DIALOGUE_SCENE').data.turns;
  assert.ok(warnings(withTurns(v12[0].text, v12[1].text)).includes('speaker_preempts_answer'));
  // A question with figures only: never this note.
  assert.ok(!warnings(withTurns('2コースが13.2%、3コースが13.4%ですね。外側のほうが上、と読めばいいんですか？', v12[1].text)).includes('speaker_preempts_answer'));
  // Version 5 only, a review note only.
  const v4 = { ...pack, version: 4 };
  const ai = kiryuV5Model(); ai.sections[2].blocks[0].turns = v12.map(({ character, pose, text }) => ({ character, pose, text }));
  assert.ok(!warnings(check(compose(ai, v4, kiryuCourseTopic), v4)).includes('speaker_preempts_answer'));
  assert.equal(blockingCount(check(compose(ai, pack, kiryuCourseTopic), pack)), 0);
});

test('the new wordings of Kiryu v12 (version 5): "1コースから進入した艇の1着率が…半分を超え", figures then "ほぼ並ぶ", "半分以上には届かない"', () => {
  const kiryu = kiryuV12Pack.facts, toda = todaV12Pack.facts;
  assert.deepEqual(keys('この期間は、1コースから進入した艇の1着率が54.7%で、半分を超えていました。', kiryu, V5), ['half:1']);
  assert.deepEqual(keys('1コースの1着率は54.7%で、半分を超えています。', kiryu, V5), ['half:1']);
  assert.deepEqual(verdict('1コースの1着率は42.8%で、半分を超えています。', toda, V5), [1, 0], 'checked against the data');
  assert.deepEqual(keys('また、2コースは13.2%、3コースは13.4%と、ほぼ並んでいます。', kiryu, V5), ['near:2:3']);
  assert.deepEqual(verdict('2コースは13.2%、4コースは9.4%と、ほぼ並んでいます。', kiryu, V5), [0, 1], 'not near: shown for review');
  // The Toda v12 summary: its first sentence names no figure; the next one speaks of the 1着率.
  const summary = todaV12Document.blocks.find(x => x.data.placement === 'summary').data.text;
  // Its first sentence is read through the block (review only); the second has its own "1着率".
  assert.deepEqual(keys(summary, toda, V5).sort(), ['close:3:4', 'contrast:1?', 'sequence:in', 'top:1:高?', 'under_half:1?']);
  assert.deepEqual(verdict(summary, toda, V5), [0, 0]);
  assert.deepEqual(verdict('1コースの1着率は54.7%で、半分以上には届きませんでした。', kiryu, V5), [1, 0]);
  // Older packs keep their reading of these sentences.
  assert.deepEqual(keys('また、2コースは13.2%、3コースは13.4%と、ほぼ並んでいます。', kiryu), []);
});

test('prompt blog-ai-v13: the one asking gives figures and a question; the answer starts from the reading; summaries and takeaways fit the article', () => {
  assert.equal(PROMPT_VERSION, 'blog-ai-v14');
  const kiryu = buildInstructions(kiryuV12Pack), toda = buildInstructions(todaV12Pack);
  // The one asking: figures and a question that fits their expertise, never the reading.
  assert.match(kiryu, /初音は、気づいた数字と疑問だけを話し、一果が答える読み方や結論（「差は小さい」「ほぼ同じ」「半分以上ではない」など）を先に言いません/);
  assert.match(kiryu, /質問は初音の得意なこと（[^）]+）に合った具体的なものにし、毎回初心者のふりをした質問にはしません/);
  assert.match(kiryu, /初音の役割：気づいた数字について、データの読み解きに関わる具体的な疑問を丁寧に質問する/);
  assert.doesNotMatch(kiryu, /初音の役割：初心者が抱きそうな疑問/);
  // The answer: from the reading, not saying the figures back.
  assert.match(kiryu, /一果は、相手の数字や発言を受け直す書き出し（「そうだね」「〇〇は△%だね」など）にせず、読み方から答えます/);
  assert.doesNotMatch(kiryu, /「そうだね。でも、/);
  // Summary: this article's findings, no fixed form or closing.
  assert.match(kiryu, /文の数や形は内容に合わせ、決まった型にしません/);
  assert.match(kiryu, /「順位と数字の大きさを分けて読む」のような読み方の一般論で締める必要はありません/);
  assert.doesNotMatch(kiryu, /締めの文は、読者が表を読むときに区別すること（例：順位と数字の大きさ）を具体的に書き/);
  assert.doesNotMatch(kiryu, /summary：1〜2文/);
  // Takeaways: the topics the discoveries' sections cover.
  assert.match(kiryu, /例：「1コースの数字の読み方」「2コースと3コースの数字の読み方」/);
  assert.match(toda, /例：「1コースの数字の読み方」「6つのコースの並び方」/);
  // The basics are not pushed into the lead.
  assert.match(kiryu, /水質・干満差など）は、この記事の発見の話に必要なときだけ書きます。導入に機械的に足したり、問いの後に付け足したりしません/);
  assert.doesNotMatch(kiryu, /1文にまとめて導入に入れ/);
  // Older packs (no discoveries) keep their prompt.
  const old = buildInstructions(todaPack);
  assert.match(old, /facts の基本情報（水質・干満差など）は1文にまとめて導入に入れ/);
  assert.match(old, /summary：1〜2文/);
  assert.match(old, /初音の役割：初心者が抱きそうな疑問/);
});

test('Kiryu\'s dialogue topic stays: the plan is unchanged and a model on the official pack shows it can carry a good exchange', () => {
  // The plan for the real v12 pack: 1コース above half in the body, 2コース and 3コース nearly level in the dialogue (初音).
  const plan = articlePlan(kiryuV12Pack);
  assert.deepEqual(plan.discoveries.map(d => `${d.main.key}${d.also.map(a => `+${a.key}`).join('')}@${d.place}`), ['half:1@body', 'near:2:3+except:3:高@dialogue']);
  assert.equal(plan.speaker, 'hatsune');
  // With 初音 giving the figures and a question, and 一果 the reading, the same topic raises no note.
  const document = compose(kiryuV5Model(), kiryuV5Pack, kiryuCourseTopic), issues = check(document, kiryuV5Pack);
  assert.deepEqual(warnings(issues), []);
  assert.deepEqual(scores(document, kiryuV5Pack), [5, 5, 5, 5, 5, 5, 5]);
  // The v12 exchange on the same pack is noted.
  assert.ok(warnings(check(kiryuV12Document, kiryuV12Pack)).includes('speaker_preempts_answer'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogue } from './_aiFixtures.mjs';
import { KIRYU_PAGE, kiryuTopic, kiryuPageRow, storedPack, storedDocument, kiryuAi, correctedAi } from './_kiryuRegression.mjs';
import { parseStadiumDataPage, withoutTableCells } from '../../lib/blog/ai/officialStadiumData.mjs';
import { claimsIn } from '../../lib/blog/ai/claims.mjs';
import { buildSourcePack } from '../../lib/blog/ai/sourcePack.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';

const KIRYU = { name: '桐生', courseCode: 1 };
const blocking = issues => issues.filter(i => i.level === 'blocking');
const codes = issues => blocking(issues).map(i => i.code).sort();
const compose = (ai, pack) => composeDocument({ ai, pack, topic: kiryuTopic, catalogue, coverMediaId: randomUUID(), coverAlt: '表紙' });
const freshPack = (documents = [kiryuPageRow]) => buildSourcePack({ topic: kiryuTopic, documents, now: () => new Date('2026-10-09T20:21:00Z') });

test('official page: course placement rates, periods and memo are read exactly as published', () => {
  const page = parseStadiumDataPage(KIRYU_PAGE, KIRYU);
  assert.equal(page.ok, true, page.reason);
  assert.deepEqual(page.recent.period, { from: '2026/07/01', to: '2026/09/30' });
  assert.deepEqual(page.recent.rows.map(r => r.rates[0]), ['54.7', '13.2', '13.4', '9.4', '6.8', '3.0']);
  assert.deepEqual(page.recent.rows[0].rates, ['54.7', '17.1', '7.6', '8.4', '6.9', '5.0']);
  assert.deepEqual(page.seasons.map(s => [s.label, s.period.from, s.period.to]), [
    ['春季', '2026/03/01', '2026/05/31'], ['夏季', '2026/06/01', '2026/08/31'], ['秋季', '2025/09/01', '2025/11/30'], ['冬季', '2025/12/01', '2026/02/28']]);
  assert.deepEqual(page.memo, { waterType: '淡水', tide: 'なし' });
  const free = withoutTableCells(KIRYU_PAGE);
  assert.ok(!/^54\.7$/m.test(free) && !/集計期間/.test(free), 'no bare table cells or table periods in the free text');
  assert.match(free, /コース別入着率&決まり手/);
});

test('official page: a changed table layout fails safely with a reason and no numbers', () => {
  const variants = {
    header: KIRYU_PAGE.replace('コース別決まり手\n逃げ', 'コース別決まり手\n逃げ切り'),
    shifted: KIRYU_PAGE.replace('1\n54.7\n17.1\n', '1\n54.7\n'),
    nonNumeric: KIRYU_PAGE.replace('1\n54.7\n', '1\n-\n'),
    noPeriod: KIRYU_PAGE.replace('（集計期間：2026/07/01～2026/09/30 単位：％）\n枠番別', '枠番別'),
    badSum: KIRYU_PAGE.replace('1\n54.7\n', '1\n94.7\n'),
    otherStadium: KIRYU_PAGE.replaceAll('桐 生ボートレース場', '戸 田ボートレース場'),
    noTable: KIRYU_PAGE.replace('コース別入着率＆決まり手', 'コース別成績'),
  };
  for (const [name, text] of Object.entries(variants)) {
    const page = parseStadiumDataPage(text, KIRYU);
    assert.equal(page.ok, false, name);
    assert.ok(page.reason && !('recent' in page), name);
  }
  // A broken seasonal table is skipped (and reported) without affecting the recent table.
  const season = parseStadiumDataPage(KIRYU_PAGE.replace('春季 のコース別入着率\nコース\n1着', '春季 のコース別入着率\nコース\n1位'), KIRYU);
  assert.equal(season.ok, true); assert.equal(season.seasons.length, 3); assert.match(season.skipped[0], /春季/);
});

test('source pack: the fetched official page replaces the repository course rates and never mixes periods', () => {
  const pack = freshPack();
  const [repo, page] = pack.sources;
  assert.equal(repo.kind, 'repository_dataset'); assert.equal(repo.period, undefined); assert.match(repo.label, /^BoatStrikers収録データ/);
  assert.equal(page.kind, 'official_data'); assert.equal(page.fetched_at, kiryuPageRow.fetched_at); assert.equal(page.content_sha256, kiryuPageRow.content_sha256);
  assert.equal(page.url, 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01');
  const firsts = pack.facts.filter(f => /コース1着率$/.test(f.label));
  assert.deepEqual(firsts.map(f => [f.value, f.source_id, f.period]), ['54.7', '13.2', '13.4', '9.4', '6.8', '3.0'].map(v => [v, 'S2', '2026/07/01〜2026/09/30']));
  assert.ok(!pack.facts.some(f => f.value === '52.2'), 'the repository period 2026/05〜07 is not mixed in');
  assert.deepEqual(pack.facts.filter(f => f.source_id === 'S1').map(f => f.value), ['ナイター']);
  assert.deepEqual({ ...pack.official, placements: undefined }, { source_id: 'S2', status: 'parsed', period: '2026/07/01〜2026/09/30', skipped: [], placements: undefined });
  assert.deepEqual(pack.official.placements[0], { course: 1, rates: ['54.7', '17.1', '7.6', '8.4', '6.9', '5.0'] });
  assert.ok(!pack.facts.some(f => /[2-6]着率$/.test(f.label)), 'other placements are recorded but are not evidence');
  assert.deepEqual(pack.gaps, []);
  assert.ok(!/^54\.7$/m.test(pack.documents[0].excerpt));
});

test('source pack: an unreadable official table keeps the dated repository data, flags it, and offers no page numbers', () => {
  const pack = freshPack([{ ...kiryuPageRow, extracted_text: KIRYU_PAGE.replace('1\n54.7\n', '1\n-\n') }]);
  assert.equal(pack.official.status, 'unreadable'); assert.match(pack.official.reason, /1コース/);
  assert.equal(pack.sources[0].period, '2026/05/01〜2026/07/31');
  assert.ok(pack.facts.some(f => f.value === '52.2' && f.source_id === 'S1'));
  assert.ok(!pack.facts.some(f => f.source_id === 'S2'));
  assert.deepEqual(pack.gaps, ['official_table_unreadable']);
  const issues = validateAiDocument({ document: compose(kiryuAi(), pack).document, pack });
  assert.ok(issues.some(i => i.code === 'official_table_unreadable' && i.level === 'warning' && /2026\/05\/01〜2026\/07\/31/.test(i.message)));
  // Numbers printed in the unreadable table are not evidence for anything.
  assert.deepEqual(codes(validateAiDocument({ document: compose(correctedAi(), pack).document, pack })).filter((c, i, a) => a.indexOf(c) === i), ['unsupported_date', 'unsupported_number']);
});

test('source pack: other stadiums and categories keep their repository data unchanged', () => {
  const toda = buildSourcePack({ topic: { ...kiryuTopic, topic_key: 'stadium-basics:toda:water', stadium_slug: 'toda' }, now: () => new Date() });
  assert.equal(toda.sources.length, 1); assert.equal(toda.sources[0].period, '2026/05/01〜2026/07/31');
  assert.equal(toda.facts.length, 9); assert.equal(toda.facts[3].value, '38.7'); assert.deepEqual(toda.gaps, []);
  const lab = buildSourcePack({ topic: { topic_key: 'data-lab:inside-24', category_slug: 'data-lab', stadium_slug: null, angle: 'inside-24', title_hint: '24場の1コース1着率を並べて見る' }, now: () => new Date() });
  assert.equal(lab.sources.length, 24); assert.equal(lab.facts.length, 24 * 9);
  // A stadium page fetched for a charm article only loses its bare table cells; no data facts are added.
  const charm = buildSourcePack({ topic: { ...kiryuTopic, category_slug: 'stadium-charm', angle: 'facilities' }, documents: [kiryuPageRow], now: () => new Date() });
  assert.deepEqual(charm.facts, []); assert.equal(charm.documents.length, 1); assert.ok(!/^54\.7$/m.test(charm.documents[0].excerpt));
});

test('claims: dates are read whole, numbers stay numbers', () => {
  const dates = text => claimsIn(text).filter(c => c.kind === 'date').map(c => [c.year, c.month, c.day]);
  const numbers = text => claimsIn(text).filter(c => c.kind === 'number').map(c => c.label);
  assert.deepEqual(dates('2026年5月1日から7月31日集計'), [[2026, 5, 1], [2026, 7, 31]]);
  assert.deepEqual(numbers('2026年5月1日から7月31日集計'), []);
  assert.deepEqual(dates('2026/05/01〜2026/07/31'), [[2026, 5, 1], [2026, 7, 31]]);
  assert.deepEqual(dates('2026年5月から7月'), [[2026, 5, undefined], [2026, 7, undefined]]);
  assert.deepEqual(dates('２０２６年５月１日'), [[2026, 5, 1]]);
  assert.deepEqual(numbers('1コース1着率は52.2％、1.42.8のレコード'), ['52.2', '1.42.8']);
  assert.deepEqual(numbers('13月1日'), ['13', '1']); // not a date, so both parts are checked as numbers
});

test('regression (Kiryu draft 2026-10-10): stored draft — dates and the heading no longer produce false alarms, uncited blocks still do', () => {
  const issues = validateAiDocument({ document: storedDocument, pack: storedPack });
  // Before: 11 blocking issues (each date part 2026/5/1/7/31 counted twice, plus 52.2 in the heading).
  assert.deepEqual(codes(issues), ['missing_source', 'missing_source']);
  const [takeaways, summary] = blocking(issues);
  assert.match(takeaways.message, /^ブロック1（LIST）：数値・日付「2026年5月1日」「7月31日」を使っていますが、出典が設定されていません。$/);
  assert.match(summary.message, /^ブロック17（TEXT）/);
  assert.ok(!issues.some(i => /ブロック6（HEADING）/.test(i.message)), '52.2 in the heading is backed by the cited blocks of its section');
});

test('regression (Kiryu draft 2026-10-10): the same answer composed now is cited automatically and reports nothing to fix', () => {
  const { document, issues: composeIssues } = compose(kiryuAi(), storedPack);
  assert.deepEqual(document.blocks[0].data.source_ids, ['S1']);
  assert.deepEqual(document.blocks[16].data.source_ids, ['S1']);
  assert.deepEqual(composeIssues.filter(i => i.code === 'auto_cited').map(i => i.message.split('：')[0]), ['ブロック1（LIST）', 'ブロック17（TEXT）']);
  assert.equal(blockingCount(validateAiDocument({ document, pack: storedPack })), 0);
});

test('regression (Kiryu draft 2026-10-10): rebuilt from the page fetched that day, the stale 2026/05〜07 figures are blocked', () => {
  const pack = freshPack();
  const issues = validateAiDocument({ document: compose(kiryuAi(), pack).document, pack });
  const block7 = blocking(issues).find(i => i.message.startsWith('ブロック7（TEXT）') && i.code === 'unsupported_number');
  assert.ok(block7, JSON.stringify(blocking(issues)));
  assert.match(block7.message, /「52\.2」「12\.7」「14\.4」「10\.6」「7\.6」「3\.1」/);
  assert.ok(blocking(issues).some(i => i.code === 'unsupported_date' && /2026年5月1日/.test(i.message)));
  assert.ok(blocking(issues).some(i => i.message.startsWith('ブロック6（HEADING）')), 'heading 52.2 is no longer backed');
});

test('regression (Kiryu draft 2026-10-10): the answer written from the fetched figures passes with automatic citations', () => {
  const pack = freshPack();
  const { document, issues: composeIssues } = compose(correctedAi(), pack);
  assert.deepEqual(document.blocks[0].data.source_ids, ['S2']);
  assert.ok(composeIssues.some(i => i.code === 'auto_cited'));
  const issues = validateAiDocument({ document, pack });
  assert.equal(blockingCount(issues), 0, JSON.stringify(blocking(issues)));
});

test('period, source and heading mismatches stay blocking and are grouped per block', () => {
  const pack = freshPack();
  const base = compose(correctedAi(), pack).document;
  const check = mutate => { const d = structuredClone(base); mutate(d); return validateAiDocument({ document: d, pack }); };
  // Course rate of 2026/07〜09 written with another date of the same page → period mismatch.
  let issues = check(d => { d.blocks[6].data.text = '2026年6月30日時点の1コース1着率は54.7％です。'; });
  assert.deepEqual(codes(issues), ['period_mismatch']);
  assert.match(blocking(issues)[0].message, /ブロック7（TEXT）：日付「2026年6月30日」が、同じブロックの数値の集計期間（2026\/07\/01〜2026\/09\/30）と一致しません。/);
  // The repository period with today's figures → the date is backed by nothing any more.
  assert.deepEqual(codes(check(d => { d.blocks[6].data.text = '2026年5月1日から7月31日の1コース1着率は54.7％です。'; })), ['unsupported_date']);
  // A fetched figure cited to the repository source → source mismatch.
  issues = check(d => { d.blocks[6].data = { ...d.blocks[6].data, source_ids: ['S1'], text: '1コース1着率は54.7％です。' }; });
  assert.deepEqual(codes(issues), ['source_mismatch']); assert.match(blocking(issues)[0].message, /設定された出典（S1）/);
  // Heading number not repeated in its section → blocked even though the figure exists.
  issues = check(d => { d.blocks[5].data.text = '2コース1着率は13.2％'; d.blocks[6].data.text = '1コース1着率は54.7％です。'; d.blocks[7].data.items = ['1コース：54.7％']; });
  assert.deepEqual(codes(issues), ['heading_unsupported']);
  // Removing a citation after composing → missing source; unknown figures → one grouped issue listing all of them.
  issues = check(d => { delete d.blocks[6].data.source_url; });
  assert.deepEqual(codes(issues), ['missing_source']);
  issues = check(d => { d.blocks[7].data.items = ['1コース：61.0％', '2コース：12.0％', '3コース：11.1％']; });
  assert.deepEqual(codes(issues), ['unsupported_number']);
  assert.match(blocking(issues)[0].message, /「61\.0」「12\.0」「11\.1」/);
});

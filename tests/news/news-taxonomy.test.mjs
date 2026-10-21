import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNewsBucket, cleanNewsHeadline, newsHeadline, normalizeNewsTab,
  parseNewsSearchTerms, buildNewsSearchFilter, buildNewsSearchQuery, selectFeaturedNews, formatNewsShortDate,
} from '../../lib/newsTaxonomy.js';

test('existing category URLs are accepted, unknown values fall back to main', () => {
  for (const key of ['all', 'bs', 'women', 'grade', 'focus', 'result', 'racer']) assert.equal(normalizeNewsTab(key), key);
  assert.equal(normalizeNewsTab('media'), 'all');
  assert.equal(normalizeNewsTab('unknown'), 'all');
  assert.equal(normalizeNewsTab(undefined), 'all');
});

test('DB category grade with a grade race in the text stays SG・G1', () => {
  assert.equal(classifyNewsBucket({ category: 'grade', title: '【ボートレース】末永和也が２日目連勝／三国G1 [19:57]' }), 'grade');
  assert.equal(classifyNewsBucket({ category: 'topic', title: '【ボートレース】守屋美穂が笑顔でアピール／大村G1 - ボート : 日刊スポーツ' }), 'grade');
});

test('DB category grade without a grade race is not shown as SG・G1', () => {
  assert.equal(classifyNewsBucket({ category: 'grade', title: '初のA1昇格ほぼ確実の平川香織に注目/下関・ヴィーナスシリーズ' }), 'racer');
  assert.equal(classifyNewsBucket({ category: 'grade', title: '【ボートレース】宮崎隆太郎の相棒14号機はエース候補／蒲郡 [21:21]' }), 'all');
});

test('other buckets keep the previous priority order', () => {
  assert.equal(classifyNewsBucket({ category: 'result', title: '徳山9R 9Rの結果を更新' }), 'result');
  assert.equal(classifyNewsBucket({ category: 'women', title: '滝川真由子が初日のオール女子戦制す' }), 'women');
  assert.equal(classifyNewsBucket({ category: 'motor', title: 'びわこの高モーター' }), 'focus');
  assert.equal(classifyNewsBucket({ category: 'suijinsai', title: '水神祭' }), 'racer');
});

test('headline cleanup removes only source boilerplate', () => {
  assert.equal(cleanNewsHeadline('【ボートレース】大滝明日香が好調機味方に白星「競ってみてどうか」／下関ミッド - ボート : 日刊スポーツ'), '大滝明日香が好調機味方に白星「競ってみてどうか」／下関ミッド');
  assert.equal(cleanNewsHeadline('舟足断然の魚谷香織が優勝戦ポールポジション | ボートレース（競艇）【マクール】'), '舟足断然の魚谷香織が優勝戦ポールポジション');
  assert.equal(cleanNewsHeadline('【ボートレース】峰竜太はファイナル５枠「優勝だけ狙っていきます」／津3Days [19:13]'), '峰竜太はファイナル５枠「優勝だけ狙っていきます」／津3Days');
  assert.equal(cleanNewsHeadline('【9月10日】ボートレース結果まとめ｜万舟・事故・優勝戦'), '【9月10日】ボートレース結果まとめ｜万舟・事故・優勝戦');
  assert.equal(cleanNewsHeadline('明日の女子ボートNEWS｜2026-09-05の出走表をチェック'), '明日の女子ボートNEWS｜2026-09-05の出走表をチェック');
});

test('headline cleanup keeps the original when too little would remain', () => {
  assert.equal(cleanNewsHeadline('【ボートレース】速報 [19:13]'), '【ボートレース】速報 [19:13]');
  assert.equal(newsHeadline({ list_headline: '9月10日結果｜万舟15本・最高44,140円', title: '長いタイトル' }), '9月10日結果｜万舟15本・最高44,140円');
  assert.equal(newsHeadline({}), 'ニュース');
});

test('search terms are split for AND search and stripped of filter syntax', () => {
  assert.deepEqual(parseNewsSearchTerms('  大山千広　芦屋 '), ['大山千広', '芦屋']);
  assert.deepEqual(parseNewsSearchTerms('a,b(c).d:e"f*%_'), ['abcdef']);
  assert.deepEqual(parseNewsSearchTerms('*** ,,,'), []);
  assert.equal(parseNewsSearchTerms('1 2 3 4 5 6 7').length, 5);
  assert.equal(buildNewsSearchFilter('峰竜太'), 'title.ilike.*峰竜太*,list_headline.ilike.*峰竜太*,summary.ilike.*峰竜太*,article_body.ilike.*峰竜太*,source_name.ilike.*峰竜太*,place.ilike.*峰竜太*');
});

test('multiple search terms are combined with AND', () => {
  assert.equal(buildNewsSearchQuery([]), '');
  assert.equal(buildNewsSearchQuery(['峰竜太']), buildNewsSearchFilter('峰竜太'));
  assert.equal(buildNewsSearchQuery(['峰竜太', '津']), `and(or(${buildNewsSearchFilter('峰竜太')}),or(${buildNewsSearchFilter('津')}))`);
});

test('featured selection prefers recent manual features', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  const entries = [
    { id: 1, publishedAt: '2026-10-12T11:00:00Z', bucket: 'result', featured: false, priority: 0 },
    { id: 2, publishedAt: '2026-10-12T08:00:00Z', bucket: 'grade', featured: true, priority: 8 },
  ];
  assert.equal(selectFeaturedNews(entries, now).id, 2);
  assert.equal(selectFeaturedNews([], now), null);
});

test('short dates use Japan time regardless of server time zone', () => {
  assert.equal(formatNewsShortDate('2026-10-11T16:30:00Z'), '10/12');
  assert.equal(formatNewsShortDate(null), '');
});

import {
  isWomenNews, isBsDataNews, matchesNewsTab, assignNewsCharacter, describeNewsCharacterReason,
  newsCharacterNote, normalizeNewsCharacter, toNewsIndexEntry, toNewsListItem, newsDayLabel, NEWS_TABS,
} from '../../lib/newsTaxonomy.js';

const BOILER_SUMMARY = '日刊スポーツで掲載された女子ボートレース関連ニュースです。初音NEWSでは元記事の内容を転載せず、確認できる事実をもとに注目ポイントを初音の視点で整理します。';
const BOILER_BODY = '開催地に関する今回の情報は、女子戦をチェックするうえで見逃せない材料のひとつです。女子ボートレースを追ううえで押さえておきたいニュースです。';

test('tab keys stay URL compatible and BS DATA keeps the bs key', () => {
  assert.deepEqual(NEWS_TABS.map((t) => t.key), ['all', 'result', 'women', 'grade', 'focus', 'racer', 'bs', 'media']);
  assert.equal(NEWS_TABS.find((t) => t.key === 'bs').label, 'BS DATA');
});

test('category=women is always women news', () => {
  assert.equal(isWomenNews({ category: 'women', title: '岡本亜子が３着で初の舟券絡み' }), true);
});

test('clear women keywords in headline or non-boilerplate text count', () => {
  assert.equal(isWomenNews({ category: 'topic', title: '三国ヴィーナスシリーズ第11戦が開幕' }), true);
  assert.equal(isWomenNews({ category: 'result', title: '徳山9R 9Rの結果を更新', summary: '徳山9Rで、女子戦のレース結果が確定しました。' }), true);
});

test('collector boilerplate alone does not make an article women news', () => {
  assert.equal(isWomenNews({ category: 'win', title: '四宮与寛が逃げ切って今年２度目Ｖ／戸田', summary: BOILER_SUMMARY, article_body: BOILER_BODY }), false);
});

test('BS DATA is decided by source_type only', () => {
  assert.equal(isBsDataNews({ source_type: 'bs_data' }), true);
  assert.equal(isBsDataNews({ source_type: 'news', source_name: 'BoatStrikers レースDB' }), false);
});

test('tab matching: women and bs cut across display categories', () => {
  const entry = toNewsIndexEntry({ id: 1, category: 'result', source_type: 'bs_data', title: '徳山9R 9Rの結果を更新', summary: '女子戦のレース結果が確定しました。' });
  assert.equal(entry.bucket, 'result');
  for (const tab of ['all', 'result', 'women', 'bs']) assert.equal(matchesNewsTab(entry, tab), true, tab);
  for (const tab of ['grade', 'focus', 'racer']) assert.equal(matchesNewsTab(entry, tab), false, tab);
});

test('characters are only assigned when the article matches', () => {
  assert.equal(assignNewsCharacter({ title: '宮地元輝が圧巻の初日DR1周2Mで豪快ツケマイの逆転勝ち／下関ミッド' }), null);
  assert.equal(assignNewsCharacter({ title: '優勝戦１枠は白神優 通算17度目Ｖへ／戸田' }).key, 'ichika');
  assert.equal(assignNewsCharacter({ title: '10月11日結果｜万舟27本・最高147,880円' }).key, 'kiina');
  assert.equal(assignNewsCharacter({ title: '四宮与寛が逃げ切って今年２度目Ｖ', summary: BOILER_SUMMARY, article_body: BOILER_BODY }).key, 'ichika');
});

test('multiple matches follow the documented priority and explain why', () => {
  const a = assignNewsCharacter({ title: '女子戦で万舟、インから逃げ切り' });
  assert.equal(a.key, 'hatsune');
  assert.deepEqual(a.others.map((m) => m.key), ['kiina', 'ichika']);
  const reason = describeNewsCharacterReason(a);
  assert.match(reason, /初音が担当/);
  assert.match(reason, /キイナ/);
  assert.match(reason, /優先順位（初音→キイナ→一果）/);
  assert.equal(describeNewsCharacterReason(null), '');
});

test('character note is a fixed guide now, and can switch to a per-article comment later', () => {
  assert.deepEqual(newsCharacterNote('ichika'), { kind: 'guide', label: '編集部の案内', text: '1枠・イン戦に関するニュースは、ここからまとめて読めます。' });
  assert.equal(newsCharacterNote('kiina', { text: 'テスト' }).kind, 'comment');
  assert.equal(newsCharacterNote('nobody'), null);
  assert.equal(normalizeNewsCharacter('hatsune'), 'hatsune');
  assert.equal(normalizeNewsCharacter('<script>'), '');
});

test('list items reuse index classification so counts and lists agree', () => {
  const row = { id: 9, category: 'topic', title: '見出し', summary: '要約' };
  const entry = { id: 9, bucket: 'women', character: 'hatsune', characterReason: '本文に「女子」を含むため初音が担当' };
  const item = toNewsListItem(row, entry);
  assert.equal(item.bucket, 'women');
  assert.equal(item.character, 'hatsune');
  assert.equal('characterReason' in item, false, 'assignment reason stays internal');
});

test('date separators label today and yesterday in Japan time', () => {
  const now = Date.parse('2026-10-12T05:30:00Z');
  assert.equal(newsDayLabel('2026-10-12T05:00:00Z', now), '今日 10月12日(月)');
  assert.equal(newsDayLabel('2026-10-11T13:00:00Z', now), '昨日 10月11日(日)');
  assert.equal(newsDayLabel('2026-10-10T13:00:00Z', now), '10月10日(土)');
});

test('SG/G1 inside a quoted comment does not make the SG・G1 category', () => {
  assert.notEqual(classifyNewsBucket({ category: 'result', title: '【ボートレース】野中一平がイン速攻でＶ「記念を取りたいしSGも取りたい」／津3Days [19:40]' }), 'grade');
  assert.equal(classifyNewsBucket({ category: 'grade', title: '【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [19:19]' }), 'grade');
});

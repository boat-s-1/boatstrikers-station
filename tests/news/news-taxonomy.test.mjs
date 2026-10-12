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

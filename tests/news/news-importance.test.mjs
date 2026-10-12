import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectNewsEvent, detectNewsGrade, scoreNewsImportance, selectNewsHighlights, newsTopicKey,
  normalizeNewsSourceUrl, newsDuplicateKey, groupDuplicateNews, NEWS_KEY_THRESHOLD,
} from '../../lib/newsImportance.js';
import { buildNewsIndex, selectNewsListing, listNewsEvents } from '../../lib/newsListing.js';
import { cleanNewsHeadline } from '../../lib/newsTaxonomy.js';

// 見出しは本番 hatsune_news の公開記事（2026/10/05〜10/12）から引用。
const news = (title, extra = {}) => ({ source_type: 'news', source_name: '日刊スポーツ', title, ...extra });
const type = (item) => detectNewsEvent(item).type;

test('completed wins are detected from real headlines', () => {
  for (const title of [
    '【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [21:10]',
    '【ボートレース】絶好枠の守田俊介がイン逃げを決めて今年３度目の優勝／若松ミッド [0:10]',
    '【ボートレース】平川香織が豪快逃げで通算２度目V「もっとたくさん優勝して頑張りたい」／下関 - ボート : 日刊スポーツ',
    '【ボートレース】「住之江はめっちゃ好きです」奈須啓太が今年初優勝／住之江 [20:00]',
    '【ボートレース】地元の意地にかけて井本昌也がＶもぎ取る！「徳山初優勝したい」／徳山 [19:00]',
    '【ボートレース】武田光史48度目の優勝「ネームバリューある選手もいて緊張した」／尼崎 [19:00]',
  ]) assert.equal(type(news(title)), 'win', title);
});

test('previews, misses and motor names are not wins', () => {
  for (const title of [
    '【ボートレース】優勝戦１枠は白神優 通算17度目Ｖへ持ち前のスタート力を発揮する／戸田 [18:12]',
    '【ボートレース】田口節子が今年４度目Ｖへテクニックフル発揮「乗り心地は許容範囲」／江戸川 - ボート : 日刊スポーツ',
    '【ボートレース】山口真喜子「回った一瞬いいし伸び返してる」初Ｖ目指して超パンチ仕様／江戸川 - ボート : 日刊スポーツ',
    '【ボートレース】藤原菜希１月Ｖ逸の雪辱へ「安定板装着でも対応できる足にはできている」江戸川 - ボート : 日刊スポーツ',
    '【ボートレース】米丸乃絵は２度目の優勝ならず「調整を失敗。重たくて進んでなかった」／大村 [22:08]',
    '【ボートレース】菅野はやか前節Ｖ機で好発進目指す「いいエンジンなら頑張りたい」／江戸川 - ボート : 日刊スポーツ',
    '【ボートレース】鋤柄貴俊がG1優勝機をゲット「１人で乗っている分には押している」／児島 [19:00]',
    '「師匠と一緒にSGに行きたい」大山千広が今年5回目の優勝へ気合十分 | ボートレース（競艇）【マクール】',
  ]) assert.notEqual(type(news(title)), 'win', title);
  assert.equal(type(news('【ボートレース】優勝戦１枠は白神優 通算17度目Ｖへ持ち前のスタート力を発揮する／戸田 [18:12]')), 'final');
  assert.equal(type(news('【ボートレース】米丸乃絵は２度目の優勝ならず「調整を失敗。重たくて進んでなかった」／大村 [22:08]')), 'final');
});

test('incidents need concrete facts; a flying mentioned in a quote is not an incident', () => {
  const verified = news('【ボートレース】大神康司が優勝戦でフライング 約52％が返還／若松ミッド [0:37]', {
    summary: '若松ミッドの優勝戦11Rで、3号艇の大神康司がコンマ01のフライング。発売額2億3728万1500円のうち、1億2226万4300円、約52％が返還となった。',
  });
  assert.equal(type(verified), 'incident');
  assert.ok(scoreNewsImportance(verified).score >= NEWS_KEY_THRESHOLD);
  assert.notEqual(type(news('【ボートレース】浜野孝志G1優勝機引き当てるも複雑な表情「前節フライング切ってなければ」大村 [19:00]')), 'incident');
  assert.notEqual(type(news('【ボートレース】優勝戦でフライング／若松')), 'incident', 'no figures to confirm');
});

test('SG・G1 words alone do not make an article top importance', () => {
  const g1Talk = scoreNewsImportance(news('【ボートレース】鋤柄貴俊がG1優勝機をゲット「１人で乗っている分には押している」／児島 [19:00]'));
  const sgColumn = scoreNewsImportance(news('SGチャレンジカップ盛り上げ企画 松本日向コラム 第２回／常滑ボート [7:01]'));
  const sales = scoreNewsImportance(news('【ボートレース】総売り上げは65億2620万5800円、目標の65億円をクリア／三国G1 [22:00]'));
  const generalWin = scoreNewsImportance(news('【ボートレース】絶好枠の守田俊介がイン逃げを決めて今年３度目の優勝／若松ミッド [0:10]'));
  const g1Win = scoreNewsImportance(news('【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [21:10]'));
  for (const low of [g1Talk, sgColumn, sales]) assert.ok(low.score < generalWin.score && low.score < NEWS_KEY_THRESHOLD);
  assert.ok(g1Win.score > generalWin.score);
  assert.equal(g1Win.grade, 'G1');
  assert.equal(detectNewsGrade('「師匠と一緒にSGに行きたい」大山千広が今年5回目の優勝へ気合十分'), null, 'SG inside a quote is ignored');
});

test('BS DATA is scored by content', () => {
  const bs = (title, extra = {}) => ({ source_type: 'bs_data', source_name: 'BoatStrikers レースDB', title, ...extra });
  const digest = scoreNewsImportance(bs('【10月6日】ボートレース結果まとめ｜万舟・事故・優勝戦', { list_headline: '10月6日結果｜万舟23本・最高343,980円', source_name: 'BoatStrikers DATA LAB / BOAT RACE公式結果' }));
  const result = scoreNewsImportance(bs('徳山9R 9Rの結果を更新', { summary: '徳山9Rで、女子戦のレース結果が確定しました。' }));
  const pending = scoreNewsImportance(bs('明日の女子ボートNEWS｜2026-10-13の出走表をチェック', { summary: '10月12日時点でBoatStrikersのレースDBでは未確認。' }));
  assert.equal(digest.type, 'digest');
  assert.equal(result.type, 'race_result');
  assert.equal(pending.type, 'bs_tomorrow_pending');
  assert.ok(digest.score > result.score && result.score > pending.score);
});

test('headline display fixes the repeated race number only', () => {
  assert.equal(cleanNewsHeadline('徳山9R 9Rの結果を更新'), '徳山9Rの結果を更新');
  assert.equal(cleanNewsHeadline('常滑12R 12Rの結果を更新'), '常滑12Rの結果を更新');
  assert.equal(cleanNewsHeadline('徳山9R 優勝戦の結果を更新'), '徳山9R 優勝戦の結果を更新');
});

test('topic keys group the same meeting even without a slash', () => {
  assert.equal(newsTopicKey(news('【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [21:10]')), '三国G1');
  assert.equal(newsTopicKey(news('【ボートレース】毒島誠が王道Ｖで賞金ランク浮上決める「インから逃げるには問題ない足」三国G1')), '三国G1');
  assert.equal(newsTopicKey(news('SGチャレンジカップ盛り上げ企画 松本日向コラム 第２回／常滑ボート [7:01]')), '常滑');
});

test('highlights avoid one topic monopolising the top', () => {
  const now = Date.parse('2026-10-10T03:00:00Z');
  const e = (id, importance, eventType, topicKey, hoursAgo) => ({ id, importance, eventType, topicKey, publishedAt: new Date(now - hoursAgo * 3600000).toISOString() });
  const picks = selectNewsHighlights([
    e(1, 75, 'win', '三国G1', 5), e(2, 75, 'win', '三国G1', 4), e(3, 45, 'final', '三国G1', 3),
    e(4, 60, 'win', '若松ミッド', 6), e(5, 55, 'incident', '若松ミッド', 6), e(6, 45, 'digest', 'bs:digest', 4), e(7, 45, 'digest', 'bs:digest', 28),
    e(8, 40, 'milestone', 'びわこ', 30), e(9, 15, 'talk', '桐生', 1),
  ], { now, count: 4 });
  assert.deepEqual(picks.map((p) => p.id), [2, 4, 6, 8]);
});

test('URL normalisation keeps distinct articles apart', () => {
  assert.equal(normalizeNewsSourceUrl('http://WWW.nikkansports.com/public_race/news/202610110001234.html#top'), 'https://www.nikkansports.com/public_race/news/202610110001234.html');
  assert.equal(normalizeNewsSourceUrl('https://sp.macour.jp/news/195009/?utm_source=x'), 'https://sp.macour.jp/news/195009');
  // 出走表 URL はクエリで別レースになる（本番で74通り）。汎用ページは別記事が共有している（本番で44件）。
  assert.notEqual(normalizeNewsSourceUrl('https://www.boatrace.jp/owpc/pc/race/racelist?rno=1&jcd=08&hd=20261006'), normalizeNewsSourceUrl('https://www.boatrace.jp/owpc/pc/race/racelist?rno=5&jcd=08&hd=20261006'));
  assert.equal(newsDuplicateKey({ source_type: 'bs_data', source_url: 'https://www.boatrace.jp/owpc/pc/race/index' }), '');
  assert.equal(newsDuplicateKey({ source_type: 'news', source_url: 'https://www.boatrace.jp/owpc/pc/race/index' }), '');
  assert.equal(newsDuplicateKey({ source_type: 'news', source_url: 'https://www.nikkansports.com/public_race/' }), '');
  assert.equal(newsDuplicateKey({ source_type: 'news', source_url: 'https://sp.macour.jp/news/195009/' }), 'https://sp.macour.jp/news/195009');
});

const BOILER = '日刊スポーツで掲載された女子ボートレース関連ニュースです。初音NEWSでは元記事の内容を転載せず、確認できる事実をもとに注目ポイントを初音の視点で整理します。';
const URL1 = 'https://www.nikkansports.com/public_race/news/202610070000101.html';

test('same-article duplicates collapse to the richest row', () => {
  const groups = groupDuplicateNews([
    news('【ボートレース】平川香織が豪快逃げで通算２度目V「もっとたくさん優勝して頑張りたい」／下関 - ボート : 日刊スポーツ', { id: 1597, source_url: URL1, summary: BOILER, article_body: BOILER }),
    news('【ボートレース】平川香織が豪快逃げで通算２度目V「もっとたくさん優勝して頑張りたい」／下関 [16:30]', { id: 1602, source_url: `${URL1}#x`, summary: '平川香織が下関で通算2度目の優勝を飾った。', article_body: '下関の優勝戦で平川香織が1コースから逃げ切り、通算2度目の優勝を飾った。'.repeat(3) }),
    news('別の記事', { id: 1600, source_url: 'https://www.nikkansports.com/public_race/news/202610070000999.html' }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].representative.id, 1602);
  assert.deepEqual(groups[0].members.map((m) => m.id), [1597, 1602]);
});

function makeRows(count) {
  const base = Date.parse('2026-10-12T05:00:00Z');
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const url = `https://www.nikkansports.com/public_race/news/2026101200${String(1000 + Math.floor(i / 2)).padStart(5, '0')}.html`;
    rows.push(news(`【ボートレース】テスト選手${i % 4 < 2 ? Math.floor(i / 2) : i}が今年初優勝／戸田 [18:00]`, {
      id: 5000 - i, category: i % 3 ? 'topic' : 'women', source_url: i % 4 < 2 ? url : `https://sp.macour.jp/news/${900000 + i}/`,
      summary: '戸田で行われた優勝戦の結果をまとめた記事です。'.repeat(3), article_body: '本文'.repeat(100 + i), published_at: new Date(base - i * 3600000).toISOString(),
    }));
  }
  return rows;
}

test('deduplicated counts, tabs, search and pages agree', () => {
  const entries = buildNewsIndex(makeRows(130));
  const ids = new Set();
  let collected = 0;
  const first = selectNewsListing(entries, { page: 1 });
  for (let page = 1; page <= first.totalPages; page += 1) {
    const listing = selectNewsListing(entries, { page });
    assert.equal(listing.total, entries.length);
    assert.equal(listing.tabCounts.all, entries.length);
    for (const entry of listing.pageEntries) { assert.ok(!ids.has(entry.id), 'no row on two pages'); ids.add(entry.id); }
    collected += listing.pageEntries.length;
  }
  assert.equal(collected + 1, entries.length, 'pages + TOP cover every entry exactly once');
  assert.equal(selectNewsListing(entries, { page: first.totalPages + 1 }).pageEntries.length, 0);
  // 検索：同一記事のどちらの id に一致しても代表1件として数える
  const hit = entries.find((entry) => entry.memberIds.length === 2);
  const search = selectNewsListing(entries, { searchIds: new Set([String(hit.memberIds[0])]) });
  assert.equal(search.total, 1);
  assert.equal(search.tabCounts.all, 1);
  // 女子タブ：同一記事の片方が category=women なら代表も女子として数える
  const women = selectNewsListing(entries, { category: 'women' });
  assert.equal(women.total, women.tabCounts.women);
  assert.equal(women.total, entries.filter((entry) => entry.women).length);
});

test('event list counts match the ?event= listing', () => {
  const now = Date.parse('2026-10-10T03:00:00Z');
  const rows = [
    news('【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [21:10]', { id: 1709, summary: '三国G1で毒島誠が逃げ切って優勝した。'.repeat(5), published_at: '2026-10-09T13:00:00Z' }),
    news('【ボートレース】権藤俊光が準優に向けて手応え「変わらず行き足は良かった」／三国G1 [19:00]', { id: 1625, summary: '三国G1の準優に向けた談話。'.repeat(6), published_at: '2026-10-07T13:00:00Z' }),
    news('【ボートレース】鳥本智史がデビュー112走目で初勝利、9R後に華々しく水神祭／びわこ [22:00]', { id: 1587, summary: 'びわこで鳥本智史が初勝利を挙げた。'.repeat(5), published_at: '2026-10-06T13:00:00Z' }),
  ];
  const entries = buildNewsIndex(rows);
  const events = listNewsEvents(entries, { now });
  assert.deepEqual(events.map((e) => [e.name, e.count]), [['三国G1', 2]]);
  assert.equal(selectNewsListing(entries, { event: '三国G1', now }).total, 2);
});

test('past results and goals are not counted as finals or milestones', () => {
  assert.equal(type(news('【ボートレース】「ターン回りは悪くない」香川陽太が前節優出２着の相棒に及第点／びわこ [17:57]')), 'talk');
  assert.equal(type(news('【ボートレース】甲斐貴大が２、３着で舟券貢献「回り足が良さそう」と初勝利目指す／児島 [19:00]')), 'talk');
  assert.equal(type(news('【ボートレース】地元で初優出を目指す常盤海心「合えばポテンシャルはあると思う」／鳴門 [19:00]')), 'final', 'a goal is a preview, not a milestone');
  assert.equal(type(news('【ボートレース】鳥本智史がデビュー112走目で初勝利、9R後に華々しく水神祭／びわこ [22:00]')), 'milestone');
});

test('a days-old big win yields TOP to fresher news but stays among highlights', () => {
  const now = Date.parse('2026-10-12T05:30:00Z');
  const picks = selectNewsHighlights([
    { id: 1709, importance: 78, eventType: 'win', topicKey: '三国G1', publishedAt: '2026-10-09T13:00:00Z' },
    { id: 1798, importance: 48, eventType: 'digest', topicKey: 'bs:digest', publishedAt: '2026-10-11T14:10:00Z' },
  ], { now, count: 4 });
  assert.deepEqual(picks.map((p) => p.id), [1798, 1709]);
});

test('a final preview phrased with Ｖ is not a completed win (id1670)', () => {
  const preview = news('【ボートレース】毒島誠が王道Ｖで賞金ランク浮上決める「インから逃げるには問題ない足」三国G1 [20:45]', {
    summary: '三国G1で毒島誠が準優を唯一逃げ切り、優勝戦1枠を確保した。複勝率26.8％の機を出足と行き足の実戦的な仕上がりに整え、優勝による賞金ランキング浮上に注目が集まる。',
  });
  assert.equal(type(preview), 'final');
  const win = news('【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [19:19]', { summary: '12R優勝戦は毒島誠（42＝群馬）が逃げ切って優勝した。G1制覇は通算19度目。' });
  assert.equal(type(win), 'win');
  assert.equal(type(news('【ボートレース】野中一平がイン速攻でＶ「記念を取りたいしSGも取りたい」／津3Days [19:40]')), 'win');
});

test('same URL with different headlines is not merged (id465 / id326)', () => {
  const url = 'https://www.nikkansports.com/public_race/news/202609080000709.html';
  const groups = groupDuplicateNews([
    news('SGチャレンジカップ盛り上げ企画 松本日向コラム 第１回／常滑ボート - ボート : 日刊スポーツ', { id: 465, source_url: url }),
    news('SGチャレンジカップ盛り上げ企画 松本日向コラム12日スタート／常滑ボート [18:19]', { id: 326, source_url: url }),
  ]);
  assert.equal(groups.length, 2);
});

// The PHASE 4 (prompt blog-ai-v3) live draft on staging, post stadium-basics-kiryu-course generated 2026-10-10
// 17:24 JST, copied read-only: 0 blocking issues, but the reader caveat in five places, rates listed without a
// reading, no dialogue, an empty DATA CHECK and a summary that repeats the body.
const URL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01';
const cite = ids => ({ source_ids: ids, source_url: URL, source_label: ids.join(' / ') });
const b = (type, data) => ({ id: `v3-${type}-${Math.random().toString(36).slice(2)}`, type, data });

export const v3Topic = { id: 'topic-kiryu-course', topic_key: 'stadium-basics:kiryu:course', category_slug: 'stadium-basics', stadium_slug: 'kiryu', angle: 'course', title_hint: '桐生のコース別1着率を確認する', character_key: null, status: 'candidate' };

export const v3Document = {
  schema_version: 1, title: '桐生のコース別1着率を確認する｜数字の読み方と当日チェック',
  excerpt: '桐生のコース別1着率を公式データで確認し、1コースから6コースまでの数字が何を示すのかを初心者向けに整理します。当日に見る項目も紹介します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '桐生のコース別1着率', description: '桐生のコース別1着率を公式データで確認。1コースから6コースまでの数字の読み方、水質や干満差、当日に確認したい項目を初心者向けに整理します。', stadium_slug: 'kiryu' },
  blocks: [
    b('LIST', { items: ['桐生のコース別1着率は、各コースから進入した艇が1着になった割合です。', '2026/07/01〜2026/09/30の公式データでは、1コースから6コースまでの1着率を確認できます。', '当日は開催条件や最新の公式情報を確認し、過去の数字だけで判断しないことが大切です。'], placement: 'takeaways', ...cite(['S2']) }),
    b('HEADING', { text: '桐生はナイター開催。まず場の基本情報を確認しよう', level: 2 }),
    b('TEXT', { text: '桐生のレース時間帯はナイターです。公式データでは、水質は淡水、干満差は「なし」とされています。これらはレース場の基本情報として、コース別データを見る前に押さえておきたい項目です。', ...cite(['S1', 'S2']) }),
    b('WARNING', { text: '水質や干満差の情報だけから、特定のコースが有利になる理由やレース結果を断定することはできません。数字は条件を整理する材料として扱いましょう。', ...cite(['S2']) }),
    b('HEADING', { text: '2026/07/01〜2026/09/30のコース別1着率を読む', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、そのコースから進入した艇が1着になった割合です。号艇や枠番そのものの成績ではない点に注意してください。桐生の公式データでは、1コース54.7%、2コース13.2%、3コース13.4%、4コース9.4%、5コース6.8%、6コース3.0%となっています。集計期間は2026/07/01〜2026/09/30です。', ...cite(['S2']) }),
    b('POINT', { text: 'この数字は、各コースの過去の1着率を並べたものです。選手、モーター、進入の状況、当日の水面などを含めた個別レースの結果を示す数字ではありません。', ...cite(['S2']) }),
    b('HEADING', { text: '桐生でレースを見る当日に確認すること', level: 2 }),
    b('DATA_CHECK', { text: '当日は、次の項目を公式情報で確認しましょう。', ...cite(['S2']) }),
    b('TEXT', { text: 'コース別1着率は過去の集計なので、当日の出走表や進入を確認してから、レースごとの条件を整理してください。過去の割合だけで展開や結果を決めつけず、自分で確認できる情報をもとに判断しましょう。', ...cite(['S2']) }),
    b('TEXT', { text: '桐生では、まずナイターという開催時間帯と、水質・干満差の基本情報を確認しましょう。コース別1着率を見るときは集計期間を確かめ、当日は出走表と実際の進入をあわせて判断してください。', placement: 'summary' }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト｜取得日時 2026/10/10 17:22', system: true, placement: 'sources', source_url: URL, source_label: 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト' }),
  ],
};

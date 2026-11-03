// The blog-ai-v10 draft on staging, post stadium-basics-toda-course generated 2026-10-12 06:36 UTC (15:36 JST), copied
// read-only with its source pack (version 4, the official page fetched the same day). Rated 4.1 (all axes) on the
// PHASE 4.7 scorecard with 6 quality notes, yet its lead says the table is "not in inside-first order" although Toda's
// rates fall from 1コース to 6コース in order: a factual error no check caught. The page text in the pack is cut down to
// the memo lines the article uses.
import { courseReadings } from '../../lib/blog/ai/dataReadings.mjs';

const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=02';
const S2 = 'BOAT RACE公式 ボートレース場データ（戸田）';
const official = { source_ids: ['S2'], source_url: OFFICIAL, source_label: S2 };
const PERIOD = '2026/07/01〜2026/09/30';
const rate = (n, course, value) => ({ id: `F${n}`, unit: '%', label: `戸田の${course}コース1着率`, value, period: PERIOD, source_id: 'S2' });
let n = 0;
const b = (type, data) => ({ id: `toda-${++n}`, type, data });

const facts = [rate(1, 1, '42.8'), rate(2, 2, '17.0'), rate(3, 3, '14.9'), rate(4, 4, '14.2'), rate(5, 5, '9.3'), rate(6, 6, '2.8'),
  { id: 'F7', unit: '', label: '戸田の水質', value: '淡水', source_id: 'S2' }, { id: 'F8', unit: '', label: '戸田の干満差', value: 'なし', source_id: 'S2' }];

export const todaPack = {
  version: 4, built_at: '2026-10-12T06:36:20.053Z', gaps: [], stadium_count: 1,
  topic: { angle: 'course', topic_key: 'stadium-basics:toda:course', title_hint: '戸田のコース別1着率を確認する', stadium_slug: 'toda', category_slug: 'stadium-basics', character_key: 'ichika' },
  stadium: { name: '戸田', slug: 'toda', course_code: 2 },
  sources: [{ id: 'S2', url: OFFICIAL, kind: 'official_data', label: S2, page_title: 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト', fetched_at: '2026-10-12T06:36:02.919+00:00',
    content_sha256: '45f8f3c05091b15df7e9fc360eebdddf0aa039e22ad2e6ae7ecc918d4f8491f4',
    tables: [{ label: '最近3ヶ月', period: PERIOD }, { label: '春季', period: '2026/03/01〜2026/05/31' }, { label: '夏季', period: '2026/06/01〜2026/08/31' }, { label: '秋季', period: '2025/09/01〜2025/11/30' }, { label: '冬季', period: '2025/12/01〜2026/02/28' }] }],
  facts,
  documents: [{ source_id: 'S2', title: 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト', excerpt: '戸 田ボートレース場\nMEMO\n水質\n淡水\n干満差\nなし' }],
  official: { period: PERIOD, status: 'parsed', skipped: [], source_id: 'S2' },
  readings: courseReadings(facts),
};

export const todaDocument = {
  schema_version: 1, title: '戸田の1コース1着率42.8%から読む6コースの数字',
  excerpt: '戸田のコース別1着率を、進入コースの意味から初心者向けに解説。1コースと2コース、外側のコースの数字を表で確認し、当日に見る情報も整理します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '戸田のコース別1着率を初心者向け解説', description: '戸田のコース別1着率を表で確認し、1コース・2コース・外側の数字が示す特徴を解説。号艇と進入コースの違い、当日に見る情報も紹介します。', stadium_slug: 'toda' },
  blocks: [
    b('LIST', { items: ['戸田のコース別1着率の見方', '1コース・2コース・外側のコースの特徴', '当日に確認したい出走表と展示情報'], placement: 'takeaways' }),
    b('TEXT', { text: '戸田の水質は淡水で、干満差はありません。コース別1着率の表には、内側から順に並んでいないところがあります。どこでしょうか。', placement: 'lead', ...official }),
    b('HEADING', { text: '戸田のコース別1着率は、実際の進入コースで読む', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、集計期間の中で、そのコースから進入した艇が1着になった割合です。出走表の号艇はレースごとに決まる艇の番号で、進入コースはスタートのときに艇が実際に入った位置。この表は号艇ではなく、進入したコースで数えています。', ...official }),
    b('TABLE', { rows: [['コース', '1着率'], ['1コース', '42.8%'], ['2コース', '17.0%'], ['3コース', '14.9%'], ['4コース', '14.2%'], ['5コース', '9.3%'], ['6コース', '2.8%']], header: true,
      caption: `戸田のコース別1着率（集計期間 ${PERIOD}）`, generated: 'rate_table', ...official }),
    b('TEXT', { text: `${PERIOD}の集計では、1コースの1着率は42.8%で、6つのコースの中で最も高い数字です。表を見るときは、まず1コースの数字を全体の基準として捉えられます。`, ...official }),
    b('TEXT', { text: '同じ集計期間では、2コースの1着率は17.0%で、1コース以外では最も高い数字です。一方、6コースの1着率は2.8%で、6つのコースの中で最も低くなっています。内側のコースと外側のコースで数字に特徴があることを、表から読み取れます。', ...official }),
    b('HEADING', { text: '当日は号艇・進入・展示後の情報を確認する', level: 2 }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: 'ae62ead3-56c3-4d3c-9e93-2e9a046240a4', pose: 'pose3', text: '出走表の号艇と、表にある進入コースは同じものですか？', alignment: 'auto', character: 'hatsune' },
      { id: 'eee79331-9344-4fe5-9536-20f0145629d7', pose: 'pose1', text: '同じとは限らないよ。この表は実際に進入したコースで集計しているから、誰がどのコースに入りそうかを見るときは、下の確認項目のスタート展示を見てみよう。', alignment: 'auto', character: 'ichika' }], ...official }),
    b('DATA_CHECK', { text: '当日に確認する項目は次の4つです。\n・出走表の号艇と選手 ― 号艇と進入コースは同じとは限らないので、まず出走表で各号艇の選手を知る\n・スタート展示の進入コース ― 本番の進入を考えるときの参考になる（本番で変わることもある）\n・展示後の直前情報 ― 展示のあとに公開される情報も合わせて見る\n・当日の水面と天候 ― 集計期間の数字には当日の条件が含まれないので、別に確かめる', ...official }),
    b('WARNING', { text: 'コース別1着率は過去の集計期間の数字で、これからのレースで勝つ確率ではありません。', ...official }),
    b('TEXT', { text: '戸田では1コースの数字が表の中心となり、1コース以外では2コースの数字が目立ちます。外側のコースにも数字の差があるため、表全体の並びを見ながら読みましょう。', placement: 'summary' }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: `BOAT RACE公式 ボートレース場データ（戸田）｜集計期間 ${PERIOD}｜取得日時 2026/10/12 15:36`, system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

// The notes recorded when the draft was made (blog_ai_drafts.validation, read-only copy).
export const todaGenerationValidation = [
  { code: 'auto_cited', level: 'warning', message: 'ブロック2（TEXT）：比較・事実の出典を自動で設定しました（S2）。内容と出典が合っているか確認してください。' },
  { code: 'similar_title', level: 'warning', message: '似た記事があります（類似度71%）：「常滑のコース別1着率を確認する｜数字の読み方」' },
];

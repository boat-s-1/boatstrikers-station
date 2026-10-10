// The blog-ai-v4 live draft on staging, post stadium-basics-tokoname-course generated 2026-10-10 18:36 JST, copied
// read-only with its source pack: 0 blocking issues and 5 notes, but the takeaways carry an uncited comparison, the
// caveats appear in four places, the 1コース reading is told three times, a block says nothing new, and the reading
// readers would find most useful (4コース above 3コース) is missing.
const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const S1 = 'BoatStrikers収録データ（常滑の基本情報）', S2 = 'BOAT RACE公式 ボートレース場データ（常滑）';
const cite = ids => ({ source_ids: ids, source_url: OFFICIAL, source_label: ids.map(id => (id === 'S1' ? S1 : S2)).join(' / ') });
let n = 0;
const b = (type, data) => ({ id: `v4-${++n}`, type, data });
const period = '2026/07/01〜2026/09/30';
const rate = (id, course, value) => ({ id, unit: '%', label: `常滑の${course}コース1着率`, value, period, source_id: 'S2' });

export const v4Topic = { id: 'topic-tokoname-course', topic_key: 'stadium-basics:tokoname:course', category_slug: 'stadium-basics', stadium_slug: 'tokoname', angle: 'course', title_hint: '常滑のコース別1着率を確認する', character_key: 'ichika', status: 'candidate' };

export const v4Pack = {
  version: 2, built_at: '2026-10-10T09:35:54.138Z', stadium_count: 1, gaps: [],
  topic: { angle: 'course', topic_key: 'stadium-basics:tokoname:course', title_hint: '常滑のコース別1着率を確認する', stadium_slug: 'tokoname', category_slug: 'stadium-basics', character_key: 'ichika' },
  stadium: { name: '常滑', slug: 'tokoname', course_code: 8 },
  sources: [
    { id: 'S1', url: OFFICIAL, kind: 'repository_dataset', label: S1, fetched_at: null, recorded_in: 'lib/stadiumBasicGuide24.js' },
    { id: 'S2', url: OFFICIAL, kind: 'official_data', label: S2, page_title: 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト', fetched_at: '2026-10-10T09:34:54.681+00:00',
      content_sha256: 'ab39de9dd7e624bf78f06f1c4c2d93525b9cc686ba58942f8a23edc2bde605a3',
      tables: [{ label: '最近3ヶ月', period }, { label: '春季', period: '2026/03/01〜2026/05/31' }, { label: '夏季', period: '2026/06/01〜2026/08/31' }, { label: '秋季', period: '2025/09/01〜2025/11/30' }, { label: '冬季', period: '2025/12/01〜2026/02/28' }] },
  ],
  facts: [
    { id: 'F1', unit: '', label: '常滑のレース時間帯', value: 'デイ', source_id: 'S1' },
    rate('F2', 1, '61.2'), rate('F3', 2, '14.4'), rate('F4', 3, '8.5'), rate('F5', 4, '10.0'), rate('F6', 5, '4.4'), rate('F7', 6, '2.2'),
    { id: 'F8', unit: '', label: '常滑の水質', value: '海水', source_id: 'S2' },
    { id: 'F9', unit: '', label: '常滑の干満差', value: 'なし', source_id: 'S2' },
  ],
  // As built by blog-ai-v4 (PHASE 4.1): three readings only.
  readings: [
    { id: 'R1', text: '1コースの1着率（61.2%）が6つのコースの中で最も高い', period, source_id: 'S2' },
    { id: 'R2', text: '1コースの1着率（61.2%）は半分を超えている', period, source_id: 'S2' },
    { id: 'R3', text: '6コースの1着率（2.2%）が最も低い', period, source_id: 'S2' },
  ],
  // The page text kept in the pack, shortened to its memo part (the figures of the table are removed when stored).
  documents: [{ source_id: 'S2', title: 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト',
    excerpt: '常 滑ボートレース場\n最近3ヶ月のデータ\nコース別入着率&決まり手\nMEMO\n所在地\n愛知県\nモーター\n減音\n水質\n海水\n干満差\nなし\nレコード\n1.44.1 仲口 博崇 2004/02/27\n(2026/06/30現在)\n水面図\n(2023/01/01現在)' }],
  official: { period, status: 'parsed', skipped: [], source_id: 'S2', placements: [
    { course: 1, rates: ['61.2', '15.4', '8.2', '6.2', '4.5', '4.1'] }, { course: 2, rates: ['14.4', '23.9', '20.7', '17.2', '11.9', '11.6'] },
    { course: 3, rates: ['8.5', '24.4', '19.8', '19.0', '14.9', '13.1'] }, { course: 4, rates: ['10.0', '15.4', '19.8', '18.8', '18.9', '16.8'] },
    { course: 5, rates: ['4.4', '14.3', '17.3', '21.3', '24.9', '17.6'] }, { course: 6, rates: ['2.2', '7.3', '14.8', '18.0', '25.0', '32.4'] }] },
};

export const v4Document = {
  schema_version: 1, title: '常滑のコース別1着率を確認してレース前の基本の見方を整理する',
  excerpt: '常滑の公式データから、コース別1着率と水質・干満差を確認します。1コースの数字が示す意味を整理し、当日に見る項目も初心者向けに案内します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '常滑のコース別1着率と基本データ', description: '常滑の公式データをもとに、2026/07/01〜2026/09/30のコース別1着率、水質、干満差を初心者向けに解説。当日確認する項目も整理します。', stadium_slug: 'tokoname' },
  blocks: [
    b('LIST', { items: ['常滑の1コース1着率は、6つのコースの中で最も高い数字です。', 'コース別1着率は、そのコースから進入した艇が1着になった割合を示します。', '常滑の水質や干満差など、レース場の基本情報を確認できます。'], placement: 'takeaways' }),
    b('HEADING', { text: '常滑の基本情報はデイ・海水・干満差なし', level: 2 }),
    b('TEXT', { text: '常滑のレース時間帯はデイです。BOAT RACE公式の場データでは、水質は海水、干満差は「なし」と掲載されています。レース場の特徴を確認するときは、まずこうした基本情報を押さえておきましょう。', ...cite(['S1', 'S2']) }),
    b('POINT', { text: '水質や干満差はレース場の基本データです。これだけで展開や結果を決めつけるのではなく、当日の出走表などと合わせて見ます。', ...cite(['S2']) }),
    b('HEADING', { text: 'コース別1着率は1コースが最も高い', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、枠番や号艇そのものの成績ではなく、そのコースから進入した艇が1着になった割合です。常滑の2026/07/01〜2026/09/30の数字は、1コース61.2%、2コース14.4%、3コース8.5%、4コース10.0%、5コース4.4%、6コース2.2%です。', ...cite(['S2']) }),
    b('TEXT', { text: 'この期間では、1コースの1着率61.2%が6つのコースの中で最も高く、半分を超えています。一方、6コースの1着率2.2%は6つのコースの中で最も低い数字です。数字の位置づけを確認することで、常滑のコース別データを整理できます。', ...cite(['S2']) }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: '6951e8e5-59f4-419f-82f3-c5464d4607b4', pose: 'pose3', text: '1コースの1着率61.2%は、高い数字なのでしょうか？', alignment: 'auto', character: 'hatsune' },
      { id: '501e5700-7de6-48dd-bdcb-82e0c8fec36e', pose: 'pose1', text: '2026/07/01〜2026/09/30の常滑では、6つのコースの中で1コースが最も高い数字だよ。まずは全コースの中でどの位置にあるかを見ると、読み方が分かりやすいかな。', alignment: 'auto', character: 'ichika' }], ...cite(['S2']) }),
    b('WARNING', { text: 'コース別1着率は過去の集計期間の数字です。この数字だけで当日の展開や結果を判断せず、当日の出走表などを確認してから、読者自身で判断してください。', ...cite(['S2']) }),
    b('HEADING', { text: '読者が当日に確認する項目', level: 2 }),
    b('TEXT', { text: '過去のコース別1着率を見たら、当日のレース情報に視点を移しましょう。常滑の基本データと当日の情報を分けて確認すると、数字の意味を取り違えにくくなります。', ...cite(['S1', 'S2']) }),
    b('DATA_CHECK', { text: '・当日の出走表のコース進入\n・当日の出走表に記載された選手・艇の情報\n・当日のスタート展示の進入\n・当日のレース条件' }),
    b('TEXT', { text: 'まず常滑の公式場データでコース別1着率の位置づけを確認し、その後に当日の出走表とスタート展示の進入を見比べましょう。', placement: 'summary' }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'BoatStrikers収録データ（常滑の基本情報）｜取得日時 記録なし', system: true, placement: 'sources', source_url: OFFICIAL, source_label: S1 }),
    b('QUOTE', { text: `BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 ${period}｜取得日時 2026/10/10 18:34`, system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

// The blog-ai-v5 comparison draft on staging, post stadium-basics-tokoname-course-v5 generated 2026-10-10 20:48 JST,
// copied read-only with its source pack (facts and the fetched page are the same as the v4 draft's). Rated 4.3 on
// the PHASE 4.2 scorecard. Left to improve: the dialogue repeats block 7, the summary repeats the DATA CHECK, the
// DATA CHECK repeats itself, block 7 lists the order the table already shows, and the 4コース > 3コース reading in
// block 7 went unnoticed by the scorecard (its sentence ends in a negation).
import { v4Pack } from './_tokonameV4.mjs';

const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const S1 = 'BoatStrikers収録データ（常滑の基本情報：レース時間帯）', S2 = 'BOAT RACE公式 ボートレース場データ（常滑）';
const period = '2026/07/01〜2026/09/30';
const official = { source_ids: ['S2'], source_url: OFFICIAL, source_label: S2 };
let n = 0;
const b = (type, data) => ({ id: `v5-${++n}`, type, data });
const reading = (id, key, kind, text, featured) => ({ id, key, kind, text, period, featured, source_id: 'S2' });

export const v5Pack = {
  ...structuredClone(v4Pack),
  built_at: '2026-10-10T11:48:41.828Z',
  sources: [
    { id: 'S1', url: '/races/08/info', kind: 'repository_dataset', label: S1, fetched_at: null, recorded_in: 'lib/stadiumBasicGuide24.js', official_url: OFFICIAL },
    structuredClone(v4Pack.sources[1]),
  ],
  readings: [
    reading('R1', 'top:1:高', 'top', '1コースの1着率（61.2%）が6つのコースの中で最も高い', false),
    reading('R2', 'half:1', 'half', '1コースの1着率（61.2%）は半分を超えている', true),
    reading('R3', 'top:6:低', 'bottom', '6コースの1着率（2.2%）が最も低い', false),
    reading('R4', 'except:2:高', 'except_top', '2コースの1着率（14.4%）は1コース以外で最も高い', true),
    reading('R5', 'pair:4>3', 'reversal', '4コースの1着率（10.0%）は3コース（8.5%）より高い', true),
    reading('R6', 'order', 'order', '1着率の高い順：1コース→2コース→4コース→3コース→5コース→6コース', false),
  ],
  comparison: { of_slug: 'stadium-basics-tokoname-course', topic_key: 'stadium-basics:tokoname:course', created_at: '2026-10-10T11:48:41.829Z',
    of_post_id: 'c5321ced-78a9-4034-9c70-a7a725197b53', prompt_version: 'blog-ai-v5', of_prompt_version: 'blog-ai-v4' },
};

export const v5Document = {
  schema_version: 1, title: '常滑のコース別1着率と水質・干満差・時間帯を確認する初心者向け解説',
  excerpt: '常滑の基本情報である水質・干満差・レース時間帯を確認し、コース別1着率の見方と数字から読み取れる特徴を初心者向けに紹介します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '常滑のコース別1着率と基本情報', description: '常滑の水質・干満差・レース時間帯と、2026/07/01〜2026/09/30のコース別1着率を初心者向けに解説。数字から読み取れる特徴と当日確認する項目を紹介します。', stadium_slug: 'tokoname' },
  blocks: [
    b('LIST', { items: ['常滑の水質・干満差・レース時間帯', 'コース別1着率が示す内容と各コースの特徴', '当日に確認したい出走表と進入の項目'], placement: 'takeaways' }),
    b('HEADING', { text: '常滑の基本情報は海水・干満差なし・デイ開催', level: 2 }),
    b('TEXT', { text: '常滑の水質は海水、干満差は「なし」です。レース時間帯はデイとされています。', source_ids: ['S2', 'S1'], source_url: OFFICIAL, source_label: `${S2} / ${S1}` }),
    b('HEADING', { text: '常滑のコース別1着率は1コースが最も高い', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、そのコースから進入した艇が1着になった割合を示す数字です。常滑では、1コースの1着率が61.2%で、6つのコースの中で最も高く、半分を超えています。いっぽう、1コース以外では2コースの14.4%が最も高い数字です。数値はいずれも2026/07/01〜2026/09/30の集計です。', ...official }),
    b('TABLE', { rows: [['コース', '1着率'], ['1コース', '61.2%'], ['2コース', '14.4%'], ['3コース', '8.5%'], ['4コース', '10.0%'], ['5コース', '4.4%'], ['6コース', '2.2%']],
      header: true, caption: `常滑のコース別1着率（集計期間 ${period}）`, generated: 'rate_table', ...official }),
    b('TEXT', { text: '高い順に見ると、1コース、2コース、4コース、3コース、5コース、6コースの順です。4コースの1着率は10.0%で、3コースの8.5%より高く、内側から順番に並ぶわけではありません。', ...official }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: 'b12f13c3-4299-4169-a5c7-62b0d1a676a8', pose: 'pose3', text: '4コースのほうが3コースより1着率が高いんだね。内側から順番に高いとは限らないの？', alignment: 'auto', character: 'kiina' },
      { id: '4f0f8dc3-1942-4448-ae8b-38757b55e3d3', pose: 'pose1', text: 'そうだよ。この集計では4コースが10.0%、3コースが8.5%だから、数字の並びをそのまま確認することが大切かな。', alignment: 'auto', character: 'ichika' }], ...official }),
    b('HEADING', { text: '当日に確認する項目を出走表と展示で見る', level: 2 }),
    b('DATA_CHECK', { text: '・当日の出走表・進入\n・出走表の枠番\n・スタート展示の進入' }),
    b('WARNING', { text: '過去の数字だけで判断しないようにしましょう。コース別1着率は集計期間のデータであり、個別のレースの結果を示すものではありません。', ...official }),
    b('TEXT', { text: '当日は出走表の枠番と、スタート展示での進入を確認しましょう。コース別1着率の集計期間も見直して、数字の条件をそろえて読み取ります。', placement: 'summary' }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'BoatStrikers収録データ（常滑の基本情報：レース時間帯）｜取得日時 記録なし', system: true, placement: 'sources', source_url: '/races/08/info', source_label: S1 }),
    b('QUOTE', { text: `BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 ${period}｜取得日時 2026/10/10 18:34`, system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

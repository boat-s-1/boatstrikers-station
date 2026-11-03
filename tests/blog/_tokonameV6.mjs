// The blog-ai-v6 comparison draft on staging, post stadium-basics-tokoname-course-v6 generated 2026-10-10 21:57 JST,
// copied read-only with its source pack (version 2: the undated race time slot left out, the fetched page as v4/v5).
// Rated 5.0 on the PHASE 4.3 scorecard, yet: no lead, a one-sentence basics section, the 号艇/course difference
// tucked after the table, a DATA CHECK without reasons, 一果 echoing キイナ, and a summary that repeats the definition.
import { v4Pack } from './_tokonameV4.mjs';
import { courseReadings } from '../../lib/blog/ai/dataReadings.mjs';

const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const S2 = 'BOAT RACE公式 ボートレース場データ（常滑）';
const official = { source_ids: ['S2'], source_url: OFFICIAL, source_label: S2 };
const facts = v4Pack.facts.filter(f => f.source_id === 'S2').map((f, i) => ({ ...f, id: `F${i + 1}` }));
let n = 0;
const b = (type, data) => ({ id: `v6-${++n}`, type, data });

export const v6Pack = {
  ...structuredClone(v4Pack),
  built_at: '2026-10-10T12:57:30.000Z',
  sources: [structuredClone(v4Pack.sources[1])],
  facts,
  readings: courseReadings(facts),
  comparison: { of_slug: 'stadium-basics-tokoname-course', topic_key: 'stadium-basics:tokoname:course', of_post_id: 'c5321ced-78a9-4034-9c70-a7a725197b53',
    prompt_version: 'blog-ai-v6', of_prompt_version: 'blog-ai-v4', created_at: '2026-10-10T12:57:30.000Z' },
};

export const v6Document = {
  schema_version: 1, title: '常滑のコース別1着率を確認する｜数字の読み方',
  excerpt: '常滑の水質や干満差を確認したうえで、2026年7月から9月までのコース別1着率を紹介します。表の見方と当日の確認項目も初心者向けに整理します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '常滑のコース別1着率と読み方', description: '常滑の水質・干満差と、2026年7月〜9月のコース別1着率を紹介。1着率が示す意味や、数字を見るときの注意点を初心者向けに解説します。', stadium_slug: 'tokoname' },
  blocks: [
    b('LIST', { items: ['常滑の水質と干満差', 'コース別1着率が示す意味', '当日に確認したいレース情報'], placement: 'takeaways' }),
    b('HEADING', { text: '常滑の基本情報｜水質は海水、干満差はなし', level: 2 }),
    b('TEXT', { text: '常滑の水質は海水で、干満差は「なし」とされています。', ...official }),
    b('HEADING', { text: '常滑のコース別1着率｜コースから進入した艇の割合を見る', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、そのコースから進入した艇が1着になった割合です。2026/07/01〜2026/09/30のデータでは、1コースの1着率は61.2%で、6つのコースの中で半分を超えています。', ...official }),
    b('TABLE', { rows: [['コース', '1着率'], ['1コース', '61.2%'], ['2コース', '14.4%'], ['3コース', '8.5%'], ['4コース', '10.0%'], ['5コース', '4.4%'], ['6コース', '2.2%']],
      header: true, caption: '常滑のコース別1着率（集計期間 2026/07/01〜2026/09/30）', generated: 'rate_table', ...official }),
    b('TEXT', { text: '同じ期間では、2コースの1着率は14.4%で、1コース以外では最も高い数字です。表では各コースの割合を見比べられますが、これは枠番別ではなく、実際に進入したコース別の数値です。', ...official }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: '74c5da81-d87c-489a-a554-879c4a289133', pose: 'pose2', text: '4コースの1着率は10.0%で、3コースの8.5%より高いんだね。内側から順に並ぶわけじゃないデータもあるよね。', alignment: 'auto', character: 'kiina' },
      { id: '9b576ad2-c395-4caa-9109-8b4284cf03a9', pose: 'pose1', text: 'そうだね。この期間の表は、1着率が内側から順番に並ぶわけではないと読めるよ。なぜそうなったかまでは、表の数字だけでは分からないかな。', alignment: 'auto', character: 'ichika' }], ...official }),
    b('HEADING', { text: '当日のレースで確認したい情報', level: 2 }),
    b('DATA_CHECK', { text: '・当日の出走表にある艇の情報\n・スタート展示での進入コース\n・展示後に更新された直前情報\n・水面や天候など当日のコンディション' }),
    b('WARNING', { text: '過去の数字だけで判断せず、集計期間と当日の状況を分けて見ましょう。' }),
    b('TEXT', { text: '常滑のコース別1着率は、進入したコースごとの割合として読み取ります。基本情報と統計の期間を分けて確認することが大切です。', placement: 'summary' }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 2026/07/01〜2026/09/30｜取得日時 2026/10/10 18:34', system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

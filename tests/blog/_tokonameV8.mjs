// The blog-ai-v8 comparison draft on staging, post stadium-basics-tokoname-course-v8 generated 2026-10-11 18:14 UTC
// (10/12 3:14 JST), copied read-only with its source pack (version 4: the WARNING carries the course-rate caveat).
// Rated 4.7 on the PHASE 4.5 scorecard. One summary sentence ("…決めつけず、当日の進入を確認する材料として…") cost
// two points, one of them a false "past figures" caveat; the basics repeated after the lead and the rate definition
// said twice went unnoticed. The AI also put reading ids (R2・R4・R5) in source_ids: composing left them out and
// recorded them as blocking (generationValidation below), so the saved blocks only cite S2.
import { v6Pack } from './_tokonameV6.mjs';

const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const S2 = 'BOAT RACE公式 ボートレース場データ（常滑）';
const official = { source_ids: ['S2'], source_url: OFFICIAL, source_label: S2 };
let n = 0;
const b = (type, data) => ({ id: `v8-${++n}`, type, data });

export const v8Pack = {
  ...structuredClone(v6Pack),
  version: 4,
  built_at: '2026-10-11T18:14:01.827Z',
  comparison: { ...v6Pack.comparison, prompt_version: 'blog-ai-v8', created_at: '2026-10-11T18:14:01.828Z' },
};

export const v8Document = {
  schema_version: 1, title: '常滑の1コース1着率61.2%は半分超？表の見方を確認',
  excerpt: '常滑のコース別1着率を、進入コースの意味から確認します。1コースが示す特徴や、内側から順に並ばない数字にも注目し、当日に見る項目を整理します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '常滑のコース別1着率を確認', description: '常滑のコース別1着率を初心者向けに解説。1コースが半分を超える特徴や、4コースと3コースの順番が入れ替わる点を確認し、当日に見る項目も紹介します。', stadium_slug: 'tokoname' },
  blocks: [
    b('LIST', { items: ['常滑の水質と干満差', 'コース別1着率が示す内容と1コースの特徴', '表の中で内側から順に並ばない箇所と当日の確認項目'], placement: 'takeaways' }),
    b('TEXT', { text: '常滑は海水で、干満差はありません。コース別1着率の表には、内側から順に並んでいないところがあります。どこでしょうか。', placement: 'lead', ...official }),
    b('HEADING', { text: '常滑のコース別1着率は何を示す？', level: 2 }),
    b('TEXT', { text: '常滑の水質は海水、干満差は「なし」です。', ...official }),
    b('TEXT', { text: '出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。コース別1着率は、集計期間の中で、そのコースから進入した艇が1着になった割合を示します。この表は号艇ではなく、進入したコースで数えています。', ...official }),
    b('HEADING', { text: '常滑の1着率で目立つコースを表で確認', level: 2 }),
    b('TEXT', { text: '2026/07/01〜2026/09/30の集計では、1コースの1着率は61.2%で、6つのコースの中で半分を超えています。また、1コース以外では2コースの1着率が14.4%で最も高い数字です。数字は、どのコースから進入した艇が1着になった割合かを確認して読みましょう。', ...official }),
    b('TABLE', { rows: [['コース', '1着率'], ['1コース', '61.2%'], ['2コース', '14.4%'], ['3コース', '8.5%'], ['4コース', '10.0%'], ['5コース', '4.4%'], ['6コース', '2.2%']], header: true,
      caption: '常滑のコース別1着率（集計期間 2026/07/01〜2026/09/30）', generated: 'rate_table', ...official }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: '14f09cd6-0672-46df-9664-6b7d081d8597', pose: 'pose2', text: '4コースの1着率は10.0%で、3コースの8.5%より高いよね。内側から順番に高くなる表ではないみたい。', alignment: 'auto', character: 'kiina' },
      { id: 'f3ec5905-c788-4365-bf2c-0fcf6f488e40', pose: 'pose1', text: 'この期間の数字は、コース番号どおりに1着率が並ぶとは限らない、と読めるね。誰が4コースに入りそうかは、下の確認項目のスタート展示で見てみよう。', alignment: 'auto', character: 'ichika' }], ...official }),
    b('HEADING', { text: '当日に見る4つの確認項目', level: 2 }),
    b('DATA_CHECK', { text: '・出走表の号艇と選手 ― 号艇と進入コースは同じとは限らないので、まず出走表で各号艇の選手を知る\n・スタート展示の進入コース ― 本番の進入を考えるときの参考になる（本番で変わることもある）\n・展示後の直前情報 ― 展示のあとに公開される情報も合わせて見る\n・当日の水面と天候 ― 集計期間の数字には当日の条件が含まれないので、別に確かめる', ...official }),
    b('WARNING', { text: 'コース別1着率は過去の集計期間の数字で、これからのレースで勝つ確率ではありません。', ...official }),
    b('TEXT', { text: '常滑では、1コースの1着率が半分を超える一方、4コースが3コースを上回る並びも見られました。表をコース番号の順だけで決めつけず、当日の進入を確認する材料として読みましょう。', placement: 'summary', ...official }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 2026/07/01〜2026/09/30｜取得日時 2026/10/10 18:34', system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

// The source-id notes recorded when the draft was made (blog_ai_drafts.validation, read-only copy).
export const generationValidation = [
  { code: 'unknown_source', level: 'blocking', message: '存在しない出典ID「R2」が使われています（セクション2・ブロック1）。' },
  { code: 'unknown_source', level: 'blocking', message: '存在しない出典ID「R4」が使われています（セクション2・ブロック1）。' },
  { code: 'unknown_source', level: 'blocking', message: '存在しない出典ID「R5」が使われています（セクション2・ブロック3）。' },
  { code: 'auto_cited', level: 'warning', message: 'ブロック2（TEXT）：比較・事実の出典を自動で設定しました（S2）。内容と出典が合っているか確認してください。' },
  { code: 'auto_cited', level: 'warning', message: 'ブロック9（DIALOGUE_SCENE）：数値・日付・特徴の出典を自動で設定しました（S2）。内容と出典が合っているか確認してください。' },
  { code: 'auto_cited', level: 'warning', message: 'ブロック13（TEXT）：比較・事実の出典を自動で設定しました（S2）。内容と出典が合っているか確認してください。' },
  { code: 'comparison_draft', level: 'blocking', message: '比較用に再生成した下書きです。承認・公開・予約公開はできません（正式に採用するには、別途の採用操作が必要です）。元記事：/stadium-basics-tokoname-course（blog-ai-v4）。' },
];

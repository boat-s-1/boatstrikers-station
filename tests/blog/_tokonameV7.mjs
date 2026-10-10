// The blog-ai-v7 comparison draft on staging, post stadium-basics-tokoname-course-v7 generated 2026-10-10, copied
// read-only with its source pack (version 3: the blog-ai-v7 structure checks apply). Rated 4.5 (6 axes) / 4.6 (all) on
// the PHASE 4.4 scorecard. Its duplication score of 2 counted one caveat twice, while two real repetitions went
// unnoticed: the 号艇/course explanation said again after the table, and 一果 restating the WARNING and DATA CHECK.
import { v6Pack } from './_tokonameV6.mjs';

const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const S2 = 'BOAT RACE公式 ボートレース場データ（常滑）';
const official = { source_ids: ['S2'], source_url: OFFICIAL, source_label: S2 };
let n = 0;
const b = (type, data) => ({ id: `v7-${++n}`, type, data });

export const v7Pack = {
  ...structuredClone(v6Pack),
  version: 3,
  comparison: { ...v6Pack.comparison, prompt_version: 'blog-ai-v7' },
};

export const v7Document = {
  schema_version: 1, title: '常滑の1コース1着率61.2%から表の見方を考える',
  excerpt: '常滑のコース別1着率を、進入コースの意味から確認します。1コースの数字が示すことや、内側から順番どおりにならない表の特徴、当日に見る項目を初心者向けに紹介します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '常滑の1コース1着率61.2%を読む', description: '常滑のコース別1着率を初心者向けに解説。1着率の意味、進入コースと号艇の違い、表から読み取れる特徴、当日に確認したい情報を整理します。', stadium_slug: 'tokoname' },
  blocks: [
    b('LIST', { items: ['常滑の水質と干満差', 'コース別1着率が示す意味と表の特徴', '当日に確認したい出走表・展示・直前情報'], placement: 'takeaways' }),
    b('TEXT', { text: '常滑の水質は海水で、干満差はありません。コース別1着率の表には、内側から順に並んでいないところがあります。どこでしょうか。', placement: 'lead', ...official }),
    b('HEADING', { text: '常滑のコース別1着率は何を示す？', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、集計期間の中で、そのコースから進入した艇が1着になった割合です。過去の集計であり、これからのレースで勝つ確率を示す数字ではありません。出走表の号艇は艇ごとに決まる番号、進入コースはスタートのときに艇が実際に入った位置です。号艇と進入コースは同じとは限らないため、この表は進入したコースで数えています。', ...official }),
    b('HEADING', { text: '1コースは半分超、2コースはそれ以外で最も高い', level: 2 }),
    b('TABLE', { rows: [['コース', '1着率'], ['1コース', '61.2%'], ['2コース', '14.4%'], ['3コース', '8.5%'], ['4コース', '10.0%'], ['5コース', '4.4%'], ['6コース', '2.2%']], header: true,
      caption: '常滑のコース別1着率（集計期間 2026/07/01〜2026/09/30）', generated: 'rate_table', ...official }),
    b('TEXT', { text: '2026/07/01〜2026/09/30の集計では、1コースの1着率は61.2%で、半分を超えています。また、2コースの1着率は14.4%で、1コース以外では最も高い数字です。どちらも号艇別ではなく、そのコースから進入した艇を対象にした数字です。', ...official }),
    b('WARNING', { text: '過去の集計期間の数字だけで、当日のレースを判断しないようにしましょう。期間が変われば数字も変わることがあります。', ...official }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: 'c2987755-a261-404b-8175-bee45ae88643', pose: 'pose2', text: '4コースの1着率は10.0%で、3コースの8.5%より高いのね。内側から順番に高くなる表ではないじゃない？', alignment: 'auto', character: 'kiina' },
      { id: '85530779-d7c4-4b07-88dc-b6c9fbc373ca', pose: 'pose1', text: 'この期間の集計では、内側から順に並ぶわけではないと読めるよ。表は過去の集計期間の数字で、当日の進入はスタート展示で参考に見られるけど、本番で変わることもあるんだ。', alignment: 'auto', character: 'ichika' }], ...official }),
    b('HEADING', { text: '当日に見る4つの情報', level: 2 }),
    b('DATA_CHECK', { text: '・出走表の号艇と選手 ― 号艇と進入コースは同じとは限らないので、まず出走表で各号艇の選手を知る\n・スタート展示の進入コース ― 本番の進入を考えるときの参考になる（本番で変わることもある）\n・展示後の直前情報 ― 展示のあとに公開される情報も合わせて見る\n・当日の水面と天候 ― 集計期間の数字には当日の条件が含まれないので、別に確かめる', ...official }),
    b('TEXT', { text: '常滑では、2026/07/01〜2026/09/30の集計で1コースの1着率が61.2%と半分を超えています。一方、2コースは14.4%で1コース以外では最も高く、表はコースごとの過去の数字として読みます。', placement: 'summary', ...official }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 2026/07/01〜2026/09/30｜取得日時 2026/10/10 18:34', system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

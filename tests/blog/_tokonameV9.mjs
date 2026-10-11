// The blog-ai-v9 comparison draft on staging, post stadium-basics-tokoname-course-v9 generated 2026-10-11 21:56 UTC
// (10/12 6:56 JST), copied read-only. Its source pack has the same facts, sources and readings as v8's (checked on
// staging), so the v8 pack is reused with its own build time. Rated 4.8 on the PHASE 4.6 scorecard: its only note,
// repeated_content between blocks 4 and 6, came from the shared 集計期間 ("今回の集計期間は2026/07/01〜2026/09/30です" next to
// "2026/07/01〜2026/09/30の集計では、1コースの1着率は半分を超えています"), not from repeated wording.
import { v8Pack, v8Document } from './_tokonameV8.mjs';

const OFFICIAL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=08';
const S2 = 'BOAT RACE公式 ボートレース場データ（常滑）';
const official = { source_ids: ['S2'], source_url: OFFICIAL, source_label: S2 };
let n = 0;
const b = (type, data) => ({ id: `v9-${++n}`, type, data });

export const v9Pack = {
  ...structuredClone(v8Pack),
  built_at: '2026-10-11T21:56:07.747Z',
  comparison: { ...v8Pack.comparison, prompt_version: 'blog-ai-v9', created_at: '2026-10-11T21:56:07.748Z' },
};

export const v9Document = {
  ...structuredClone(v8Document),
  title: '常滑の1コース1着率は半分超え？表の見方を解説',
  excerpt: '常滑のコース別1着率を、進入コースの意味から確認します。1コースの数字が示すことや、内側から順に並ばない特徴を表で読み取り、当日に見る項目も整理します。',
  seo: { title: '常滑の1着率とコース別データの見方', description: '常滑のコース別1着率を初心者向けに解説。1コースの1着率が示す意味、4コースと3コースの関係、号艇と進入コースの違い、当日に確認する項目を紹介します。', stadium_slug: 'tokoname' },
  blocks: [
    b('LIST', { items: ['常滑のコース別1着率が示す内容', '1コースと2コースの数字から読み取れる特徴', '当日に確認したい出走表・展示・直前情報'], placement: 'takeaways' }),
    b('TEXT', { text: '常滑の水質は海水で、干満差はありません。コース別1着率の表には、内側から順に並んでいないところがあります。どこでしょうか。', placement: 'lead', ...official }),
    b('HEADING', { text: '常滑のコース別1着率は何を示す？', level: 2 }),
    b('TEXT', { text: 'コース別1着率は、集計期間の中で、そのコースから進入した艇が1着になった割合です。今回の集計期間は2026/07/01〜2026/09/30です。出走表の号艇はレースごとの艇の番号で、コースはスタートのときに実際に入った位置です。この表は進入したコースで数えています。', ...official }),
    b('TABLE', { rows: [['コース', '1着率'], ['1コース', '61.2%'], ['2コース', '14.4%'], ['3コース', '8.5%'], ['4コース', '10.0%'], ['5コース', '4.4%'], ['6コース', '2.2%']], header: true,
      caption: '常滑のコース別1着率（集計期間 2026/07/01〜2026/09/30）', generated: 'rate_table', ...official }),
    b('TEXT', { text: '表では、1コースの1着率が61.2%で、6つのコースの中で最も高くなっています。2026/07/01〜2026/09/30の集計では、1コースの1着率は半分を超えています。1コース以外では、2コースの1着率が14.4%で最も高い数字です。', ...official }),
    b('HEADING', { text: '表の中にある、内側から順に並ばない部分', level: 2 }),
    b('DIALOGUE_SCENE', { label: '', turns: [
      { id: '3ff15c82-477d-47d2-b8e4-ef37a4bf9fb2', pose: 'pose2', text: '4コースの1着率は10.0%で、3コースの8.5%より高いよね。内側のコースほど順番に高い表ではないんじゃない？', alignment: 'auto', character: 'kiina' },
      { id: 'dc83f85b-5dc7-4aaf-960c-fa854ff2251f', pose: 'pose1', text: 'そうだね。この期間の表は、1着率が内側から順に並ぶわけではないと読めるよ。誰が4コースに入りそうかは、下の確認項目のスタート展示で見てみよう。', alignment: 'auto', character: 'ichika' }], ...official }),
    b('HEADING', { text: '常滑で当日に確認する4項目', level: 2 }),
    b('DATA_CHECK', { text: '・出走表の号艇と選手 ― 号艇と進入コースは同じとは限らないので、まず出走表で各号艇の選手を知る\n・スタート展示の進入コース ― 本番の進入を考えるときの参考になる（本番で変わることもある）\n・展示後の直前情報 ― 展示のあとに公開される情報も合わせて見る\n・当日の水面と天候 ― 集計期間の数字には当日の条件が含まれないので、別に確かめる', ...official }),
    b('WARNING', { text: 'コース別1着率は過去の集計期間の数字で、これからのレースで勝つ確率ではありません。', ...official }),
    b('TEXT', { text: '常滑では1コースの1着率が半分を超える一方、4コースが3コースを上回る例もありました。コース別1着率は、内側から単純に並べるのではなく、表の各数字を照らして読む材料になります。', placement: 'summary', ...official }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: 'BOAT RACE公式 ボートレース場データ（常滑）｜集計期間 2026/07/01〜2026/09/30｜取得日時 2026/10/10 18:34', system: true, placement: 'sources', source_url: OFFICIAL, source_label: S2 }),
  ],
};

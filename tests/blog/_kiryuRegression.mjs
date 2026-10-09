import { readFileSync } from 'node:fs';

// The first live AI draft on staging (post stadium-basics-kiryu-water, generated 2026-10-10 05:22 JST, prompt
// blog-ai-v1), copied read-only. The page text is byte-identical to the stored excerpt (md5 f3fa50ac…).
export const KIRYU_PAGE = readFileSync(new URL('./fixtures/kiryu-stadium-data-20261010.txt', import.meta.url), 'utf8');
const PAGE_URL = 'https://www.boatrace.jp/owpc/pc/data/stadium?jcd=01';
const PAGE_TITLE = 'ボートレース場データ｜BOAT RACE オフィシャルウェブサイト';
const FETCHED_AT = '2026-10-09T20:20:38.793+00:00';
const S1_LABEL = 'BOAT RACE公式データ（桐生・2026/05/01〜2026/07/31集計）';
const S1S2_LABEL = `${S1_LABEL} / ${PAGE_TITLE}`;

export const kiryuTopic = { id: 'topic-kiryu-water', topic_key: 'stadium-basics:kiryu:water', category_slug: 'stadium-basics', stadium_slug: 'kiryu', angle: 'water', title_hint: '桐生の水面と干満差', character_key: null, status: 'candidate' };

// blog_source_documents row as stored by the fetch on 2026-10-10 05:20 JST.
export const kiryuPageRow = { stadium_slug: 'kiryu', url: PAGE_URL, kind: 'official_data', fetched_at: FETCHED_AT, title: PAGE_TITLE,
  content_sha256: '8acb076587bd02c04161c82fd36e4b71851090f2e4cc322a2a8838618b89a292', extracted_text: KIRYU_PAGE, fetch_error: null };

// source_pack stored with the draft (built by the blog-ai-v1 code).
export const storedPack = {
  version: 1, built_at: '2026-10-09T20:20:39.000Z',
  topic: { topic_key: 'stadium-basics:kiryu:water', category_slug: 'stadium-basics', stadium_slug: 'kiryu', angle: 'water', title_hint: '桐生の水面と干満差', character_key: null },
  stadium: { slug: 'kiryu', name: '桐生', course_code: 1 }, stadium_count: 1,
  sources: [
    { id: 'S1', url: PAGE_URL, kind: 'repository_dataset', label: S1_LABEL, period: '2026/05/01〜2026/07/31', fetched_at: null, recorded_in: 'lib/stadiumBasicGuide24.js' },
    { id: 'S2', url: PAGE_URL, kind: 'official_data', label: PAGE_TITLE, fetched_at: FETCHED_AT, content_sha256: kiryuPageRow.content_sha256 },
  ],
  facts: [
    { id: 'F1', unit: '', label: '桐生のレース時間帯', value: 'ナイター', source_id: 'S1' },
    { id: 'F2', unit: '', label: '桐生の水質', value: '淡水', source_id: 'S1' },
    { id: 'F3', unit: '', label: '桐生の干満差', value: 'なし', source_id: 'S1' },
    ...['52.2', '12.7', '14.4', '10.6', '7.6', '3.1'].map((value, i) => ({ id: `F${i + 4}`, unit: '%', label: `桐生の${i + 1}コース1着率`, value, source_id: 'S1' })),
  ],
  documents: [{ source_id: 'S2', title: PAGE_TITLE, excerpt: KIRYU_PAGE }],
  gaps: [],
};

const cite = ids => ({ source_ids: ids, source_url: PAGE_URL, source_label: ids.length === 2 ? S1S2_LABEL : S1_LABEL });
const b = (type, data) => ({ id: `b-${type}-${Math.random().toString(36).slice(2)}`, type, data });

// The draft's document as saved (title, excerpt, SEO and all 20 blocks in order).
export const storedDocument = {
  schema_version: 1, title: '桐生の水面を知る：淡水と干満差なしで見るコース別データ',
  excerpt: '桐生はナイター開催で、水質は淡水、干満差はなし。公式データのコース別1着率を確認しながら、水面情報をレース検討の入口として整理します。',
  category_id: null, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
  seo: { title: '桐生の水面と干満差｜淡水・ナイターの基本', description: '桐生はナイター開催、淡水で干満差はなし。2026年5月から7月のコース別1着率をもとに、水面データの確認ポイントを初心者向けに解説します。', stadium_slug: 'kiryu' },
  blocks: [
    b('LIST', { items: ['桐生はナイター開催で、水質は淡水', '干満差は「なし」とされている', '2026年5月1日から7月31日集計のコース別1着率を確認できる', '水面情報とコース別データは、当日の判断材料の一つとして確認する'], placement: 'takeaways' }),
    b('HEADING', { text: '桐生はナイター開催、淡水で干満差はなし', level: 2 }),
    b('TEXT', { text: '桐生のレース時間帯はナイター。水質は淡水で、干満差は「なし」とされています。水面の基本情報を先に押さえておくと、レースデータを確認するときの整理軸になります。', ...cite(['S1']) }),
    b('DIALOGUE_SCENE', { label: '', turns: [{ id: 't1', pose: 'pose1', text: '桐生の水面を確認するときは、まずナイター開催、淡水、干満差なしの3点を押さえておこう。ここからコース別データを見ていくよ。', alignment: 'auto', character: 'ichika' }], ...cite(['S1']) }),
    b('POINT', { text: '干満差に関する確認項目は「なし」です。ただし、これだけでレースの結果を決めつけず、当日の出走表や直前情報なども別に確認しましょう。', ...cite(['S1']) }),
    b('HEADING', { text: 'コース別1着率は1コースが52.2％', level: 2 }),
    b('TEXT', { text: '2026年5月1日から7月31日までの集計では、桐生の1コース1着率は52.2％でした。2コースは12.7％、3コースは14.4％、4コースは10.6％、5コースは7.6％、6コースは3.1％です。', ...cite(['S1']) }),
    b('LIST', { items: ['1コース：52.2％', '2コース：12.7％', '3コース：14.4％', '4コース：10.6％', '5コース：7.6％', '6コース：3.1％'], ...cite(['S1']) }),
    b('WARNING', { text: 'これらは指定期間の集計値であり、個別レースの結果を示すものではありません。数字だけで展開や結果を断定しないようにしましょう。', ...cite(['S1']) }),
    b('HEADING', { text: '水面情報とコースデータをどう確認するか', level: 2 }),
    b('TEXT', { text: '水面の基本情報とコース別1着率は、役割が異なります。前者では桐生の開催時間帯、水質、干満差を確認し、後者では指定期間におけるコース別の1着率を確認します。', ...cite(['S1']) }),
    b('DATA_CHECK', { text: '読者が確認する項目', ...cite(['S1', 'S2']) }),
    b('DIALOGUE_SCENE', { label: '', turns: [{ id: 't2', pose: 'pose2', text: '数字を見るときは、集計期間を必ず確認したいね。期間が違えば、同じ桐生のデータでも見ている内容が変わるから、出典と期間をセットで見るのが大切だよ。', alignment: 'auto', character: 'ichika' }], ...cite(['S1', 'S2']) }),
    b('HEADING', { text: '桐生の水面データを検討の入口にする', level: 2 }),
    b('TEXT', { text: '桐生はナイター開催、淡水、干満差なしという基本情報を持つ水面です。そこにコース別1着率を重ねることで、まずは場のデータを整理できます。実際の判断では、指定期間や当日の公式情報を確認し、読者自身の基準で検討してください。', ...cite(['S1', 'S2']) }),
    b('POINT', { text: '水面情報は、それだけで舟券の結論を出すためのものではありません。コース別データの集計期間と、当日に確認できる情報を分けて見ることがポイントです。', ...cite(['S1', 'S2']) }),
    b('TEXT', { text: '桐生はナイター開催で、水質は淡水、干満差はなしとされています。2026年5月1日から7月31日のコース別1着率を確認しつつ、集計期間と当日の公式情報を分けて、自分の判断材料として活用しましょう。', placement: 'summary' }),
    b('WARNING', { text: 'この記事は、出典欄の公式情報・収録データをもとに作成しています。開催・施設・メニューなどの最新情報は各公式サイトでご確認ください。舟券の購入はご自身の判断でお願いします。', system: true, placement: 'notes' }),
    b('QUOTE', { text: `${S1_LABEL}｜取得日時 記録なし（集計期間 2026/05/01〜2026/07/31）`, system: true, placement: 'sources', source_url: PAGE_URL, source_label: S1_LABEL }),
    b('QUOTE', { text: `${PAGE_TITLE}｜取得日時 2026/10/10 05:20`, system: true, placement: 'sources', source_url: PAGE_URL, source_label: PAGE_TITLE }),
  ],
};

// The AI answer behind the stored document (ARTICLE_SCHEMA shape), reconstructed block by block.
const text = (type, value, ids) => ({ type, text: value, items: [], turns: [], source_ids: ids });
const list = (items, ids) => ({ type: 'list', text: null, items, turns: [], source_ids: ids });
const talk = (pose, value, ids) => ({ type: 'dialogue', text: null, items: [], turns: [{ character: 'ichika', pose, text: value }], source_ids: ids });
const at = i => storedDocument.blocks[i].data;
export const kiryuAi = () => ({
  title: storedDocument.title, excerpt: storedDocument.excerpt, seo_title: storedDocument.seo.title, seo_description: storedDocument.seo.description,
  takeaways: [...at(0).items],
  sections: [
    { heading: at(1).text, blocks: [text('text', at(2).text, ['S1']), talk('pose1', at(3).turns[0].text, ['S1']), text('point', at(4).text, ['S1'])] },
    { heading: at(5).text, blocks: [text('text', at(6).text, ['S1']), list([...at(7).items], ['S1']), text('warning', at(8).text, ['S1'])] },
    { heading: at(9).text, blocks: [text('text', at(10).text, ['S1']), text('data_check', at(11).text, ['S1', 'S2']), talk('pose2', at(12).turns[0].text, ['S1', 'S2'])] },
    { heading: at(13).text, blocks: [text('text', at(14).text, ['S1', 'S2']), text('point', at(15).text, ['S1', 'S2'])] },
  ],
  summary: at(16).text,
  needs_check: ['公開前に、記事内で案内する当日の出走表・直前情報の確認先を編集部で追記する', 'S1の集計期間と、公開時点で参照できる公式データの期間が一致しているか確認する', '必要に応じて、桐生の水面図を掲載するか編集部で判断する'],
});

// The same article written from the page fetched on the day (what a correct answer looks like with the new pack,
// where the fetched page is S2 and its course rates carry the period 2026/07/01〜2026/09/30).
export const correctedAi = () => {
  const ai = kiryuAi();
  const swap = s => s.replace('2026年5月1日から7月31日', '2026年7月1日から9月30日').replace('2026年5月から7月', '2026年7月から9月')
    .replace('52.2', '54.7').replace('12.7', '13.2').replace('14.4', '13.4').replace('10.6', '9.4').replace('7.6', '6.8').replace('3.1', '3.0');
  ai.seo_description = swap(ai.seo_description);
  ai.takeaways = ai.takeaways.map(swap);
  ai.summary = swap(ai.summary);
  ai.sections[1].heading = swap(ai.sections[1].heading);
  ai.sections[1].blocks = [text('text', swap(at(6).text), ['S2']), list(at(7).items.map(swap), ['S2']), text('warning', at(8).text, ['S2'])];
  return ai;
};

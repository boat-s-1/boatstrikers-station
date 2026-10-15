// Display/editorial policy only. Never use this module to rewrite source facts.
export const COPY_POLICY_VERSION = 'editorial-copy-v1';
export const PURCHASE_AGE_NOTICE = '舟券の購入は20歳になってから。';
export const PREDICTION_NOTICE = '予想・データは、的中や利益を保証するものではありません。';
export const REGISTRATION_NOTICE = 'LINE登録や情報の利用は、的中や利益を保証するものではありません。';
export const BUDGET_NOTICE = '生活に支障のない予算と時間を決め、無理のない範囲でお楽しみください。';
export const STANDARD_HASHTAGS = Object.freeze(['#ボートレース', '#BoatStrikers']);
export const EDITORIAL_INSTRUCTIONS = `【BoatStrikersの表現方針 ${COPY_POLICY_VERSION}】
- 自サイトの紹介・生成コメントは「ボートレース」表記とする。
- 的中・利益の保証、負けの取り返し、無制限の追加購入を促さない。
- 原典タイトル、発言の引用、検証済みの結果・確率・配当・艇番・日付・買い目は改変しない。
- 高配当の結果報告、統計、断定を否定する教育文は保持する。語だけで削除しない。
- キイナの穴党らしい反応は展開やデータの発見に向ける。
- 根拠のない「鉄板予想」「一撃回収」「高配当をぶち抜く」「勝ちにいこう」は自サイトの販促文に使わない。
- 自サイトが追加するタグは #ボートレース #BoatStrikers を基本に必要なものだけ。#競艇 #競艇予想 は既定タグにしない。`;
export const SHORT_COPY = Object.freeze({
  kiina: '5号艇が浮上する条件を確認！',
  longshot: '人気薄の展開を比較！',
  outer: '外側に展開が向くか確認！',
  news: '確認できたニュースを振り返ります。',
});
export function editorialHashtags(values, { max = 3, defaults = STANDARD_HASHTAGS } = {}) {
  // This applies ONLY to the generated hashtag field, never a source title or quote.
  const tags = Array.isArray(values) ? values : defaults;
  return [...new Set(tags.map(String).map(x => x.trim()).filter(x => x && x !== '#競艇' && x !== '#競艇予想'))].slice(0, max);
}

export const DATA_LAB_COMMENTS = Object.freeze({
  many: '万舟決着が複数見られた1日。配当分布を振り返ります。',
  outer: '4〜6号艇が1着となったレースの結果を確認します。',
  other: '各レースの配当と展開を振り返ります。',
});

import { blankDocument } from "./document.mjs";

// Draft scaffold: no invented statistics or image filenames. IMAGE needs an uploaded asset before publication.
export function beginnerTemplate(uuid) {
  const block = (type, data) => ({ id: uuid(), type, data });
  const talk = (character, pose, text) => ({ id: uuid(), character, pose, text, alignment: "auto" });
  return { ...blankDocument(), title: "3人で学ぶ：1号艇と1コースの違い", excerpt: "艇番と実際のコースを分けて、展示で確認するポイントを学びます。",
    blocks: [
      block("DIALOGUE_SCENE", { label: "導入", turns: [
        talk("ichika", "pose1", "今日は、1号艇と1コースを分けて見ていこう！"),
        talk("hatsune", "pose3", "出走表の番号と、実際にスタートする場所は同じとは限らないんですよね。"),
        talk("kiina", "pose3", "じゃあ、どこを見れば分かるの？"),
        talk("ichika", "pose1", "スタート展示で進入を確認するところから始めよう。"),
      ] }),
      block("TEXT", { text: "艇番は出走表で割り当てられた番号、コースは実際にスタートする位置です。進入の動きによって変わる場合があります。" }),
      block("POINT", { text: "1号艇だから必ず1コース、と決めつけず、進入を確認しましょう。" }),
      block("IMAGE", { media_id: null, alt: "艇番と進入コースの違いを説明する図", caption: "確認済みの教材画像を選択してください。" }),
      block("DATA_CHECK", { text: "スタート展示で実際の進入を確認します。展示と本番で同じになるとは限りません。", source_url: "https://www.boat-strike.online/guide/inside-course" }),
      block("DIALOGUE_SCENE", { label: "補足", turns: [
        talk("kiina", "pose2", "展示の並びだけで本番まで決めつけないことも大事だね。"),
        talk("hatsune", "pose1", "初心者さんは、艇番とコースを分けるところから覚えていきましょう♪"),
        talk("ichika", "pose4", "確認できた情報を材料にして、自分でも考えてみよう！"),
      ] }),
      block("HEADING", { level: 2, text: "まとめ" }),
      block("TEXT", { text: "艇番とコースを分けて考え、展示で進入を確認します。分からない情報を推測で補わず、判断材料が揃わないときは見送ることも大切です。" }),
      block("RELATED_ARTICLES", { post_ids: [], paths: ["/guide/inside-course", "/guide/course-entry"] }),
      block("CTA", { label: "今日のレースを見る", href: "/races" }),
    ] };
}

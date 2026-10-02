// Only sentence endings change. Facts, qualifications, quantities and examples are retained.
export function spokenText(text, character) {
  if (character === "hatsune") return text;
  const endings = [
    ["確認することが大切です。", "確認することが大切だよ。"],
    ["大切です。", "大切だよ。"], ["重要です。", "重要なんだ。"],
    ["同じとは限りません。", "同じとは限らないんだ。"],
    ["とは限りません。", "とは限らないんだ。"],
    ["わけではありません。", "わけではないんだ。"],
    ["ことはできません。", "ことはできないんだ。"],
    ["ことがあります。", "ことがあるよ。"], ["場合があります。", "場合があるよ。"],
    ["異なります。", "異なるんだ。"], ["変わります。", "変わるよ。"],
    ["になります。", "になるよ。"], ["できます。", "できるよ。"],
    ["確認します。", "確認しよう。"], ["考えます。", "考えてみよう。"],
    ["使います。", "使うよ。"], ["見ます。", "見てみよう。"],
    ["あります。", "あるよ。"], ["ではありません。", "ではないんだ。"],
    ["です。", "だよ。"],
  ];
  return endings.reduce((result, [from, to]) => result.replaceAll(from, to), text);
}

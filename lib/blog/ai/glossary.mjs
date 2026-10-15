// Wording checked by BoatStrikers for articles: definitions of the terms a beginner needs, and why each day-of item is
// worth checking. The AI uses these instead of writing its own definitions or reasons. They contain no figures, so
// copying them never brings an unsourced number into an article. Listed in docs/blog/AI-QUALITY-REVIEW.md for review.

export const GLOSSARY = [
  { term: "コース別1着率", text: "集計期間の中で、そのコースから進入した艇が1着になった割合。" },
  { term: "号艇（枠番）", text: "レースごとに出走表で決まる、各艇の番号（枠の番号）。" },
  { term: "進入コース", text: "スタートのときに艇が実際に入った位置。内側から順に番号で呼び、号艇と同じとは限らない。" },
  { term: "スタート展示", text: "レース前の展示航走のうち、スタートの様子を見せるもの。展示のときの進入コースが分かるが、本番の進入が同じになるとは限らない。" },
  { term: "集計期間", text: "数字を数えた期間。期間が違えば数字が変わることもある。" },
];

// DATA CHECK: "item ― reason". Reasons follow from the glossary. None predicts a race, names an advantage, or turns a
// past course rate into a chance of winning today; the exhibition is a hint for the entry, never the entry itself.
export const DATA_CHECK_PURPOSES = [
  { item: "出走表の号艇と選手", reason: "号艇と進入コースは同じとは限らないので、まず出走表で各号艇の選手を知る" },
  { item: "スタート展示の進入コース", reason: "本番の進入を考えるときの参考になる（本番で変わることもある）" },
  { item: "展示後の直前情報", reason: "展示のあとに公開される情報も合わせて見る" },
  { item: "当日の水面と天候", reason: "集計期間の数字には当日の条件が含まれないので、別に確かめる" },
];

// The caveat that belongs in the article's one WARNING (blog-ai-v8): kept apart from the definition so the definition
// can be used in the body without repeating the warning. Composing makes sure the WARNING carries it.
export const RATE_WARNING = "コース別1着率は過去の集計期間の数字で、これからのレースで勝つ確率ではありません。";
export const RATE_WARNING_PATTERN = /勝つ確率/;

// PHASE 5.0: how to read a finding, as BoatStrikers has checked it (listed in docs/blog/AI-QUALITY-REVIEW.md for review).
// One per kind of reading. Each speaks of the period counted only; none turns a past rate into a chance of winning,
// names a cause, or says a course is better to bet on. They contain no figures (the figures come from the facts).
// "half" is for a rate above 50% only (exactly 50% is neither above nor below half). "near" is for two values more than 0
// and at most 0.5 points apart; the same value is "same". "in_order" describes how the period's figures stand, not a
// change over time or its cause.
export const READING_LESSONS = [
  { kind: "top_not_majority", text: "この集計期間では、1コースは6つのコースの中で最も高い一方、半分以上のレースで1着になったわけではありません。「6つのコースの中で最も高い」ことと「半分以上で1着になった」ことは別です。" },
  { kind: "half", text: "この集計期間では、1コースから進入した艇が、半分を超えるレースで1着になりました。" },
  { kind: "close", text: "この集計期間の数字では、順位が違っても差は小さいことがあります。順位だけで差の大きさを判断しません。" },
  { kind: "near", text: "この集計期間の数字は、ほぼ並んでいます（同じ数字ではありません）。順位だけで差の大きさを判断しません。" },
  { kind: "same", text: "この集計期間では、2つのコースの1着率は同じ値です。" },
  { kind: "reversal", text: "この集計期間では、内側のコースほど1着率が高いとは限りません。どれくらいの差かは、表の数字で確かめます。" },
  { kind: "in_order", text: "この集計期間では、外側のコースほど、1着率が順に低く並んでいます。これは、その期間の集計結果です。" },
];
export const lessonFor = kind => READING_LESSONS.find(l => l.kind === kind)?.text ?? null;

export const dataCheckLine = ({ item, reason }) => `・${item} ― ${reason}`;

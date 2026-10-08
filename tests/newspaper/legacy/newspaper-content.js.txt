const CHARACTER = {
  ichika: { name: "一果", emoji: "🌸", theme: "イン逃げ", hashtag: "#一果新聞" },
  hatsune: { name: "初音", emoji: "💜", theme: "女子戦", hashtag: "#初音新聞" },
  kiina: { name: "キイナ", emoji: "🟡", theme: "穴狙い", hashtag: "#キイナ新聞" },
};

function clean(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  return String(value).trim();
}

function shortDate(date) {
  const parts = clean(date).split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : clean(date);
}

export function newspaperSlug(input) {
  const race = Number(input.raceNo || 0);
  return [input.date, input.character, input.course, `${race}r`, input.edition].map(clean).join("-");
}

export function buildNewspaperChannels(input) {
  const meta = CHARACTER[input.character] || CHARACTER.ichika;
  const editionLabel = input.edition === "just_before" ? "直前版" : "前日版";
  const dateLabel = shortDate(input.date);
  const raceLabel = `${clean(input.course)}${Number(input.raceNo)}R`;
  const headline = clean(input.headline) || `${meta.name}の${meta.theme}チェック`;
  const primary = clean(input.primaryValue);
  const primaryLabel = clean(input.primaryLabel);
  const comment = clean(input.comment);
  const detailLines = Array.isArray(input.details) ? input.details.map(clean).filter(Boolean) : [];
  const factBlock = [primaryLabel && primary ? `- ${primaryLabel}：${primary}` : "", ...detailLines.map((line) => `- ${line}`)].filter(Boolean).join("\n");
  const title = `【${dateLabel} ${editionLabel}】${raceLabel}｜${meta.name}新聞`;
  const summary = [headline, primaryLabel && primary ? `${primaryLabel}は${primary}` : "", comment].filter(Boolean).join("。 ");
  const articleBody = [
    `## ${meta.name}の注目ポイント`,
    comment || `${headline}を中心に確認します。`,
    factBlock ? `\n## 入力データ\n${factBlock}` : "",
    `\n## ${editionLabel}について`,
    input.edition === "just_before"
      ? "展示後に確認できた入力情報を反映しています。公開時刻と締切時刻を確認してご覧ください。"
      : "前日時点で確認できた入力情報を整理しています。直前情報で評価が変わる場合があります。",
    "\n※本記事は舟券の購入や利益を保証するものではありません。最終判断はご自身で行ってください。",
  ].filter(Boolean).join("\n\n");
  const noteTitle = `【${dateLabel}ボートレース】${raceLabel}を${meta.name}がチェック｜${editionLabel}`;
  const noteBody = [
    `${dateLabel}のBoatStrikers予想新聞です。今回は${meta.name}が${raceLabel}を取り上げます。`,
    `## 今日の新聞\n（ここに生成した新聞画像を挿入）`,
    `## ${meta.name}が見たポイント\n${comment || headline}`,
    factBlock ? `## 確認したデータ\n${factBlock}` : "",
    `## ${editionLabel}から次に確認したいこと\n${input.edition === "just_before" ? "締切時刻と最新オッズを確認し、無理のない範囲で判断してください。" : "展示、気象、進入、直前オッズが公開されたら評価の変化を確認します。"}`,
    "最新の出走表・直前版・過去新聞はBoatStrikers公式サイトで確認できます。",
    "※舟券の購入は20歳になってから。予想は的中や利益を保証するものではありません。",
  ].filter(Boolean).join("\n\n");
  const xPost = [
    `${meta.emoji} ${meta.name}新聞｜${dateLabel} ${raceLabel} ${editionLabel}`,
    primaryLabel && primary ? `${primaryLabel} ${primary}` : headline,
    comment,
    "全文・直前更新はBoatStrikers公式サイトへ",
    `${meta.hashtag} #BoatStrikers #ボートレース`,
  ].filter(Boolean).join("\n");
  const shortsScript = [
    `今日の${meta.name}新聞。${raceLabel}の${editionLabel}です。`,
    headline + "。",
    primaryLabel && primary ? `${primaryLabel}は${primary}。` : "",
    comment,
    "詳しい新聞と直前更新は、BoatStrikers公式サイトでチェックしてください。",
  ].filter(Boolean).join("\n");

  return { title, summary, articleBody, noteTitle, noteBody, xPost, shortsScript };
}

export const NEWSPAPER_CHARACTERS = CHARACTER;

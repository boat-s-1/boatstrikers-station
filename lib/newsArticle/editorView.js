// EDITOR'S VIEW：NEWS FACT と DATA CHECK に含まれる事実だけを材料に、担当キャラクターの短いコメントを作る（純粋関数）。
// 予想・将来の結果・評価語は書かない。材料が足りない場合や、専門分野に合う材料が無い場合は省略する（無理に割り当てない）。

import { womenNewsEvidence } from "../newsTaxonomy.js";
import { formatSt } from "./dataCheck.js";

const MANSHU_YEN = 10000;
const UPSET_POPULARITY = 20;

function yen(value) {
  return `${Number(value).toLocaleString("ja-JP")}円`;
}

// 初音：女子戦・女子レーサーの記事（判定は一覧と同じ womenNewsEvidence。名前から性別は推測しない）。
function hatsuneView(row, facts, data) {
  if (!womenNewsEvidence(row) || data.kind !== "racer") return null;
  const { stats, motor } = data.materials;
  if (!stats || stats.starts < 3) return null;
  const text = [`${facts.racer.name}選手の今節は${stats.starts}走${stats.wins}勝、2連対は${stats.top2}回です。`];
  if (motor?.rate != null) text.push(`相棒の${motor.no}号機は2連率${motor.rate}%。`);
  return { character: "hatsune", text: text.join(""), basis: ["DATA CHECK: 今節", motor ? "DATA CHECK: モーター" : ""].filter(Boolean) };
}

// キイナ：万舟・高配当・人気薄の決着。
function kiinaView(row, facts, data) {
  if (data.kind === "digest") {
    const { digest, top, over100k } = data.materials;
    if (!digest?.manshuCount || !top?.[0]) return null;
    const text = `この日の万舟は${digest.manshuCount}本。いちばん高かったのは${top[0].venue}${top[0].race_no}Rの${yen(top[0].payout)}で、10万円を超えたのは${over100k}本でした。`;
    return { character: "kiina", text, basis: ["DATA CHECK: 万舟", "DATA CHECK: 最高配当"] };
  }
  const race = data.materials?.targetRace;
  if (!race?.payout || !race.trifecta) return null;
  const upset = race.payout >= MANSHU_YEN || (race.popularity && race.popularity >= UPSET_POPULARITY);
  if (!upset) return null;
  const text = `3連単${race.trifecta}は${yen(race.payout)}${race.popularity ? `、${race.popularity}番人気` : ""}での決着でした。${race.payout >= MANSHU_YEN ? "万舟です。" : ""}`;
  return { character: "kiina", text, basis: ["DATA CHECK: 3連単"] };
}

// 一果：イン戦・スタート・レース内容の数字。
function ichikaView(row, facts, data) {
  if (data.kind !== "racer") return null;
  const { stats, target } = data.materials;
  const parts = [];
  if (target && target.course === 1 && target.finish === "1" && target.st != null) parts.push(`${target.raceNo}Rは1コースからST${formatSt(target.st)}で1着。`);
  if (stats?.course1Starts >= 2) parts.push(`今節の1コースは${stats.course1Starts}走${stats.course1Wins}勝です。`);
  if (stats?.avgSt != null && stats.stCount >= 3) parts.push(`平均STは${formatSt(stats.avgSt)}（${stats.stCount}走）でした。`);
  if (parts.length < 2) return null;
  return { character: "ichika", text: parts.join(""), basis: ["DATA CHECK: 今節", "DATA CHECK: 対象レース"] };
}

export function buildEditorView(row, facts, data) {
  if (!data || data.status !== "linked") return null;
  return hatsuneView(row, facts, data) || kiinaView(row, facts, data) || ichikaView(row, facts, data) || null;
}

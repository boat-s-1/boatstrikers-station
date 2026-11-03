import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";
import { buildResearchPack } from "../../lib/blog/ai/data/researchPack.mjs";
import { rowsOf, cleanRaces } from "./_raceRows.mjs";

export const NOW = new Date("2026-11-03T12:00:00Z");
export const TOPIC = { id: "t1", topic_key: "longshot:kiryu:boat5-365", category_slug: "longshot", stadium_slug: "kiryu", angle: "boat5-365",
  title_hint: "桐生の5号艇1着率を直近1年の確定結果で検証", character_key: "kiina" };
export const PERIOD = { from: "2025-11-03", to: "2026-11-02" };
export const ROWS = rowsOf(cleanRaces({ n: 200, every5: 8, from: "2026-03-01" }));

export function researchFixture() {
  const evidence = computeDataset({ definition: "boat5_win", rows: ROWS, period: PERIOD, params: { scope_name: "桐生", course_code: 1 }, now: NOW });
  const pack = buildResearchPack({ topic: TOPIC, evidence, now: NOW });
  return { evidence, pack };
}

const cite = { source_url: "/data-lab", source_label: "BoatStrikers集計", source_ids: ["D1"] };
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

// A research article written only from the dataset facts (5号艇1着 25 / 200 races = 12.5%, period 2025/11/03〜2026/11/02).
export function goodDocument() {
  return {
    schema_version: 1,
    title: "桐生の5号艇1着率は12.5%、直近1年の確定結果で検証",
    excerpt: "桐生で5号艇が1着になった割合を、BoatStrikersが集計した確定結果から確かめます。",
    category_id: "11111111-1111-4111-8111-111111111111", author_ids: ["22222222-2222-4222-8222-222222222222"], tag_ids: [], relations: [],
    noindex: false, cover: { media_id: "33333333-3333-4333-8333-333333333333", alt: "表紙" },
    seo: { title: "桐生の5号艇1着率を確定結果で検証", description: "桐生で5号艇が1着になった割合を、BoatStrikersが集めた確定結果の集計から確かめます。対象期間とレース数、集計から外したレースの考え方も説明します。" },
    blocks: [
      { id: id(), type: "TEXT", data: { text: "外枠の5号艇は、桐生でどれくらい1着になっているのでしょうか？確定結果を自分たちで数えてみると、意外な数字が見えてきました。", placement: "lead" } },
      { id: id(), type: "HEADING", data: { level: 2, text: "集計の対象" } },
      { id: id(), type: "TEXT", data: { text: "対象は2025/11/03〜2026/11/02の桐生のレースです。確定結果がそろっていた200レースを集計しました。着順・決まり手・払戻金のどれかが欠けたレースや、表どうしで記録が食い違うレースは、推測で埋めずに集計から外しています。", ...cite } },
      { id: id(), type: "HEADING", data: { level: 2, text: "5号艇が1着になった割合" } },
      { id: id(), type: "TEXT", data: { text: "200レースのうち、5号艇が1着になったのは25レースでした。割合にすると12.5%です。号艇は枠の番号で、実際に進入したコースとは別の数字なので、5コースからの1着とは限りません。", ...cite } },
      { id: id(), type: "WARNING", data: { text: "この割合は過去の確定結果をまとめたもので、これからのレースの結果を示すものではありません。舟券の購入をすすめるものでもありません。" } },
      { id: id(), type: "HEADING", data: { level: 2, text: "読み方のポイント" } },
      { id: id(), type: "TEXT", data: { text: "割合だけでなく、元になったレース数も一緒に見ることが大切です。レース数が少ないと、数件の違いで割合が大きく動きます。今回の集計は1年分の確定結果なので、ひとつの目安として読むことができます。", ...cite } },
      { id: id(), type: "TEXT", data: { text: "ほかの場と比べるときは、同じ期間・同じ条件で集計した数字どうしを並べてください。期間や条件が違う数字を並べると、差の理由が分からなくなります。", placement: "summary" } },
      { id: id(), type: "LIST", data: { system: true, placement: "sources", items: ["BoatStrikers集計（5号艇の1着率・桐生・2025/11/03〜2026/11/02・確定結果）"] } },
    ],
  };
}

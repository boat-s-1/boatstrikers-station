import SeoArticle from "../SeoArticle";

export const metadata = {
  title: "スタート展示とは？進入・ST・伸びの見方を初心者向けに解説",
  description: "ボートレースのスタート展示を初心者向けに解説。進入、スタートタイミング、スリット後の伸び、展示と本番が同じとは限らない理由、確認ポイントを紹介します。",
  alternates: { canonical: "/guide/start-exhibition" },
  openGraph: { title: "スタート展示とは？｜BoatStrikers", description: "進入・ST・スリット後の伸びなど、スタート展示で見るポイントを解説。", url: "/guide/start-exhibition", type: "article" },
};

const sections = [
  { title: "スタート展示とは？", paragraphs: ["スタート展示は、本番前に選手が進入とスタートを行う展示です。どの艇が何コースに入りそうか、スタートのタイミング、スリット付近での伸びなどを確認できます。", "ただし展示と本番で進入やスタートが変わることもあるため、結果をそのまま再現するものではありません。"], point: "スタート展示は『本番の答え』ではなく、直前の変化を確認する材料です。" },
  { title: "まず進入を見る", paragraphs: ["最初に確認したいのは、艇番どおりの枠なりか、外枠艇の前付けがあるかです。進入が変われば、助走距離やスタート条件も変わります。", "特に1号艇が深い進入になりそうな場合や、外枠艇が内側へ動く場合は、本番でも同じ動きがあるか注目します。"] },
  { title: "STは数字だけで決めない", paragraphs: ["展示STはスタートのタイミングを見る目安ですが、1回の展示だけで選手のスタート力を決めることはできません。平均STや今節のSTと合わせて見ます。", "展示で大きく遅れた艇が本番では修正することもあります。反対に展示で早かったからといって、本番も同じタイミングになるとは限りません。"] },
  { title: "スリット後の伸びを見る", paragraphs: ["スタートライン付近を通過したあと、隣の艇より前へ出るように見える艇は直線の気配を確認する材料になります。特に3〜5コース付近の艇が伸びている場合は、1マークでの攻めにつながる可能性を考えます。", "ただし見た目だけでは判断しづらいこともあるため、展示タイムや周回展示と組み合わせて確認します。"], point: "『誰が一番早かったか』だけでなく、『その後に誰が伸びて見えたか』も確認します。" },
  { title: "初心者が確認する4点", points: ["進入は枠なりか、前付けがあるか", "展示STで大きな差があるか", "スリット後に伸びて見える艇がいるか", "展示と本番で変わる可能性を残しておく"], paragraphs: ["スタート展示だけで買い目を決めず、周回展示・モーター・風などの情報と合わせると整理しやすくなります。"] },
];

export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 17" title="スタート展示とは？" description="進入、ST、スリット後の伸びなど、スタート展示で何を確認すればよいかを初心者向けに解説します。" summary="スタート展示は『進入・スタート・直線の気配』を分けて見るのが基本です。本番と同じになるとは限りません。" sections={sections} related={[{href:"/guide/exhibition",label:"展示航走の見方"},{href:"/guide/average-st",label:"平均STの見方"},{href:"/guide/course-entry",label:"進入・前付けとは？"}]} references={[{label:"BOAT RACE GUIDE スタート展示",url:"https://www.boatrace.jp/owpc/pc/extra/enjoy/guide/level1/l1_01_03_01.html"}]} />}

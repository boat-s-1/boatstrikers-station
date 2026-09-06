import SeoArticle from "../SeoArticle";

export const metadata={title:"ボートレースのF・Lとは？フライングと出遅れを初心者向けに解説",description:"ボートレースのF（フライング）とL（出遅れ）とは何かを初心者向けに解説。フライングスタート方式、返還、出走表でのF表示、スタートを見るときの注意点を紹介します。",alternates:{canonical:"/guide/flying-late-start"},openGraph:{title:"ボートレースのF・Lとは？｜BoatStrikers",description:"フライングと出遅れの意味、出走表での見方を解説。",url:"/guide/flying-late-start",type:"article"}};
const sections=[
{title:"Fはフライング、Lは出遅れ",paragraphs:["ボートレースでは大時計がゼロを指すタイミングに合わせてスタートラインを通過するフライングスタート方式が採用されています。早すぎるスタートはF（フライング）、大きく遅れた場合はL（出遅れ）と表記されます。"]},
{title:"なぜスタートが重要なの？",paragraphs:["スタート直後の位置関係は、第1ターンマークまでの展開に大きく影響します。特に内側の艇が外から先行されると、通常とは違う展開になることがあります。","ただし平均STが早い選手だから毎回早いわけではありません。今節のスタートやスタート展示も確認します。"],point:"平均STは『傾向』、展示STは『直前の参考』として分けて見ると分かりやすいです。"},
{title:"出走表のF表示はどう見る？",paragraphs:["出走表には選手のフライング状況が表示される場合があります。Fを持っていることは確認材料のひとつですが、それだけでスタートが遅くなると決めつけることはできません。","選手の平均ST、今節ST、担当コース、展示と合わせて見ます。"]},
{title:"返還があるケース",paragraphs:["スタート事故が発生した場合、舟券が返還対象になることがあります。実際の扱いはレース確定後の公式結果で確認してください。購入した舟券の扱いを自己判断せず、必ず主催者の確定情報を見ることが大切です。"]},
{title:"初心者が見るポイント",points:["平均STだけで決めない","今節のスタートを確認する","スタート展示を見る","F表示だけで選手評価を決めない","レース後は公式の確定結果を確認する"]}
];
export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 14" title="ボートレースのF・Lとは？" description="出走表で見かけるFとL。フライングスタート方式の基本から、F・Lの意味、スタート情報の見方まで初心者向けに解説します。" summary="Fはフライング、Lは出遅れ。表示だけで判断せず、平均ST・今節ST・展示を合わせて見るのが基本です。" sections={sections} related={[{href:"/guide/basic-rules",label:"ボートレースの基本ルール"},{href:"/guide/average-st",label:"平均STの見方"},{href:"/guide/exhibition",label:"展示航走の見方"}]} references={[{label:"BOAT RACE GUIDE 基礎篇",url:"https://www.boatrace.jp/owpc/pc/extra/enjoy/guide/level1/index.html"}]} />}

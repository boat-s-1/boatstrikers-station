import SeoArticle from "../SeoArticle";

export const metadata={title:"ボートレースの直線タイムとは？展示での見方を初心者向けに解説",description:"ボートレースの直線タイムや直線気配とは何か、スリット後の伸び、展示タイムとの違い、カド攻めや外枠を見るときの考え方を解説します。",alternates:{canonical:"/guide/straight-line-time"},openGraph:{title:"直線タイムとは？｜BoatStrikers",description:"展示で見る直線の伸びと、他のデータとの合わせ方を解説。",url:"/guide/straight-line-time",type:"article"}};
const sections=[
{title:"直線タイム・直線気配とは？",paragraphs:["直線タイムや直線気配は、艇が直線でどれくらい伸びているかを見るための材料です。公式や各種データでは計測方法や表示方法が異なることがあります。","重要なのは単独の数字より、同じレースの6艇を比較してどの艇が伸びて見えるかを確認することです。"]},
{title:"展示タイムとの違い",paragraphs:["展示タイムは展示航走全体の一部を数値で比較する材料ですが、直線評価はスリット後や直線区間の伸びに注目します。展示タイム上位と直線上位が同じ艇なら、気配の良さを考える材料が増えます。"],point:"展示タイムと直線評価が一致しているかを見ると、単独の数字より整理しやすくなります。"},
{title:"4・5号艇を見るときに重要",paragraphs:["外側の艇はスタート後に内側へ攻める展開が必要になることが多く、直線で伸びる気配は展開を考える入口になります。","ただし伸びが良くてもスタートで後手を踏めば攻め切れないため、展示STや進入も合わせて確認します。"]},
{title:"初心者が確認する順番",points:["展示タイム","直線の伸び","スタート展示のST","進入","1マークまでの展開"],paragraphs:["直線だけを見て舟券を決めず、どのコースからどのように攻められそうかまで考えるのがポイントです。"]}
];
export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 22" title="ボートレースの直線タイムとは？" description="直線タイム・直線気配の意味と、展示タイムやスタート展示と組み合わせた見方を解説します。" summary="直線評価は『伸びの良さ』を見る材料です。展示タイム・ST・進入と組み合わせて使います。" sections={sections} related={[{href:"/guide/exhibition-time",label:"展示タイムとは？"},{href:"/guide/start-exhibition",label:"スタート展示とは？"},{href:"/guide/course-characteristics",label:"コース別の特徴"}]} references={[{label:"BOAT RACE GUIDE 展示航走",url:"https://www.boatrace.jp/owpc/pc/extra/enjoy/guide/level1/l1_01_03_01.html"}]} />}

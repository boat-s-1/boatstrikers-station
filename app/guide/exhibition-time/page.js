import SeoArticle from "../SeoArticle";

export const metadata={title:"ボートレースの展示タイムとは？見方と注意点を初心者向けに解説",description:"ボートレースの展示タイムとは何か、数字の見方、展示1位の考え方、直線や周回展示と合わせて見るポイントを初心者向けに解説します。",alternates:{canonical:"/guide/exhibition-time"},openGraph:{title:"展示タイムとは？｜BoatStrikers",description:"展示タイムの意味と、数字だけで判断しない見方を解説。",url:"/guide/exhibition-time",type:"article"}};

const sections=[
{title:"展示タイムとは？",paragraphs:["展示タイムは、展示航走で計測される各艇の走行タイムです。一般に数字が小さいほど速く走ったことを示しますが、これだけでレース結果が決まるわけではありません。","展示タイムは直前の機力や走りの気配を見るための材料のひとつとして使います。"],point:"『展示タイム1位＝必ず1着』ではなく、直前気配を比較するための数字と考えましょう。"},
{title:"展示1位を見るときの注意点",paragraphs:["展示タイムが最も速い艇は目に付きやすいですが、コース、選手、スタート、ターンの安定感なども同時に確認します。","特に外枠の艇は直線が良くても1マークまでの展開が必要になるため、タイムだけで評価を決めないことが大切です。"]},
{title:"直線・周回展示と一緒に見る",paragraphs:["展示タイムと合わせて、スリット後の伸びや周回展示でのターンの安定感も確認します。複数の材料が同じ方向を示しているときは、直前気配を判断しやすくなります。"],points:["展示タイムの順位","スタート展示の進入とST","直線の伸び","ターン出口の加速"]},
{title:"BoatStrikersでの見方",paragraphs:["BoatStrikersでは展示タイム単独ではなく、選手・モーター・進入・スタート・直線評価などと組み合わせて見ます。数字が良い理由を探すことが大切です。"]}
];
export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 21" title="ボートレースの展示タイムとは？" description="展示タイムの意味と見方、展示1位だけで判断しないためのポイントを初心者向けに解説します。" summary="展示タイムは直前気配を見る重要な材料ですが、順位だけでなく進入・スタート・直線・ターンと合わせて確認します。" sections={sections} related={[{href:"/guide/exhibition",label:"展示航走の見方"},{href:"/guide/lap-exhibition",label:"周回展示とは？"},{href:"/races",label:"本日の出走表を見る"}]} references={[{label:"BOAT RACE GUIDE 展示航走",url:"https://www.boatrace.jp/owpc/pc/extra/enjoy/guide/level1/l1_01_03_01.html"}]} />}

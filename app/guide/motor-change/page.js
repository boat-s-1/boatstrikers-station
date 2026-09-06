import SeoArticle from "../SeoArticle";

export const metadata={title:"ボートレースのモーター交換とは？交換後に見るポイントを初心者向けに解説",description:"ボートレースのモーター交換とは何か、交換が行われる理由、交換後に展示・直線・周回展示で確認したいポイントを初心者向けに解説します。",alternates:{canonical:"/guide/motor-change"},openGraph:{title:"モーター交換とは？｜BoatStrikers",description:"交換後にどこを見ればいいかを初心者向けに整理。",url:"/guide/motor-change",type:"article"}};
const sections=[
{title:"モーター交換とは？",paragraphs:["レース期間中に使用しているモーターに不具合などがあり、別のモーターへ交換されることがあります。交換が行われた場合は、それまでの成績だけでなく交換後の気配を改めて見る必要があります。"]},
{title:"交換前の数字をそのまま使わない",paragraphs:["モーター2連率や節間成績が良くても、交換後は条件が変わります。交換前の数字だけで評価せず、直前の展示や選手コメントなど新しい材料を優先して確認します。"],point:"モーター交換後は『過去の数字より直前気配』を意識すると整理しやすくなります。"},
{title:"交換後に見るポイント",points:["展示タイム","直線の伸び","周回展示のターン","スタート展示","選手のコメントや公式情報"],paragraphs:["一つの数字だけでなく、複数の直前情報が改善しているか、逆に違和感がないかを確認します。"]},
{title:"舟券判断は慎重に",paragraphs:["交換直後はデータが少なく、比較しにくいことがあります。判断材料が足りないと感じたら、そのレースを見送る選択も大切です。"]}
];
export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 23" title="ボートレースのモーター交換とは？" description="モーター交換の意味と、交換後に展示や直線で確認したいポイントを初心者向けに解説します。" summary="モーター交換後は、それまでの数字だけで判断せず、交換後の展示・直線・周回展示を改めて確認します。" sections={sections} related={[{href:"/guide/motor-rate",label:"モーター2連率とは？"},{href:"/guide/exhibition-time",label:"展示タイムとは？"},{href:"/guide/lap-exhibition",label:"周回展示とは？"}]} references={[{label:"BOAT RACE オフィシャルウェブサイト",url:"https://www.boatrace.jp/"}]} />}

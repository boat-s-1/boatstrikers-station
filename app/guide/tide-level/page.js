import SeoArticle from "../SeoArticle";

export const metadata={title:"ボートレースの潮位とは？満潮・干潮と水面の見方を初心者向けに解説",description:"ボートレースの潮位とは何か、満潮・干潮や潮の動きが水面コンディションにどう関わるか、競艇場ごとに確認したいポイントを初心者向けに解説します。",alternates:{canonical:"/guide/tide-level"},openGraph:{title:"潮位とは？｜BoatStrikers",description:"満潮・干潮と水面コンディションの見方を初心者向けに解説。",url:"/guide/tide-level",type:"article"}};
const sections=[
{title:"潮位とは？",paragraphs:["海や河口に近い一部のボートレース場では、潮の満ち引きによって水位が変化します。この水位の高さを潮位と呼びます。","同じレース場でも時間帯によって水面条件が変わることがあるため、潮位は水面を見る材料のひとつになります。"]},
{title:"満潮・干潮だけで決めない",paragraphs:["満潮だから必ずイン有利、干潮だから必ず外有利というように単純化はできません。レース場ごとの構造、風向、波、潮の流れなどが重なって条件が変わります。"],point:"潮位は『その場固有の水面条件を理解する材料』として使うのが基本です。"},
{title:"24場攻略と一緒に見る",paragraphs:["潮の影響を受けやすい場と、ほとんど気にしなくてよい場があります。まず各レース場の水面特徴を知り、そのうえで当日の潮位や風を確認すると整理しやすくなります。"],points:["その場が海水・汽水・淡水のどれか","満潮・干潮の時刻","風向・風速","波高","展示の走り"]},
{title:"直前の展示を優先する",paragraphs:["潮位の理論だけで判断せず、実際のスタート展示や周回展示で走りにくそうな艇がいないか確認します。水面条件が変わる日は、直前情報を重視しましょう。"]}
];
export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 25" title="ボートレースの潮位とは？" description="満潮・干潮と水面コンディションの関係、競艇場ごとに潮位を見るときのポイントを初心者向けに解説します。" summary="潮位はレース場ごとの水面特性とセットで見る情報です。満潮・干潮だけで有利不利を決めず、風や展示と合わせて確認します。" sections={sections} related={[{href:"/guide/wind-water",label:"風向・風速と水面の見方"},{href:"/library/stadiums",label:"全国24場攻略"},{href:"/guide/exhibition",label:"展示航走の見方"}]} references={[{label:"BOAT RACE オフィシャルウェブサイト",url:"https://www.boatrace.jp/"}]} />}

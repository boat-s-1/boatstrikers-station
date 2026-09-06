import SeoArticle from "../SeoArticle";

export const metadata = {
  title: "ボートレーサーのA1・A2・B1・B2とは？級別の違いを初心者向けに解説",
  description: "ボートレーサーのA1・A2・B1・B2の級別とは何かを初心者向けに解説。出走表での見方、級別だけで着順を決められない理由、レースを見るときのポイントを紹介します。",
  alternates: { canonical: "/guide/racer-class" },
  openGraph: { title: "ボートレーサーのA1・A2・B1・B2とは？｜BoatStrikers", description: "級別の違いと出走表での見方を初心者向けに解説。", url: "/guide/racer-class", type: "article" },
};

const sections=[
{title:"級別はA1・A2・B1・B2の4区分",paragraphs:["ボートレーサーにはA1・A2・B1・B2という級別があります。一定期間の成績などをもとに区分され、出走表で選手を見るときの基礎情報になります。","一般にA1は上位クラスですが、級別だけでそのレースの着順が決まるわけではありません。"]},
{title:"A1選手なら必ず強い？",paragraphs:["A1選手でも外コース、モーター気配、進入、風、水面など条件によってレースの難しさは変わります。逆にB級選手でも得意コースや好モーター、良い展示が重なるケースがあります。"],point:"『A1だから買う』『B1だから消す』ではなく、その日の条件と合わせて見るのが基本です。"},
{title:"出走表ではどこまで見る？",points:["級別","全国勝率・当地勝率","平均ST","コース別成績","モーター成績","今節の着順・展示気配"],paragraphs:["級別は選手の全体像をつかむ入口として便利です。そのうえで、そのレースで担当するコースや今節の状態を確認します。"]},
{title:"同じ級別でも特徴は違う",paragraphs:["同じA1選手でもイン戦を得意とする選手、スタート力を生かす選手、ターンで着をまとめる選手など特徴はさまざまです。級別より一段深く見るなら、コース別成績や決まり手、直近の走りにも注目します。"]},
{title:"初心者のおすすめ確認順",points:["① 艇番とコース","② 選手の級別","③ コース別成績と平均ST","④ モーターと展示","⑤ 進入・風・水面"],paragraphs:["情報が多すぎると迷いやすいので、最初はこの順番で見ると整理しやすくなります。"]}
];
export default function Page(){return <SeoArticle eyebrow="BOAT RACE GUIDE 12" title="A1・A2・B1・B2とは？ボートレーサーの級別" description="出走表でよく見るA1・A2・B1・B2。級別の意味と、級別だけでレースを判断しないための見方を解説します。" summary="級別は選手の実力を見る入口ですが、実際のレースではコース・ST・モーター・展示まで合わせて見るのが基本です。" sections={sections} related={[{href:"/guide/race-card",label:"出走表の見方"},{href:"/guide/average-st",label:"平均STの見方"},{href:"/races",label:"本日の出走表を見る"}]} references={[{label:"BOAT RACE オフィシャルウェブサイト",url:"https://www.boatrace.jp/"}]} />}
